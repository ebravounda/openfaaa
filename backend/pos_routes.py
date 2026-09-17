"""Módulo TPV/POS — punto de venta para hostelería y retail.
Registra ventas, categorías, productos, mesas, sesiones de caja (arqueo),
retiros/ingresos de efectivo, propinas y tickets imprimibles (80/58 mm).
El cobro solo se REGISTRA (efectivo/tarjeta/mixto), no cobra tarjeta real."""
import uuid
from datetime import datetime, timezone
from html import escape as _esc

from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import HTMLResponse
from pymongo import ReturnDocument

from database import db
from auth import get_current_user
from plans import plan_for_user

pos = APIRouter(prefix="/api/pos", tags=["pos"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def require_pos(user=Depends(get_current_user)) -> dict:
    if user.get("role") == "admin" or user.get("pos_enabled"):
        return user
    plan = await plan_for_user(user)
    if plan.get("features", {}).get("pos"):
        return user
    raise HTTPException(status_code=403,
                        detail="El módulo TPV no está activado en tu cuenta. Contacta con soporte para habilitarlo.")


async def _active_cid(user: dict) -> str:
    comps = await db.companies.find({"user_id": user["id"]}).to_list(200)
    comps = [c for c in comps if c.get("id")]
    if not comps:
        cid = str(uuid.uuid4())
        await db.companies.insert_one({"id": cid, "user_id": user["id"], "name": "",
                                       "tax_type": user.get("tax_type", "autonomo"),
                                       "created_at": _now()})
        return cid
    aid = user.get("active_company_id")
    for c in comps:
        if c.get("id") == aid:
            return c["id"]
    return comps[0]["id"]


def _scope(user: dict, cid: str) -> dict:
    return {"user_id": user["id"], "company_id": cid}


# ---------- Settings ----------
async def _get_settings(user: dict, cid: str) -> dict:
    doc = await db.pos_settings.find_one({"company_id": cid}, {"_id": 0})
    if not doc:
        doc = {"id": cid, "user_id": user["id"], "company_id": cid,
               "pos_type": "retail", "ticket_width": "80",
               "verifactu_tickets": False, "tip_enabled": True,
               "business_name": "", "footer_note": "", "updated_at": _now()}
        await db.pos_settings.insert_one(dict(doc))
        doc.pop("_id", None)
    return doc


@pos.get("/settings")
async def get_settings(user=Depends(require_pos)):
    return await _get_settings(user, await _active_cid(user))


@pos.put("/settings")
async def put_settings(data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    await _get_settings(user, cid)
    allowed = {k: data[k] for k in ("pos_type", "ticket_width", "verifactu_tickets",
                                    "tip_enabled", "business_name", "footer_note") if k in data}
    if allowed.get("pos_type") not in (None, "retail", "hosteleria"):
        raise HTTPException(400, "Tipo de TPV inválido")
    if "ticket_width" in allowed and str(allowed["ticket_width"]) not in ("80", "58"):
        raise HTTPException(400, "Ancho de ticket inválido")
    allowed["updated_at"] = _now()
    await db.pos_settings.update_one({"company_id": cid}, {"$set": allowed})
    return await db.pos_settings.find_one({"company_id": cid}, {"_id": 0})


# ---------- Categories ----------
@pos.get("/categories")
async def list_categories(user=Depends(require_pos)):
    cid = await _active_cid(user)
    return await db.pos_categories.find(_scope(user, cid), {"_id": 0}).sort("sort", 1).to_list(500)


@pos.post("/categories")
async def create_category(data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "El nombre es obligatorio")
    doc = {"id": str(uuid.uuid4()), **_scope(user, cid), "name": name,
           "color": data.get("color") or "#0052FF", "sort": int(data.get("sort") or 0),
           "created_at": _now()}
    await db.pos_categories.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@pos.put("/categories/{cat_id}")
async def update_category(cat_id: str, data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    upd = {k: data[k] for k in ("name", "color", "sort") if k in data}
    res = await db.pos_categories.update_one({**_scope(user, cid), "id": cat_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Categoría no encontrada")
    return await db.pos_categories.find_one({"id": cat_id}, {"_id": 0})


@pos.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, user=Depends(require_pos)):
    cid = await _active_cid(user)
    await db.pos_categories.delete_one({**_scope(user, cid), "id": cat_id})
    await db.pos_products.update_many({**_scope(user, cid), "category_id": cat_id},
                                      {"$set": {"category_id": None}})
    return {"status": "ok"}


# ---------- Products ----------
@pos.get("/products")
async def list_products(user=Depends(require_pos)):
    cid = await _active_cid(user)
    return await db.pos_products.find(_scope(user, cid), {"_id": 0}).sort("name", 1).to_list(2000)


def _product_doc(data: dict) -> dict:
    variants = []
    for v in (data.get("variants") or []):
        variants.append({
            "id": v.get("id") or str(uuid.uuid4()),
            "name": (v.get("name") or "").strip(),
            "price_delta": float(v.get("price_delta") or 0),
            "sku": v.get("sku") or "", "barcode": v.get("barcode") or "",
            "stock": (float(v["stock"]) if v.get("stock") not in (None, "") else None),
        })
    stock = data.get("stock")
    return {
        "name": (data.get("name") or "").strip(),
        "category_id": data.get("category_id") or None,
        "price": float(data.get("price") or 0),
        "tax_rate": float(data.get("tax_rate") if data.get("tax_rate") is not None else 21),
        "sku": data.get("sku") or "", "barcode": data.get("barcode") or "",
        "color": data.get("color") or "",
        "track_stock": bool(data.get("track_stock")),
        "stock": (float(stock) if stock not in (None, "") else None),
        "variants": variants,
        "active": bool(data.get("active", True)),
    }


@pos.post("/products")
async def create_product(data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    body = _product_doc(data)
    if not body["name"]:
        raise HTTPException(400, "El nombre es obligatorio")
    doc = {"id": str(uuid.uuid4()), **_scope(user, cid), **body, "created_at": _now()}
    await db.pos_products.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@pos.put("/products/{pid}")
async def update_product(pid: str, data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    body = _product_doc(data)
    if not body["name"]:
        raise HTTPException(400, "El nombre es obligatorio")
    res = await db.pos_products.update_one({**_scope(user, cid), "id": pid}, {"$set": body})
    if res.matched_count == 0:
        raise HTTPException(404, "Producto no encontrado")
    return await db.pos_products.find_one({"id": pid}, {"_id": 0})


@pos.delete("/products/{pid}")
async def delete_product(pid: str, user=Depends(require_pos)):
    cid = await _active_cid(user)
    await db.pos_products.delete_one({**_scope(user, cid), "id": pid})
    return {"status": "ok"}


# ---------- Tables (hostelería) ----------
@pos.get("/tables")
async def list_tables(user=Depends(require_pos)):
    cid = await _active_cid(user)
    tables = await db.pos_tables.find(_scope(user, cid), {"_id": 0}).sort("sort", 1).to_list(500)
    open_tickets = await db.pos_tickets.find({**_scope(user, cid), "status": "open"},
                                             {"_id": 0}).to_list(500)
    busy = {t.get("table_id"): t for t in open_tickets if t.get("table_id")}
    for t in tables:
        ot = busy.get(t["id"])
        t["open_ticket_id"] = ot["id"] if ot else None
        t["open_total"] = ot["total"] if ot else 0
    return tables


@pos.post("/tables")
async def create_table(data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "El nombre es obligatorio")
    doc = {"id": str(uuid.uuid4()), **_scope(user, cid), "name": name,
           "room": data.get("room") or "", "sort": int(data.get("sort") or 0),
           "created_at": _now()}
    await db.pos_tables.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@pos.put("/tables/{tid}")
async def update_table(tid: str, data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    upd = {k: data[k] for k in ("name", "room", "sort") if k in data}
    res = await db.pos_tables.update_one({**_scope(user, cid), "id": tid}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Mesa no encontrada")
    return await db.pos_tables.find_one({"id": tid}, {"_id": 0})


@pos.delete("/tables/{tid}")
async def delete_table(tid: str, user=Depends(require_pos)):
    cid = await _active_cid(user)
    await db.pos_tables.delete_one({**_scope(user, cid), "id": tid})
    return {"status": "ok"}


# ---------- Cash session (arqueo) ----------
async def _session_summary(user: dict, cid: str, sess: dict) -> dict:
    tickets = await db.pos_tickets.find(
        {**_scope(user, cid), "session_id": sess["id"], "status": "paid"}, {"_id": 0}).to_list(10000)
    movements = await db.pos_cash_movements.find(
        {**_scope(user, cid), "session_id": sess["id"]}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    cash = sum(t.get("payment_cash", 0) for t in tickets)
    card = sum(t.get("payment_card", 0) for t in tickets)
    tips = sum(t.get("tip", 0) for t in tickets)
    total = sum(t.get("total", 0) for t in tickets)
    wd = sum(m["amount"] for m in movements if m["type"] == "withdrawal")
    dep = sum(m["amount"] for m in movements if m["type"] == "deposit")
    expected = round(sess.get("opening_cash", 0) + cash + dep - wd, 2)
    return {"session": sess, "tickets_count": len(tickets), "sales_total": round(total, 2),
            "cash_sales": round(cash, 2), "card_sales": round(card, 2), "tips": round(tips, 2),
            "withdrawals": round(wd, 2), "deposits": round(dep, 2),
            "expected_cash": expected, "movements": movements}


@pos.get("/session/current")
async def current_session(user=Depends(require_pos)):
    cid = await _active_cid(user)
    sess = await db.pos_sessions.find_one({**_scope(user, cid), "status": "open"}, {"_id": 0})
    if not sess:
        return None
    return await _session_summary(user, cid, sess)


@pos.post("/session/open")
async def open_session(data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    if await db.pos_sessions.find_one({**_scope(user, cid), "status": "open"}):
        raise HTTPException(400, "Ya hay una caja abierta")
    doc = {"id": str(uuid.uuid4()), **_scope(user, cid),
           "opening_cash": float(data.get("opening_cash") or 0),
           "opened_at": _now(), "opened_by": user.get("name") or user.get("email"),
           "status": "open", "closed_at": None, "closing_cash": None, "difference": None}
    await db.pos_sessions.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@pos.post("/session/movement")
async def cash_movement(data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    sess = await db.pos_sessions.find_one({**_scope(user, cid), "status": "open"})
    if not sess:
        raise HTTPException(400, "No hay caja abierta")
    typ = data.get("type")
    if typ not in ("withdrawal", "deposit"):
        raise HTTPException(400, "Tipo inválido")
    amount = float(data.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(400, "Importe inválido")
    doc = {"id": str(uuid.uuid4()), **_scope(user, cid), "session_id": sess["id"],
           "type": typ, "amount": round(amount, 2), "reason": data.get("reason") or "",
           "by": user.get("name") or user.get("email"), "created_at": _now()}
    await db.pos_cash_movements.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@pos.post("/session/close")
async def close_session(data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    sess = await db.pos_sessions.find_one({**_scope(user, cid), "status": "open"}, {"_id": 0})
    if not sess:
        raise HTTPException(400, "No hay caja abierta")
    summ = await _session_summary(user, cid, sess)
    closing = float(data.get("closing_cash") or 0)
    diff = round(closing - summ["expected_cash"], 2)
    await db.pos_sessions.update_one({"id": sess["id"]}, {"$set": {
        "status": "closed", "closed_at": _now(), "closing_cash": round(closing, 2),
        "expected_cash": summ["expected_cash"], "difference": diff,
        "summary": {k: summ[k] for k in ("sales_total", "cash_sales", "card_sales",
                                         "tips", "withdrawals", "deposits", "tickets_count")}}})
    return await db.pos_sessions.find_one({"id": sess["id"]}, {"_id": 0})


@pos.get("/sessions")
async def list_sessions(user=Depends(require_pos), limit: int = 50):
    cid = await _active_cid(user)
    return await db.pos_sessions.find(_scope(user, cid), {"_id": 0}).sort("opened_at", -1).to_list(limit)


# ---------- Tickets / ventas ----------
def _compute_ticket(items: list, tip: float = 0.0) -> dict:
    subtotal = 0.0
    breakdown: dict = {}
    norm = []
    for it in (items or []):
        qty = float(it.get("qty") or 1)
        price = float(it.get("unit_price") or 0)  # PVP con IVA incluido
        disc = float(it.get("discount") or 0)     # porcentaje
        rate = float(it.get("tax_rate") if it.get("tax_rate") is not None else 21)
        gross = qty * price * (1 - disc / 100)
        base = gross / (1 + rate / 100) if rate else gross
        cuota = gross - base
        b = breakdown.setdefault(rate, {"rate": rate, "base": 0.0, "cuota": 0.0})
        b["base"] += base
        b["cuota"] += cuota
        subtotal += gross
        norm.append({
            "product_id": it.get("product_id"), "variant_id": it.get("variant_id"),
            "name": it.get("name") or "", "qty": qty, "unit_price": round(price, 2),
            "discount": disc, "tax_rate": rate, "notes": it.get("notes") or "",
            "line_total": round(gross, 2),
        })
    tip = float(tip or 0)
    bd = [{"rate": r, "base": round(v["base"], 2), "cuota": round(v["cuota"], 2)}
          for r, v in sorted(breakdown.items())]
    return {
        "items": norm, "subtotal": round(subtotal, 2), "tip": round(tip, 2),
        "base_total": round(sum(x["base"] for x in bd), 2),
        "tax_total": round(sum(x["cuota"] for x in bd), 2),
        "tax_breakdown": bd, "total": round(subtotal + tip, 2),
    }


def _apply_payment(doc: dict, data: dict):
    method = data.get("payment_method") or "efectivo"
    total = doc["total"]
    if method == "mixto":
        cash = round(float(data.get("payment_cash") or 0), 2)
        card = round(total - cash, 2)
    elif method == "tarjeta":
        cash, card = 0.0, total
    else:
        method = "efectivo"
        cash, card = total, 0.0
    doc["payment_method"] = method
    doc["payment_cash"] = cash
    doc["payment_card"] = card


async def _next_number(cid: str) -> str:
    c = await db.pos_counters.find_one_and_update(
        {"company_id": cid}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER)
    return f"T-{(c.get('seq') or 1):06d}"


async def _adjust_stock(user: dict, cid: str, items: list, sign: int):
    for it in (items or []):
        pid = it.get("product_id")
        if not pid:
            continue
        prod = await db.pos_products.find_one({**_scope(user, cid), "id": pid})
        if not prod or not prod.get("track_stock"):
            continue
        qty = float(it.get("qty") or 1) * sign
        vid = it.get("variant_id")
        if vid and prod.get("variants"):
            vs = prod["variants"]
            for v in vs:
                if v.get("id") == vid and v.get("stock") is not None:
                    v["stock"] = round(v["stock"] + qty, 3)
            await db.pos_products.update_one({"id": pid}, {"$set": {"variants": vs}})
        elif prod.get("stock") is not None:
            await db.pos_products.update_one({"id": pid}, {"$inc": {"stock": qty}})


async def _finalize_sale(user: dict, cid: str, doc: dict):
    doc["number"] = await _next_number(cid)
    doc["paid_at"] = _now()
    await _adjust_stock(user, cid, doc["items"], -1)


@pos.post("/tickets")
async def create_ticket(data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    settings = await _get_settings(user, cid)
    status = data.get("status") or "paid"
    if status not in ("paid", "open"):
        raise HTTPException(400, "Estado inválido")
    comp = _compute_ticket(data.get("items") or [], data.get("tip") or 0)
    if not comp["items"]:
        raise HTTPException(400, "El ticket no tiene productos")
    sess = await db.pos_sessions.find_one({**_scope(user, cid), "status": "open"})
    doc = {"id": str(uuid.uuid4()), **_scope(user, cid),
           "session_id": (sess or {}).get("id"),
           "pos_type": settings.get("pos_type"),
           "table_id": data.get("table_id"), "table_name": data.get("table_name") or "",
           "customer": data.get("customer") or "",
           **comp, "status": status, "number": None,
           "payment_method": None, "payment_cash": 0, "payment_card": 0,
           "created_at": _now()}
    if status == "paid":
        _apply_payment(doc, data)
        await _finalize_sale(user, cid, doc)
    await db.pos_tickets.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@pos.put("/tickets/{tid}")
async def update_ticket(tid: str, data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    t = await db.pos_tickets.find_one({**_scope(user, cid), "id": tid})
    if not t:
        raise HTTPException(404, "Ticket no encontrado")
    if t.get("status") != "open":
        raise HTTPException(400, "Solo se pueden editar comandas abiertas")
    tip = data.get("tip") if data.get("tip") is not None else t.get("tip", 0)
    comp = _compute_ticket(data.get("items") if data.get("items") is not None else t.get("items"), tip)
    upd = {**comp, "table_id": data.get("table_id", t.get("table_id")),
           "table_name": data.get("table_name", t.get("table_name")),
           "customer": data.get("customer", t.get("customer")), "updated_at": _now()}
    await db.pos_tickets.update_one({"id": tid}, {"$set": upd})
    return await db.pos_tickets.find_one({"id": tid}, {"_id": 0})


@pos.post("/tickets/{tid}/pay")
async def pay_ticket(tid: str, data: dict = Body(...), user=Depends(require_pos)):
    cid = await _active_cid(user)
    t = await db.pos_tickets.find_one({**_scope(user, cid), "id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Ticket no encontrado")
    if t.get("status") == "paid":
        raise HTTPException(400, "El ticket ya está cobrado")
    if data.get("items") is not None or data.get("tip") is not None:
        tip = data.get("tip") if data.get("tip") is not None else t.get("tip", 0)
        t.update(_compute_ticket(data.get("items") or t["items"], tip))
    _apply_payment(t, data)
    sess = await db.pos_sessions.find_one({**_scope(user, cid), "status": "open"})
    t["session_id"] = (sess or {}).get("id")
    t["status"] = "paid"
    await _finalize_sale(user, cid, t)
    await db.pos_tickets.update_one({"id": tid}, {"$set": {k: t[k] for k in (
        "items", "subtotal", "tip", "base_total", "tax_total", "tax_breakdown", "total",
        "payment_method", "payment_cash", "payment_card", "status", "number", "paid_at", "session_id")}})
    return await db.pos_tickets.find_one({"id": tid}, {"_id": 0})


@pos.post("/tickets/{tid}/refund")
async def refund_ticket(tid: str, user=Depends(require_pos)):
    cid = await _active_cid(user)
    t = await db.pos_tickets.find_one({**_scope(user, cid), "id": tid})
    if not t:
        raise HTTPException(404, "Ticket no encontrado")
    if t.get("status") != "paid":
        raise HTTPException(400, "Solo se pueden devolver tickets cobrados")
    await _adjust_stock(user, cid, t.get("items") or [], +1)
    await db.pos_tickets.update_one({"id": tid}, {"$set": {"status": "refunded", "refunded_at": _now()}})
    return {"status": "refunded"}


@pos.delete("/tickets/{tid}")
async def delete_open_ticket(tid: str, user=Depends(require_pos)):
    cid = await _active_cid(user)
    t = await db.pos_tickets.find_one({**_scope(user, cid), "id": tid})
    if not t:
        raise HTTPException(404, "Ticket no encontrado")
    if t.get("status") != "open":
        raise HTTPException(400, "Solo se pueden anular comandas abiertas")
    await db.pos_tickets.delete_one({"id": tid})
    return {"status": "ok"}


@pos.get("/tickets")
async def list_tickets(user=Depends(require_pos), limit: int = 100, status: str = None):
    cid = await _active_cid(user)
    q = dict(_scope(user, cid))
    if status:
        q["status"] = status
    return await db.pos_tickets.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)


@pos.get("/tickets/{tid}")
async def get_ticket(tid: str, user=Depends(require_pos)):
    cid = await _active_cid(user)
    t = await db.pos_tickets.find_one({**_scope(user, cid), "id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Ticket no encontrado")
    return t


# ---------- Ticket imprimible (80/58 mm) ----------
def _fmt(v) -> str:
    return f"{(v or 0):.2f} €".replace(".", ",")


def _render_receipt(t: dict, settings: dict, company: dict, width: str) -> str:
    w = "58" if str(width) == "58" else "80"
    mm = "58mm" if w == "58" else "80mm"
    biz = _esc(settings.get("business_name") or company.get("name") or "OpenFactura")
    nif = _esc(company.get("nif") or "")
    addr = _esc(company.get("address") or "")
    rows = ""
    for it in t.get("items", []):
        name = _esc(it.get("name") or "")
        note = _esc(it.get("notes") or "")
        qty = it.get("qty") or 1
        line = _fmt(it.get("line_total"))
        rows += (f"<tr><td class='q'>{qty:g}×</td><td class='n'>{name}"
                 + (f"<div class='note'>{note}</div>" if note else "")
                 + f"</td><td class='p'>{line}</td></tr>")
    taxes = ""
    for b in t.get("tax_breakdown", []):
        taxes += f"<div class='trow'><span>IVA {b['rate']:g}% (base {_fmt(b['base'])})</span><span>{_fmt(b['cuota'])}</span></div>"
    tip_row = f"<div class='trow'><span>Propina</span><span>{_fmt(t.get('tip'))}</span></div>" if t.get("tip") else ""
    method = {"efectivo": "Efectivo", "tarjeta": "Tarjeta", "mixto": "Mixto"}.get(t.get("payment_method"), "—")
    pay_extra = ""
    if t.get("payment_method") == "mixto":
        pay_extra = (f"<div class='trow'><span>· Efectivo</span><span>{_fmt(t.get('payment_cash'))}</span></div>"
                     f"<div class='trow'><span>· Tarjeta</span><span>{_fmt(t.get('payment_card'))}</span></div>")
    num = _esc(t.get("number") or "—")
    when = _esc((t.get("paid_at") or t.get("created_at") or "")[:19].replace("T", " "))
    table = f"<div class='meta'>Mesa: {_esc(t.get('table_name'))}</div>" if t.get("table_name") else ""
    footer = _esc(settings.get("footer_note") or "¡Gracias por su visita!")
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Ticket {num}</title>
<style>
@page {{ size: {mm} auto; margin: 0; }}
* {{ box-sizing: border-box; }}
body {{ width: {mm}; margin: 0 auto; padding: 4mm 3mm; font-family: 'Courier New', monospace;
       color: #000; font-size: {'11px' if w=='58' else '12px'}; }}
h1 {{ font-size: {'14px' if w=='58' else '16px'}; text-align: center; margin: 0 0 2px; }}
.center {{ text-align: center; }}
.muted {{ color: #333; font-size: 10px; }}
hr {{ border: none; border-top: 1px dashed #000; margin: 6px 0; }}
table {{ width: 100%; border-collapse: collapse; }}
td {{ vertical-align: top; padding: 1px 0; }}
td.q {{ width: 28px; }}
td.p {{ text-align: right; white-space: nowrap; padding-left: 4px; }}
.note {{ font-size: 10px; font-style: italic; color: #333; }}
.trow {{ display: flex; justify-content: space-between; font-size: 11px; }}
.total {{ display: flex; justify-content: space-between; font-weight: bold;
         font-size: {'15px' if w=='58' else '17px'}; margin-top: 4px; }}
.meta {{ font-size: 11px; }}
.btn {{ display:block; width:100%; margin:10px 0; padding:8px; font-size:13px; }}
@media print {{ .btn {{ display: none; }} }}
</style></head><body>
<h1>{biz}</h1>
<div class="center muted">{nif}{(' · ' + addr) if addr else ''}</div>
<hr>
<div class="meta">Ticket: <b>{num}</b></div>
<div class="meta">{when}</div>
{table}
<hr>
<table>{rows}</table>
<hr>
<div class="trow"><span>Base imponible</span><span>{_fmt(t.get('base_total'))}</span></div>
{taxes}
{tip_row}
<div class="total"><span>TOTAL</span><span>{_fmt(t.get('total'))}</span></div>
<hr>
<div class="trow"><span>Pago</span><span>{method}</span></div>
{pay_extra}
<hr>
<div class="center muted">{footer}</div>
<button class="btn" onclick="window.print()">Imprimir</button>
<script>window.onload=function(){{setTimeout(function(){{window.print();}},300);}};</script>
</body></html>"""


@pos.get("/tickets/{tid}/receipt")
async def ticket_receipt(tid: str, width: str = "80", user=Depends(require_pos)):
    cid = await _active_cid(user)
    t = await db.pos_tickets.find_one({**_scope(user, cid), "id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Ticket no encontrado")
    settings = await _get_settings(user, cid)
    company = await db.companies.find_one({"id": cid}, {"_id": 0}) or {}
    return HTMLResponse(_render_receipt(t, settings, company, width or settings.get("ticket_width", "80")))
