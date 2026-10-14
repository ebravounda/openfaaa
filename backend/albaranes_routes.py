"""Albaranes (notas de entrega): CRUD, PDF con firma, email, creación desde presupuesto y facturación (una o agrupada)."""
import base64
import binascii
import os
import re
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from html import escape
from typing import List

from fastapi import APIRouter, HTTPException, Depends, Response, Request
from pydantic import BaseModel

from database import db
from auth import get_current_user
from server import Client, LineItem, InvoiceInput, StatusInput, compute_invoice, _validate_invoice, _make_invoice, \
    active_company, active_cid, plan_for_user, _plan_denied, _month_prefix
from pdf_service import build_invoice_pdf
from email_service import send_email

alb = APIRouter(prefix="/api/albaranes", tags=["albaranes"])
pub = APIRouter(prefix="/api/public/albaran-firma", tags=["albaranes-public"])
STATUSES = {"pendiente", "entregado", "facturado"}
SIGN_LINK_DAYS = 7


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


class SignInput(BaseModel):
    name: str
    dni: str = ""
    signature: str
    send_email: bool = True


class SignLinkInput(BaseModel):
    email: bool = False


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
    return await db.albaranes.find({"user_id": user["id"], "company_id": await active_cid(user)}, {"_id": 0, "signature.image": 0}).sort([("issue_date", -1), ("number", -1)]).to_list(1000)


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
    if a.get("signature"):
        raise HTTPException(status_code=400, detail="No se puede editar un albarán ya firmado por el cliente.")
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


# ---------- Firma de entrega (en el dispositivo o por enlace) ----------
def _base_url(request: Request) -> str:
    proto = (request.headers.get("x-forwarded-proto") or "https").split(",")[0].strip()
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(",")[0].strip()
    return f"{proto}://{host}" if host else (os.environ.get("APP_BASE_URL") or "https://openfactura.es")


def _check_png(data_url: str) -> str:
    m = re.fullmatch(r"data:image/png;base64,([A-Za-z0-9+/=]+)", (data_url or "").strip())
    if not m or len(m.group(1)) > 400_000:
        raise HTTPException(status_code=400, detail="La firma no es válida. Vuelve a firmar.")
    try:
        raw = base64.b64decode(m.group(1), validate=True)
    except binascii.Error:
        raise HTTPException(status_code=400, detail="La firma no es válida. Vuelve a firmar.")
    if not raw.startswith(b"\x89PNG") or len(raw) < 400:
        raise HTTPException(status_code=400, detail="La firma está vacía. Firma dentro del recuadro.")
    return m.group(1)


