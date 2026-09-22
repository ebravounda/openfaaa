import os
import io
import uuid
import base64
import secrets
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File
from pydantic import BaseModel, EmailStr
from bson import ObjectId
from PIL import Image

from database import db
from auth import (
    get_current_user, hash_password, validate_password_strength,
    create_access_token, create_refresh_token, _set_cookies, _public_user, _hash_token,
)
from plans import load_plans

logger = logging.getLogger("gestoria")

gestoria = APIRouter(prefix="/api/gestoria", tags=["gestoria"])
branding = APIRouter(prefix="/api", tags=["branding"])

RESELLER_RATE = 0.5  # la gestoría paga el 50% del precio del plan


async def require_gestoria(user=Depends(get_current_user)) -> dict:
    if user.get("role") != "gestoria" or user.get("is_impersonating"):
        raise HTTPException(status_code=403, detail="Acceso restringido a gestorías")
    return user


async def _gestoria_doc(gid: str) -> dict:
    doc = await db.users.find_one({"_id": ObjectId(gid), "role": "gestoria"})
    if not doc:
        raise HTTPException(status_code=404, detail="Gestoría no encontrada")
    return doc


# ---------------- Modelos ----------------
class ClientCreateInput(BaseModel):
    name: str
    last_name: str = ""
    email: EmailStr
    plan: str = "basico"
    mode: str = "password"  # password | invite
    password: str = ""
    tax_id: str = ""
    phone: str = ""
    address: str = ""
    tax_type: str = "autonomo"


class ClientPlanInput(BaseModel):
    plan: str


class BillingCheckoutInput(BaseModel):
    origin_url: str


# ---------------- Helpers ----------------
def _invite_html(firm_name: str, name: str, link: str) -> str:
    saludo = f"Hola {name}," if name else "Hola,"
    firm = firm_name or "Tu gestoría"
    return (
        "<div style='font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a'>"
        "<div style='text-align:center;padding:8px 0 18px'><span style='font-size:22px;font-weight:700;color:#0052FF'>openfactura</span></div>"
        "<div style='background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px'>"
        "<h1 style='font-size:19px;margin:0 0 12px'>Tu cuenta está lista</h1>"
        f"<p style='font-size:15px;line-height:1.6;color:#475569;margin:0 0 8px'>{saludo}</p>"
        f"<p style='font-size:15px;line-height:1.6;color:#475569;margin:0 0 22px'>{firm} ha creado una cuenta para ti en OpenFactura. "
        "Pulsa el botón para crear tu contraseña y empezar a facturar. El enlace caduca en 48 horas.</p>"
        f"<div style='text-align:center;margin:0 0 22px'><a href='{link}' style='display:inline-block;background:#0052FF;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px;font-size:15px'>Crear mi contraseña</a></div>"
        f"<p style='font-size:12px;color:#cbd5e1;margin:0;word-break:break-all'>O copia este enlace: {link}</p>"
        "</div></div>"
    )


async def _client_row(u: dict, plans: dict) -> dict:
    uid = str(u["_id"])
    inv_total = await db.invoices.count_documents({"user_id": uid})
    cur = db.invoices.find({"user_id": uid, "status": {"$ne": "anulada"}}, {"_id": 0, "total": 1})
    billed = 0.0
    async for inv in cur:
        billed += inv.get("total", 0) or 0
    plan_id = u.get("plan", "basico")
    price = plans.get(plan_id, {}).get("price", 0) or 0
    return {
        "id": uid,
        "name": u.get("name", ""),
        "email": u.get("email", ""),
        "plan": plan_id,
        "plan_name": plans.get(plan_id, {}).get("name", plan_id),
        "plan_price": price,
        "reseller_value": round(price * RESELLER_RATE, 2),
        "is_blocked": bool(u.get("is_blocked", False)),
        "pending_setup": bool(u.get("pending_setup", False)),
        "invoices_total": inv_total,
        "billed": round(billed, 2),
        "created_at": u.get("created_at"),
    }


