"""Albaranes (notas de entrega): CRUD, PDF con firma, email, creación desde presupuesto y facturación (una o agrupada)."""
import base64
import re
import uuid
from datetime import datetime, timezone
from html import escape
from typing import List

from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel

from database import db
from auth import get_current_user
from server import Client, LineItem, InvoiceInput, StatusInput, compute_invoice, _validate_invoice, _make_invoice, \
    active_company, active_cid, plan_for_user, _plan_denied, _month_prefix
from pdf_service import build_invoice_pdf
from email_service import send_email

alb = APIRouter(prefix="/api/albaranes", tags=["albaranes"])
STATUSES = {"pendiente", "entregado", "facturado"}


class AlbaranInput(BaseModel):
    issue_date: str
    delivery_date: str = ""
    client: Client
    delivery_address: str = ""
    line_items: List[LineItem]
    show_prices: bool = True
    notes: str = ""
    status: str = "pendiente"
    irpf_rate: float = 0
    global_discount: float = 0
    recargo_equivalencia: bool = False


class FacturarInput(BaseModel):
    ids: List[str]
    mode: str = "single"
    irpf_rate: float = 0
    recargo_equivalencia: bool = False


def _prefix(company: dict) -> str:
    return ((company or {}).get("delivery_prefix") or "ALB").strip()


async def _next_number(user, company, issue_date: str) -> str:
    year = (issue_date or datetime.now(timezone.utc).date().isoformat())[:4]
    p = f"{_prefix(company)}-"
    seq = 0
    async for n in db.albaranes.find({"user_id": user["id"], "company_id": company["id"], "number": {"$regex": f"^{re.escape(p)}{year}-"}}, {"_id": 0, "number": 1}):
        try:
            seq = max(seq, int(n["number"].rsplit("-", 1)[-1]))
        except ValueError:
            pass
    return f"{p}{year}-{seq + 1:04d}"