async def _apply_signature(a: dict, data: SignInput, request: Request, method: str, company: dict) -> dict:
    if a.get("signature"):
        raise HTTPException(status_code=400, detail="Este albarán ya está firmado.")
    name = data.name.strip()[:120]
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Escribe el nombre de quien recibe la entrega.")
    sig = {"name": name, "dni": data.dni.strip().upper()[:20], "image": _check_png(data.signature), "method": method,
           "signed_at": datetime.now(timezone.utc).isoformat(),
           "ip": (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()[:60],
           "user_agent": (request.headers.get("user-agent") or "")[:200]}
    upd = {"signature": sig, "sign_token": None}
    if a.get("status") != "facturado":
        upd["status"] = "entregado"
    await db.albaranes.update_one({"id": a["id"]}, {"$set": upd})
    a.update(upd)
    emailed = ""
    to = (a.get("client") or {}).get("email")
    if data.send_email and to:
        try:
            pdf = build_invoice_pdf(a, company)
            cname = escape(company.get("trade_name") or company.get("name") or "OpenFactura")
            html = (f'<div style="font-family:Arial,sans-serif;color:#0F172A;max-width:560px"><h2 style="margin:0 0 8px">Albarán {escape(a["number"])} firmado</h2>'
                    f'<p>Hola {escape(a["client"].get("name", ""))},</p><p>Te enviamos adjunto el albarán <b>{escape(a["number"])}</b> firmado por '
                    f'<b>{escape(name)}</b> el {datetime.now(timezone.utc).strftime("%d/%m/%Y")} como confirmación de la entrega.</p><p>Un saludo,<br/>{cname}</p></div>')
            await send_email(to=to, subject=f"Albarán {a['number']} firmado - {company.get('trade_name') or company.get('name', '')}", html=html,
                             reply_to=company.get("email"), attachments=[{"filename": f"albaran-{a['number']}-firmado.pdf", "content": base64.b64encode(pdf).decode()}])
            emailed = to
            await db.albaranes.update_one({"id": a["id"]}, {"$set": {"emailed_at": datetime.now(timezone.utc).isoformat()}})
        except Exception:
            emailed = ""
    return {"status": a["status"], "signature": {k: v for k, v in sig.items() if k != "image"}, "emailed_to": emailed}


async def _company_of(a: dict) -> dict:
    return await db.companies.find_one({"id": a.get("company_id")}, {"_id": 0}) or {}


@alb.post("/{aid}/firmar")
async def sign_albaran(aid: str, data: SignInput, request: Request, user=Depends(get_current_user)):
    a = await _get(aid, user)
    return await _apply_signature(a, data, request, "presencial", await _company_of(a))


@alb.post("/{aid}/enlace-firma")
async def sign_link(aid: str, data: SignLinkInput, request: Request, user=Depends(get_current_user)):
    a = await _get(aid, user)
    if a.get("signature"):
        raise HTTPException(status_code=400, detail="Este albarán ya está firmado.")
    token = secrets.token_urlsafe(24)
    exp = (datetime.now(timezone.utc) + timedelta(days=SIGN_LINK_DAYS)).isoformat()
    await db.albaranes.update_one({"id": aid}, {"$set": {"sign_token": token, "sign_token_expires": exp}})
    url = f"{_base_url(request)}/firmar/{token}"
    emailed = ""
    if data.email:
        to = (a.get("client") or {}).get("email")
        if not to:
            raise HTTPException(status_code=400, detail="El cliente no tiene email registrado")
        company = await _company_of(a)
        cname = escape(company.get("trade_name") or company.get("name") or "OpenFactura")
        html = (f'<div style="font-family:Arial,sans-serif;color:#0F172A;max-width:560px"><h2 style="margin:0 0 8px">Confirma la recepción de tu pedido</h2>'
                f'<p>Hola {escape(a["client"].get("name", ""))},</p><p>{cname} te ha enviado el albarán <b>{escape(a["number"])}</b>. '
                f'Revísalo y fírmalo desde tu móvil o tu ordenador para confirmar la entrega.</p>'
                f'<p style="margin:22px 0"><a href="{url}" style="background:#0052FF;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px">Revisar y firmar el albarán</a></p>'
                f'<p style="color:#64748B;font-size:13px">El enlace es válido durante {SIGN_LINK_DAYS} días.</p><p>Un saludo,<br/>{cname}</p></div>')
        await send_email(to=to, subject=f"Firma el albarán {a['number']} - {company.get('trade_name') or company.get('name', '')}", html=html, reply_to=company.get("email"))
        emailed = to
    return {"url": url, "expires_at": exp, "emailed_to": emailed}


async def _by_token(token: str) -> dict:
    a = await db.albaranes.find_one({"sign_token": token}, {"_id": 0}) if re.fullmatch(r"[A-Za-z0-9_\-]{20,64}", token or "") else None
    if not a or (a.get("sign_token_expires") or "") < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=404, detail="Este enlace de firma no existe o ha caducado. Pídele uno nuevo a tu proveedor.")
    return a


@pub.get("/{token}")
async def public_view(token: str):
    a = await _by_token(token)
    c = await _company_of(a)
    show = a.get("show_prices", True)
    return {"number": a["number"], "issue_date": a.get("issue_date"), "delivery_date": a.get("delivery_date"), "delivery_address": a.get("delivery_address", ""),
            "client_name": (a.get("client") or {}).get("name", ""), "company": c.get("trade_name") or c.get("name", ""), "show_prices": show,
            "notes": a.get("notes", ""), "total": a.get("total") if show else None,
            "lines": [{"description": i.get("description"), "detail": i.get("detail", ""), "quantity": i.get("quantity"),
                       **({"amount": round((i.get("quantity") or 0) * (i.get("unit_price") or 0) * (1 - (i.get("discount") or 0) / 100), 2)} if show else {})}
                      for i in a.get("line_items", [])]}


@pub.get("/{token}/pdf")
async def public_pdf(token: str):
    a = await _by_token(token)
    return Response(build_invoice_pdf(a, await _company_of(a)), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="albaran-{a["number"]}.pdf"'})


@pub.post("/{token}")
async def public_sign(token: str, data: SignInput, request: Request):
    a = await _by_token(token)
    data.send_email = True
    res = await _apply_signature(a, data, request, "enlace", await _company_of(a))
    return {"status": "ok", "emailed_to": res["emailed_to"]}