# ---------------- Endpoints gestoría ----------------
@gestoria.get("/summary")
async def summary(g=Depends(require_gestoria)):
    gdoc = await _gestoria_doc(g["id"])
    plans = await load_plans()
    clients = await db.users.find({"gestoria_id": g["id"]}, {"plan": 1}).to_list(100000)
    breakdown = {}
    total_value = 0.0
    for c in clients:
        p = c.get("plan", "basico")
        breakdown[p] = breakdown.get(p, 0) + 1
        total_value += (plans.get(p, {}).get("price", 0) or 0) * RESELLER_RATE
    return {
        "firm_name": gdoc.get("firm_name", gdoc.get("name", "")),
        "logo": gdoc.get("logo", ""),
        "iban": gdoc.get("iban", ""),
        "max_clients": int(gdoc.get("max_clients", 0) or 0),
        "clients_count": len(clients),
        "plan_breakdown": breakdown,
        "monthly_value": round(total_value, 2),
    }


@gestoria.get("/clients")
async def list_clients(g=Depends(require_gestoria)):
    plans = await load_plans()
    rows = await db.users.find({"gestoria_id": g["id"]}).sort("created_at", -1).to_list(100000)
    return [await _client_row(u, plans) for u in rows]


@gestoria.post("/clients")
async def create_client(data: ClientCreateInput, request: Request, g=Depends(require_gestoria)):
    gdoc = await _gestoria_doc(g["id"])
    plans = await load_plans()
    if data.plan not in plans:
        raise HTTPException(status_code=400, detail="Plan no válido")
    maxc = int(gdoc.get("max_clients", 0) or 0)
    if maxc:
        current = await db.users.count_documents({"gestoria_id": g["id"]})
        if current >= maxc:
            raise HTTPException(status_code=403, detail=f"Has alcanzado tu cupo máximo de {maxc} clientes. Contacta con OpenFactura para ampliarlo.")
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Este email ya está registrado")

    invite = data.mode == "invite"
    if invite:
        pw_hash = hash_password(secrets.token_urlsafe(24))
    else:
        validate_password_strength(data.password)
        pw_hash = hash_password(data.password)

    now = datetime.now(timezone.utc)
    doc = {
        "name": data.name, "last_name": data.last_name, "phone": data.phone,
        "address": data.address, "tax_id": data.tax_id, "email": email,
        "password_hash": pw_hash, "role": "user", "plan": data.plan,
        "is_blocked": False, "tax_type": data.tax_type, "gestoria_id": g["id"],
        "pending_setup": invite, "created_at": now.isoformat(),
    }
    result = await db.users.insert_one(doc)
    uid = str(result.inserted_id)
    cid = str(uuid.uuid4())
    await db.companies.insert_one({
        "id": cid, "user_id": uid, "name": data.name, "tax_type": data.tax_type,
        "nif": data.tax_id, "address": data.address, "phone": data.phone, "email": email,
        "template_id": "clasico", "created_at": now.isoformat()})
    await db.users.update_one({"_id": result.inserted_id}, {"$set": {"active_company_id": cid}})

    invite_sent = False
    if invite:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token_hash": _hash_token(token), "user_id": uid, "email": email, "used": False,
            "expires_at": (now + timedelta(hours=48)).isoformat(), "created_at": now.isoformat()})
        origin = request.headers.get("origin") or os.environ.get("APP_BASE_URL", "https://openfactura.es")
        link = f"{origin.rstrip('/')}/restablecer-contrasena?token={token}"
        try:
            from email_service import send_email
            await send_email(to=email, subject="Crea tu contraseña · OpenFactura",
                             html=_invite_html(gdoc.get("firm_name", gdoc.get("name", "")), data.name, link))
            invite_sent = True
        except Exception as e:
            logger.error(f"invite email failed: {e}")
    return {"status": "ok", "id": uid, "invite_sent": invite_sent}


@gestoria.post("/clients/{client_id}/plan")
async def change_client_plan(client_id: str, data: ClientPlanInput, g=Depends(require_gestoria)):
    plans = await load_plans()
    if data.plan not in plans:
        raise HTTPException(status_code=400, detail="Plan no válido")
    target = await db.users.find_one({"_id": ObjectId(client_id)})
    if not target or target.get("gestoria_id") != g["id"]:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    await db.users.update_one({"_id": ObjectId(client_id)}, {"$set": {"plan": data.plan}})
    return {"status": "ok", "plan": data.plan}