async def _get(aid: str, user) -> dict:
    a = await db.albaranes.find_one({"id": aid, "user_id": user["id"]}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Albarán no encontrado")
    return a


def _doc(data: AlbaranInput) -> dict:
    d = data.model_dump()
    d["doc_type"] = "albaran"
    if d["status"] not in STATUSES - {"facturado"}:
        d["status"] = "pendiente"
    compute_invoice(d)
    return d


@alb.get("")
async def list_albaranes(user=Depends(get_current_user)):
    return await db.albaranes.find({"user_id": user["id"], "company_id": await active_cid(user)}, {"_id": 0}).sort([("issue_date", -1), ("number", -1)]).to_list(1000)


@alb.get("/next-number")
async def next_number(issue_date: str = "", user=Depends(get_current_user)):
    return {"number": await _next_number(user, await active_company(user), issue_date)}


async def _insert(user, company, d: dict) -> dict:
    d.update({"id": str(uuid.uuid4()), "user_id": user["id"], "company_id": company["id"],
              "number": await _next_number(user, company, d["issue_date"]), "created_at": datetime.now(timezone.utc).isoformat()})
    await db.albaranes.insert_one(dict(d))
    d.pop("_id", None)
    return d


@alb.post("")
async def create_albaran(data: AlbaranInput, user=Depends(get_current_user)):
    _validate_invoice(data)
    return await _insert(user, await active_company(user), _doc(data))


@alb.post("/preview-pdf")
async def preview_albaran(data: AlbaranInput, user=Depends(get_current_user)):
    d = _doc(data)
    d["number"] = "BORRADOR"
    return Response(build_invoice_pdf(d, await active_company(user)), media_type="application/pdf")


@alb.post("/desde-presupuesto/{quote_id}")
async def from_quote(quote_id: str, user=Depends(get_current_user)):
    q = await db.quotes.find_one({"id": quote_id, "user_id": user["id"]}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    today = datetime.now(timezone.utc).date().isoformat()
    data = AlbaranInput(issue_date=today, delivery_date=today, client=Client(**(q.get("client") or {})),
                        delivery_address=(q.get("client") or {}).get("address", ""),
                        line_items=[LineItem(**{k: it.get(k) for k in ("description", "detail", "quantity", "unit_price", "discount", "iva_rate", "iva_type") if it.get(k) is not None}) for it in q.get("line_items", [])],
                        notes=q.get("notes", "") or "")
    d = _doc(data)
    d.update({"quote_id": q["id"], "quote_number": q["number"]})
    a = await _insert(user, await active_company(user), d)
    await db.quotes.update_one({"id": quote_id}, {"$push": {"albaranes": a["number"]}})
    return a


@alb.get("/{aid}")
async def get_albaran(aid: str, user=Depends(get_current_user)):
    return await _get(aid, user)


@alb.put("/{aid}")
async def update_albaran(aid: str, data: AlbaranInput, user=Depends(get_current_user)):
    _validate_invoice(data)
    a = await _get(aid, user)
    if a.get("status") == "facturado":
        raise HTTPException(status_code=400, detail="No se puede editar un albarán ya facturado.")
    d = _doc(data)
    d["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.albaranes.update_one({"id": aid}, {"$set": d})
    return {**a, **d}


@alb.patch("/{aid}/status")
async def set_status(aid: str, data: StatusInput, user=Depends(get_current_user)):
    a = await _get(aid, user)
    if data.status not in STATUSES - {"facturado"} or a.get("status") == "facturado":
        raise HTTPException(status_code=400, detail="Estado no válido")
    await db.albaranes.update_one({"id": aid}, {"$set": {"status": data.status}})
    return {"status": "ok"}


@alb.delete("/{aid}")
async def delete_albaran(aid: str, user=Depends(get_current_user)):
    a = await _get(aid, user)
    if a.get("status") == "facturado":
        raise HTTPException(status_code=400, detail=f"Este albarán está incluido en la factura {a.get('invoice_number')}; no se puede eliminar.")
    await db.albaranes.delete_one({"id": aid})
    return {"status": "ok"}


@alb.get("/{aid}/pdf")
async def albaran_pdf(aid: str, user=Depends(get_current_user)):
    a = await _get(aid, user)
    pdf = build_invoice_pdf(a, await active_company(user))
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="albaran-{a["number"]}.pdf"'})


@alb.post("/{aid}/send-email")
async def email_albaran(aid: str, user=Depends(get_current_user)):
    plan = await plan_for_user(user)
    if not plan["features"].get("email"):
        raise _plan_denied(plan, "email")
    a = await _get(aid, user)
    to = (a.get("client") or {}).get("email")
    if not to:
        raise HTTPException(status_code=400, detail="El cliente no tiene email registrado")
    company = await active_company(user)
    name = escape(company.get("trade_name") or company.get("name") or "OpenFactura")
    html = (f'<div style="font-family:Arial,sans-serif;color:#0F172A;max-width:560px">'
            f'<h2 style="margin:0 0 8px">Albarán {escape(a["number"])}</h2>'
            f'<p>Hola {escape(a["client"].get("name", ""))},</p>'
            f'<p>Te enviamos adjunto el albarán de entrega <b>{escape(a["number"])}</b>'
            f'{" con fecha de entrega " + escape(a["delivery_date"]) if a.get("delivery_date") else ""}.</p>'
            f'<p>Un saludo,<br/>{name}</p></div>')
    pdf = build_invoice_pdf(a, company)
    eid = await send_email(to=to, subject=f"Albarán {a['number']} - {company.get('trade_name') or company.get('name', '')}", html=html,
                           reply_to=company.get("email"), attachments=[{"filename": f"albaran-{a['number']}.pdf", "content": base64.b64encode(pdf).decode()}])
    await db.albaranes.update_one({"id": aid}, {"$set": {"emailed_at": datetime.now(timezone.utc).isoformat()}})
    return {"status": "sent", "email_id": eid, "to": to}


def _client_key(a: dict) -> str:
    c = a.get("client") or {}
    return (c.get("nif") or "").strip().upper() or (c.get("name") or "").strip().lower()


def _items(a: dict, tag: bool) -> list:
    out = []
    for it in a.get("line_items", []):
        x = {k: it.get(k) for k in ("description", "detail", "quantity", "unit_price", "discount", "iva_rate", "iva_type") if it.get(k) is not None}
        if tag:
            x["detail"] = " · ".join(p for p in [f"Albarán {a['number']}", x.get("detail", "")] if p)
        out.append(LineItem(**x))
    return out


@alb.post("/facturar")
async def invoice_albaranes(data: FacturarInput, user=Depends(get_current_user)):
    ids = list(dict.fromkeys(data.ids))
    if not ids:
        raise HTTPException(status_code=400, detail="Selecciona al menos un albarán.")
    docs = await db.albaranes.find({"id": {"$in": ids}, "user_id": user["id"]}, {"_id": 0}).sort("number", 1).to_list(500)
    if len(docs) != len(ids):
        raise HTTPException(status_code=404, detail="Algún albarán no existe.")
    done = [a["number"] for a in docs if a.get("status") == "facturado"]
    if done:
        raise HTTPException(status_code=400, detail=f"Ya están facturados: {', '.join(done)}.")
    single = data.mode == "single" and len(docs) > 1
    if single and len({_client_key(a) for a in docs}) > 1:
        raise HTTPException(status_code=400, detail="Para juntar albaranes en una sola factura deben ser del mismo cliente.")
    groups = [docs] if single else [[a] for a in docs]
    plan = await plan_for_user(user)
    if plan["max_invoices"] is not None:
        cnt = await db.invoices.count_documents({"user_id": user["id"], "company_id": await active_cid(user), "issue_date": {"$regex": f"^{_month_prefix()}"}})
        if cnt + len(groups) > plan["max_invoices"]:
            raise HTTPException(status_code=403, detail=f"Superarías el límite de {plan['max_invoices']} facturas al mes de tu plan {plan['name']}. Mejora tu plan para emitir más.")
    company = await active_company(user)
    created = []
    for g in groups:
        nums = ", ".join(a["number"] for a in g)
        notes = "\n".join(p for p in [f"Según albarán{'es' if len(g) > 1 else ''}: {nums}."] + [a.get("notes", "") for a in g if a.get("notes")] if p)
        inv = await _make_invoice(user, company, InvoiceInput(
            issue_date=datetime.now(timezone.utc).date().isoformat(), client=Client(**(g[-1].get("client") or {})),
            line_items=[li for a in g for li in _items(a, len(g) > 1)], irpf_rate=data.irpf_rate,
            recargo_equivalencia=data.recargo_equivalencia, notes=notes))
        await db.albaranes.update_many({"id": {"$in": [a["id"] for a in g]}}, {"$set": {
            "status": "facturado", "invoice_id": inv["id"], "invoice_number": inv["number"], "invoiced_at": datetime.now(timezone.utc).isoformat()}})
        await db.invoices.update_one({"id": inv["id"]}, {"$set": {"albaranes": [a["number"] for a in g]}})
        created.append({"id": inv["id"], "number": inv["number"], "total": inv["total"], "albaranes": [a["number"] for a in g]})
    return {"invoices": created}