@gestoria.post("/clients/{client_id}/enter")
async def enter_client(client_id: str, response: Response, g=Depends(require_gestoria)):
    target = await db.users.find_one({"_id": ObjectId(client_id)})
    if not target or target.get("gestoria_id") != g["id"]:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    tid = str(target["_id"])
    _set_cookies(response,
                 create_access_token(tid, target["email"], imp=g["id"]),
                 create_refresh_token(tid, imp=g["id"]))
    pu = _public_user(target)
    pu["is_impersonating"] = True
    pu["impersonator_id"] = g["id"]
    return pu


@gestoria.post("/logo")
async def upload_logo(file: UploadFile = File(...), g=Depends(require_gestoria)):
    data = await file.read()
    if len(data) > 4 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="La imagen es demasiado grande (máx 4 MB).")
    try:
        img = Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception:
        raise HTTPException(status_code=400, detail="Archivo de imagen no válido.")
    img.thumbnail((600, 240))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    await db.users.update_one({"_id": ObjectId(g["id"])}, {"$set": {"logo": b64}})
    return {"status": "ok", "logo": b64}


@gestoria.post("/billing/checkout")
async def billing_checkout(req: BillingCheckoutInput, g=Depends(require_gestoria)):
    import stripe
    from integrations_config import get_stripe
    cfg = await get_stripe()
    stripe.api_key = cfg.get("secret_key") or ""
    plans = await load_plans()
    clients = await db.users.find({"gestoria_id": g["id"]}, {"plan": 1}).to_list(100000)
    total = sum((plans.get(c.get("plan", "basico"), {}).get("price", 0) or 0) * RESELLER_RATE for c in clients)
    if total <= 0:
        raise HTTPException(status_code=400, detail="Aún no tienes importe que domiciliar (sin clientes de pago).")
    amount_cents = int(round(total * 100))
    line_items = [{"price_data": {
        "currency": "eur",
        "product_data": {"name": f"OpenFactura · Gestoría ({len(clients)} clientes)"},
        "unit_amount": amount_cents,
        "recurring": {"interval": "month"},
    }, "quantity": 1}]
    base = dict(
        mode="subscription", line_items=line_items,
        success_url=f"{req.origin_url}/gestoria?sepa=ok",
        cancel_url=f"{req.origin_url}/gestoria?sepa=cancel",
        metadata={"gestoria_id": g["id"], "type": "gestoria_sepa"},
        subscription_data={"metadata": {"gestoria_id": g["id"], "type": "gestoria_sepa"}},
    )
    try:
        try:
            session = stripe.checkout.Session.create(**base, payment_method_types=["sepa_debit", "card"])
        except stripe.error.InvalidRequestError:
            session = stripe.checkout.Session.create(**base, payment_method_types=["card"])
    except stripe.error.StripeError as e:
        logger.error(f"gestoria sepa checkout failed: {e}")
        raise HTTPException(status_code=502, detail="No pudimos iniciar la domiciliación. Inténtalo más tarde.")
    return {"checkout_url": session.url, "amount": round(total, 2)}


# ---------------- Branding (para clientes) ----------------
@branding.get("/branding")
async def my_branding(user=Depends(get_current_user)):
    gid = user.get("gestoria_id")
    if not gid:
        return {"logo": "", "firm_name": ""}
    gdoc = await db.users.find_one({"_id": ObjectId(gid)}, {"logo": 1, "firm_name": 1, "name": 1})
    if not gdoc:
        return {"logo": "", "firm_name": ""}
    return {"logo": gdoc.get("logo", ""), "firm_name": gdoc.get("firm_name", gdoc.get("name", ""))}


@branding.get("/branding/public/{gestoria_id}")
async def public_branding(gestoria_id: str):
    try:
        gdoc = await db.users.find_one({"_id": ObjectId(gestoria_id), "role": "gestoria"},
                                       {"logo": 1, "firm_name": 1, "name": 1})
    except Exception:
        gdoc = None
    if not gdoc:
        return {"logo": "", "firm_name": ""}
    return {"logo": gdoc.get("logo", ""), "firm_name": gdoc.get("firm_name", gdoc.get("name", ""))}
