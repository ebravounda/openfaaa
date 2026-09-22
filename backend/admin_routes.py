from datetime import datetime, timezone
import re
import os
import asyncio
import uuid
import html as html_lib
import logging

logger = logging.getLogger("admin")

from fastapi import APIRouter, HTTPException, Depends, Response, Request
from pydantic import BaseModel
from bson import ObjectId

from database import db
from auth import (
    require_admin, get_current_user, create_access_token,
    create_refresh_token, _set_cookies, _public_user,
)
from plans import PLANS, PLAN_ORDER, plans_list, load_plans
from templates import GOROKY_DEFAULT_LEGAL, GOROKY_DEFAULT_FOOTER

admin = APIRouter(prefix="/api/admin", tags=["admin"])


class PlanInput(BaseModel):
    plan: str


class PlanDefInput(BaseModel):
    name: str
    price: float = 0
    max_invoices: int | None = None
    max_contacts: int | None = None
    features: dict = {}


class PlansUpdateInput(BaseModel):
    plans: dict  # {plan_id: PlanDefInput-like}


class GlobalTextsInput(BaseModel):
    legal_notice: str = ""
    footer_message: str = ""


def _month_prefix() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.year:04d}-{now.month:02d}"


async def _user_row(u: dict) -> dict:
    uid = str(u["_id"])
    inv_total = await db.invoices.count_documents({"user_id": uid})
    inv_month = await db.invoices.count_documents(
        {"user_id": uid, "issue_date": {"$regex": f"^{_month_prefix()}"}})
    contacts = await db.contacts.count_documents({"user_id": uid})
    company = await db.companies.find_one({"user_id": uid}, {"_id": 0, "name": 1})
    return {
        "id": uid,
        "name": u.get("name", ""),
        "last_name": u.get("last_name", ""),
        "email": u.get("email", ""),
        "phone": u.get("phone", ""),
        "address": u.get("address", ""),
        "tax_id": u.get("tax_id", ""),
        "role": u.get("role", "user"),
        "plan": u.get("plan", "basico"),
        "tax_type": u.get("tax_type", "autonomo"),
        "is_blocked": bool(u.get("is_blocked", False)),
        "is_pos_enabled": bool(u.get("pos_enabled", False)),
        "created_at": u.get("created_at"),
        "trial_ends_at": u.get("trial_ends_at", ""),
        "company_name": (company or {}).get("name", ""),
        "usage": {"invoices_total": inv_total, "invoices_month": inv_month, "contacts": contacts},
    }


@admin.get("/revenue")
async def revenue(admin_user=Depends(require_admin)):
    plans = await load_plans()
    mp = _month_prefix()
    by_plan, mrr, altas_mes = {}, 0.0, 0
    for pid in PLAN_ORDER:
        c = await db.users.count_documents({"plan": pid, "role": {"$ne": "admin"}})
        by_plan[pid] = c
        if pid in ("medio", "platino"):
            mrr += c * float(plans[pid].get("price", 0) or 0)
            altas_mes += await db.users.count_documents(
                {"plan": pid, "role": {"$ne": "admin"},
                 "plan_updated_at": {"$regex": f"^{mp}"}})
    trials = await db.users.count_documents(
        {"plan": "basico", "role": {"$ne": "admin"}, "trial_ends_at": {"$gt": datetime.now(timezone.utc).isoformat()}})
    return {"mrr": round(mrr, 2), "arr": round(mrr * 12, 2), "by_plan": by_plan,
            "altas_mes": altas_mes, "trials_activos": trials,
            "prices": {p: plans[p]["price"] for p in PLAN_ORDER}}


@admin.get("/plans")
async def list_plans(admin_user=Depends(require_admin)):
    return await plans_list()


@admin.put("/plans")
async def update_plans(data: PlansUpdateInput, admin_user=Depends(require_admin)):
    clean = {}
    for pid in PLAN_ORDER:
        if pid not in data.plans:
            continue
        p = data.plans[pid]
        feats = p.get("features", {}) if isinstance(p, dict) else {}
        clean[pid] = {
            "name": p.get("name"),
            "price": p.get("price", 0),
            "max_invoices": p.get("max_invoices"),
            "max_contacts": p.get("max_contacts"),
            "features": {k: bool(feats.get(k)) for k in ("email", "verifactu", "ocr")},
        }
    await db.global_settings.update_one({"_id": "plans"}, {"$set": {"plans": clean}}, upsert=True)
    await _audit(admin_user["id"], "edit_plans", None)
    result = await plans_list()
    try:
        import stripe_service as ss
        ss.sync_catalog({p["id"]: p for p in result})
    except Exception:
        pass
    return result


@admin.get("/users")
async def list_users(q: str = "", admin_user=Depends(require_admin)):
    query = {}
    if q:
        safe = re.escape(q.strip()[:100])
        query = {"$or": [
            {"email": {"$regex": safe, "$options": "i"}},
            {"name": {"$regex": safe, "$options": "i"}},
        ]}
    users = await db.users.find(query).sort("created_at", -1).to_list(1000)
    return [await _user_row(u) for u in users]


@admin.get("/stats")
async def stats(admin_user=Depends(require_admin)):
    total_users = await db.users.count_documents({})
    blocked = await db.users.count_documents({"is_blocked": True})
    total_invoices = await db.invoices.count_documents({})
    by_plan = {}
    for p in PLAN_ORDER:
        by_plan[p] = await db.users.count_documents({"plan": p, "role": {"$ne": "admin"}})
    clients = await db.users.count_documents({"role": {"$ne": "admin"}})
    active_clients = await db.users.count_documents({"role": {"$ne": "admin"}, "is_blocked": {"$ne": True}})
    bajas = await db.users.count_documents({"role": {"$ne": "admin"}, "is_blocked": True})
    mp = _month_prefix()
    altas_mes = await db.users.count_documents({"role": {"$ne": "admin"}, "created_at": {"$regex": f"^{mp}"}})
    retention_rate = round(active_clients / clients * 100, 1) if clients else 0.0
    churn_rate = round(bajas / clients * 100, 1) if clients else 0.0
    now = datetime.now(timezone.utc)
    total_days, counted = 0, 0
    async for u in db.users.find({"role": {"$ne": "admin"}}, {"created_at": 1}):
        ca = u.get("created_at")
        if not ca:
            continue
        try:
            d = datetime.fromisoformat(ca)
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            total_days += (now - d).days
            counted += 1
        except Exception:
            pass
    avg_permanencia_days = int(round(total_days / counted)) if counted else 0
    return {"total_users": total_users, "blocked": blocked,
            "total_invoices": total_invoices, "by_plan": by_plan,
            "clients": clients, "active_clients": active_clients, "bajas": bajas,
            "altas_mes": altas_mes, "retention_rate": retention_rate,
            "churn_rate": churn_rate, "avg_permanencia_days": avg_permanencia_days}


@admin.get("/audit")
async def audit_log(admin_user=Depends(require_admin)):
    entries = await db.admin_audit.find().sort("at", -1).to_list(100)
    ids = set()
    for e in entries:
        if e.get("actor_id"):
            ids.add(e["actor_id"])
        if e.get("target_id"):
            ids.add(e["target_id"])
    emails = {}
    obj_ids = []
    for i in ids:
        try:
            obj_ids.append(ObjectId(i))
        except Exception:
            pass
    if obj_ids:
        async for u in db.users.find({"_id": {"$in": obj_ids}}, {"email": 1}):
            emails[str(u["_id"])] = u["email"]
    return [{
        "action": e.get("action"),
        "actor_email": emails.get(e.get("actor_id"), "—"),
        "target_email": emails.get(e.get("target_id"), "—") if e.get("target_id") else "—",
        "at": e.get("at"),
    } for e in entries]


@admin.post("/users/{user_id}/block")
async def block_user(user_id: str, admin_user=Depends(require_admin)):
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="No puedes bloquear a un administrador")
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_blocked": True}})
    await _audit(admin_user["id"], "block", user_id)
    return {"status": "ok", "is_blocked": True}


@admin.post("/users/{user_id}/unblock")
async def unblock_user(user_id: str, admin_user=Depends(require_admin)):
    res = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_blocked": False}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await _audit(admin_user["id"], "unblock", user_id)
    return {"status": "ok", "is_blocked": False}


@admin.post("/users/{user_id}/pos-toggle")
async def toggle_pos(user_id: str, admin_user=Depends(require_admin)):
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    new_val = not bool(target.get("pos_enabled", False))
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"pos_enabled": new_val}})
    await _audit(admin_user["id"], f"pos:{'on' if new_val else 'off'}", user_id)
    return {"status": "ok", "is_pos_enabled": new_val}


@admin.post("/users/{user_id}/plan")
async def set_plan(user_id: str, data: PlanInput, admin_user=Depends(require_admin)):
    if data.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Plan no válido")
    res = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"plan": data.plan}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await _audit(admin_user["id"], f"plan:{data.plan}", user_id)
    return {"status": "ok", "plan": data.plan}


# ---------- Gestorías (revendedores) ----------
RESELLER_RATE = 0.5


class GestoriaCreateInput(BaseModel):
    firm_name: str
    email: str
    password: str
    max_clients: int = 0
    iban: str = ""


class GestoriaUpdateInput(BaseModel):
    max_clients: int | None = None
    iban: str | None = None
    is_blocked: bool | None = None


@admin.post("/gestorias")
async def create_gestoria(data: GestoriaCreateInput, admin_user=Depends(require_admin)):
    from auth import hash_password, validate_password_strength
    email = data.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Email no válido")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Este email ya está registrado")
    validate_password_strength(data.password)
    doc = {
        "name": data.firm_name, "firm_name": data.firm_name, "email": email,
        "password_hash": hash_password(data.password), "role": "gestoria",
        "max_clients": int(data.max_clients or 0), "iban": (data.iban or "").strip(),
        "is_blocked": False, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    await _audit(admin_user["id"], "gestoria:create", str(res.inserted_id))
    return {"status": "ok", "id": str(res.inserted_id)}


@admin.get("/gestorias")
async def list_gestorias(admin_user=Depends(require_admin)):
    plans = await load_plans()
    rows = await db.users.find({"role": "gestoria"}).sort("created_at", -1).to_list(1000)
    out = []
    for g in rows:
        gid = str(g["_id"])
        clients = await db.users.find({"gestoria_id": gid}, {"plan": 1}).to_list(100000)
        breakdown = {}
        total_value = 0.0
        for c in clients:
            p = c.get("plan", "basico")
            breakdown[p] = breakdown.get(p, 0) + 1
            total_value += (plans.get(p, {}).get("price", 0) or 0) * RESELLER_RATE
        out.append({
            "id": gid, "firm_name": g.get("firm_name", g.get("name", "")), "email": g["email"],
            "max_clients": int(g.get("max_clients", 0) or 0), "iban": g.get("iban", ""),
            "is_blocked": bool(g.get("is_blocked", False)), "has_logo": bool(g.get("logo")),
            "clients_count": len(clients), "plan_breakdown": breakdown,
            "monthly_value": round(total_value, 2), "created_at": g.get("created_at"),
        })
    return out


@admin.patch("/gestorias/{gid}")
async def update_gestoria(gid: str, data: GestoriaUpdateInput, admin_user=Depends(require_admin)):
    upd = {}
    if data.max_clients is not None:
        upd["max_clients"] = int(data.max_clients or 0)
    if data.iban is not None:
        upd["iban"] = data.iban.strip()
    if data.is_blocked is not None:
        upd["is_blocked"] = bool(data.is_blocked)
    if not upd:
        raise HTTPException(status_code=400, detail="Nada que actualizar")
    res = await db.users.update_one({"_id": ObjectId(gid), "role": "gestoria"}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Gestoría no encontrada")
    await _audit(admin_user["id"], "gestoria:update", gid)
    return {"status": "ok"}


@admin.get("/gestorias/{gid}/clients")
async def gestoria_clients(gid: str, admin_user=Depends(require_admin)):
    plans = await load_plans()
    rows = await db.users.find({"gestoria_id": gid}).sort("created_at", -1).to_list(100000)
    out = []
    for u in rows:
        p = u.get("plan", "basico")
        price = plans.get(p, {}).get("price", 0) or 0
        out.append({
            "id": str(u["_id"]), "name": u.get("name", ""), "email": u.get("email", ""),
            "plan": p, "plan_name": plans.get(p, {}).get("name", p), "plan_price": price,
            "reseller_value": round(price * RESELLER_RATE, 2),
            "is_blocked": bool(u.get("is_blocked", False)),
        })
    return out


def _sepa_link_html(name: str, link: str) -> str:
    saludo = f"Hola {name}," if name else "Hola,"
    return (
        "<div style='font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a'>"
        "<div style='text-align:center;padding:8px 0 18px'><span style='font-size:22px;font-weight:700;color:#0052FF'>openfactura</span></div>"
        "<div style='background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px'>"
        "<h1 style='font-size:19px;margin:0 0 12px'>Domicilia tu pago por SEPA</h1>"
        f"<p style='font-size:15px;line-height:1.6;color:#475569;margin:0 0 8px'>{saludo}</p>"
        "<p style='font-size:15px;line-height:1.6;color:#475569;margin:0 0 22px'>Para activar la domiciliación bancaria de tu cuenta en OpenFactura, "
        "pulsa el botón, introduce tu IBAN y firma el mandato SEPA. Es seguro y solo lleva un minuto.</p>"
        f"<div style='text-align:center;margin:0 0 22px'><a href='{link}' style='display:inline-block;background:#0052FF;color:#fff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px;font-size:15px'>Domiciliar mi cuenta</a></div>"
        f"<p style='font-size:12px;color:#cbd5e1;margin:0;word-break:break-all'>O copia este enlace: {link}</p>"
        "</div></div>"
    )


class SepaLinkInput(BaseModel):
    user_id: str
    origin_url: str = ""


@admin.post("/sepa-link")
async def sepa_link(data: SepaLinkInput, admin_user=Depends(require_admin)):
    import stripe
    from integrations_config import get_stripe
    cfg = await get_stripe()
    stripe.api_key = cfg.get("secret_key") or ""
    u = await db.users.find_one({"_id": ObjectId(data.user_id)})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    cust = u.get("stripe_customer_id")
    if not cust:
        c = stripe.Customer.create(email=u["email"], name=u.get("name", ""), metadata={"user_id": data.user_id})
        cust = c.id
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"stripe_customer_id": cust}})
    origin = (data.origin_url or os.environ.get("APP_BASE_URL", "https://openfactura.es")).rstrip("/")
    try:
        session = stripe.checkout.Session.create(
            mode="setup", customer=cust, payment_method_types=["sepa_debit"],
            success_url=f"{origin}/?sepa=ok", cancel_url=f"{origin}/?sepa=cancel",
            metadata={"user_id": data.user_id, "purpose": "sepa_setup"},
        )
    except stripe.error.StripeError as e:
        logger.error(f"sepa-link failed: {e}")
        raise HTTPException(status_code=502, detail="No pudimos generar el enlace SEPA. Revisa la configuración de Stripe.")
    sent = False
    try:
        import email_service
        await email_service.send_email(to=u["email"], subject="Domicilia tu pago por SEPA · OpenFactura",
                                       html=_sepa_link_html(u.get("name", ""), session.url))
        sent = True
    except Exception as e:
        logger.error(f"sepa-link email failed: {e}")
    await _audit(admin_user["id"], "sepa:link", data.user_id)
    return {"url": session.url, "email_sent": sent, "email": u["email"]}


@admin.post("/impersonate/{user_id}")
async def impersonate(user_id: str, response: Response, admin_user=Depends(require_admin)):
    target = await db.users.find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail="No puedes personificar a otro administrador")
    tid = str(target["_id"])
    _set_cookies(response,
                 create_access_token(tid, target["email"], imp=admin_user["id"]),
                 create_refresh_token(tid, imp=admin_user["id"]))
    await _audit(admin_user["id"], "impersonate", user_id)
    pu = _public_user(target)
    pu["is_impersonating"] = True
    pu["impersonator_id"] = admin_user["id"]
    return pu


@admin.post("/stop-impersonate")
async def stop_impersonate(response: Response, user=Depends(get_current_user)):
    imp = user.get("impersonator_id")
    if not user.get("is_impersonating") or not imp:
        raise HTTPException(status_code=400, detail="No estás personificando a nadie")
    admin_doc = await db.users.find_one({"_id": ObjectId(imp)})
    if not admin_doc:
        raise HTTPException(status_code=401, detail="Administrador no encontrado")
    _set_cookies(response,
                 create_access_token(imp, admin_doc["email"]),
                 create_refresh_token(imp))
    return _public_user(admin_doc)


# ---------- Global template texts (GoRoky) ----------
GOROKY_KEY = "goroky_texts"


@admin.get("/global-templates/goroky")
async def get_global_goroky(admin_user=Depends(require_admin)):
    doc = await db.global_settings.find_one({"_id": GOROKY_KEY}) or {}
    return {
        "legal_notice": doc.get("legal_notice", GOROKY_DEFAULT_LEGAL),
        "footer_message": doc.get("footer_message", GOROKY_DEFAULT_FOOTER),
        "defaults": {"legal_notice": GOROKY_DEFAULT_LEGAL, "footer_message": GOROKY_DEFAULT_FOOTER},
    }


@admin.put("/global-templates/goroky")
async def set_global_goroky(data: GlobalTextsInput, admin_user=Depends(require_admin)):
    await db.global_settings.update_one(
        {"_id": GOROKY_KEY},
        {"$set": {"legal_notice": data.legal_notice, "footer_message": data.footer_message}},
        upsert=True)
    await _audit(admin_user["id"], "edit_global_template:goroky", None)
    return {"status": "ok"}


async def _audit(actor_id: str, action: str, target_id):
    try:
        await db.admin_audit.insert_one({
            "actor_id": actor_id, "action": action, "target_id": target_id,
            "at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass


# ---------- Integraciones (Resend, Stripe, IA) ----------
import integrations_config as ic


class IntegrationsInput(BaseModel):
    resend: dict = {}   # {api_key?, from_email, from_name, reply_to}
    stripe: dict = {}   # {secret_key?, publishable_key, webhook_secret?, mode}
    ai: dict = {}       # {provider, model, openai_key?, groq_key?}


def _mask(v: str) -> str:
    if not v:
        return ""
    return "••••" + v[-4:] if len(v) > 4 else "••••"


@admin.get("/integrations")
async def get_integrations(admin_user=Depends(require_admin)):
    """Devuelve la config con los secretos ENMASCARADOS (nunca en claro)."""
    doc = await db.global_settings.find_one({"_id": "integrations"}) or {}
    r = doc.get("resend", {}); s = doc.get("stripe", {}); a = doc.get("ai", {})
    return {
        "resend": {
            "api_key_set": bool(r.get("api_key")),
            "api_key_hint": _mask(ic._dec(r.get("api_key"))),
            "from_email": r.get("from_email", ""),
            "from_name": r.get("from_name", ""),
            "reply_to": r.get("reply_to", ""),
        },
        "stripe": {
            "secret_key_set": bool(s.get("secret_key")),
            "secret_key_hint": _mask(ic._dec(s.get("secret_key"))),
            "publishable_key": s.get("publishable_key", ""),
            "webhook_secret_set": bool(s.get("webhook_secret")),
            "mode": s.get("mode", "test"),
        },
        "ai": {
            "provider": a.get("provider", "emergent"),
            "model": a.get("model", ""),
            "openai_key_set": bool(a.get("openai_key")),
            "openai_key_hint": _mask(ic._dec(a.get("openai_key"))),
            "groq_key_set": bool(a.get("groq_key")),
            "groq_key_hint": _mask(ic._dec(a.get("groq_key"))),
        },
    }


@admin.put("/integrations")
async def set_integrations(data: IntegrationsInput, admin_user=Depends(require_admin)):
    doc = await db.global_settings.find_one({"_id": "integrations"}) or {}
    resend = dict(doc.get("resend", {}))
    stripe = dict(doc.get("stripe", {}))
    ai = dict(doc.get("ai", {}))

    # Resend
    resend["from_email"] = data.resend.get("from_email", resend.get("from_email", ""))
    resend["from_name"] = data.resend.get("from_name", resend.get("from_name", ""))
    resend["reply_to"] = data.resend.get("reply_to", resend.get("reply_to", ""))
    if data.resend.get("api_key"):  # solo si envían una nueva clave
        resend["api_key"] = ic.enc(data.resend["api_key"])
    if data.resend.get("clear_api_key"):
        resend["api_key"] = ""

    # Stripe
    stripe["publishable_key"] = data.stripe.get("publishable_key", stripe.get("publishable_key", ""))
    stripe["mode"] = data.stripe.get("mode", stripe.get("mode", "test"))
    if data.stripe.get("secret_key"):
        stripe["secret_key"] = ic.enc(data.stripe["secret_key"])
    if data.stripe.get("webhook_secret"):
        stripe["webhook_secret"] = ic.enc(data.stripe["webhook_secret"])

    # IA
    ai["provider"] = data.ai.get("provider", ai.get("provider", "emergent"))
    ai["model"] = data.ai.get("model", ai.get("model", ""))
    if data.ai.get("openai_key"):
        ai["openai_key"] = ic.enc(data.ai["openai_key"])
    if data.ai.get("groq_key"):
        ai["groq_key"] = ic.enc(data.ai["groq_key"])

    await db.global_settings.update_one(
        {"_id": "integrations"},
        {"$set": {"resend": resend, "stripe": stripe, "ai": ai}}, upsert=True)
    await _audit(admin_user["id"], "edit_integrations", None)
    return {"status": "ok"}


class TestEmailInput(BaseModel):
    to: str = ""


@admin.post("/test-email")
async def send_test_email(data: TestEmailInput, admin_user=Depends(require_admin)):
    import email_service
    to = (data.to or admin_user.get("email") or "").strip()
    if not to:
        raise HTTPException(status_code=400, detail="Indica un email de destino.")
    rc = await ic.get_resend()
    provider = "Resend (tu API)" if rc.get("api_key") else "email gestionado"
    html = ("<div style='font-family:Arial,sans-serif;max-width:520px;margin:auto'>"
            "<h2 style='color:#0052FF'>Email de prueba · OpenFactura</h2>"
            "<p>Si estás leyendo esto, tu configuración de envío funciona correctamente. 🎉</p>"
            f"<p style='color:#666;font-size:13px'>Enviado mediante: {provider}.</p></div>")
    mid = await email_service.send_email(
        to=to, subject="Prueba de configuración · OpenFactura", html=html)
    return {"status": "ok", "to": to, "id": mid, "provider": provider}


class BulkEmailInput(BaseModel):
    subject: str
    message: str
    audience: str = "all"  # all | active | blocked


def _bulk_html(subject: str, message: str, name: str) -> str:
    body = html_lib.escape(message)
    body = body.replace("{nombre}", html_lib.escape(name or "")).replace("{name}", html_lib.escape(name or ""))
    body = body.replace("\n", "<br>")
    return (
        "<div style='font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a'>"
        "<div style='text-align:center;padding:8px 0 18px'><span style='font-size:22px;font-weight:700;color:#0052FF'>openfactura</span></div>"
        "<div style='background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px'>"
        f"<h1 style='font-size:19px;margin:0 0 16px'>{html_lib.escape(subject)}</h1>"
        f"<div style='font-size:15px;line-height:1.65;color:#334155'>{body}</div>"
        "</div>"
        "<p style='text-align:center;font-size:12px;color:#94a3b8;margin:16px 0 0'>© OpenFactura · Facturación para autónomos y empresas en España</p>"
        "</div>"
    )


async def _run_broadcast(job_id: str, recipients: list, subject: str, message: str):
    import email_service
    sem = asyncio.Semaphore(5)
    counters = {"sent": 0, "failed": 0}
    total = len(recipients)

    async def _one(r):
        async with sem:
            try:
                await email_service.send_email(
                    to=r["email"], subject=subject, html=_bulk_html(subject, message, r.get("name", "")))
                counters["sent"] += 1
            except Exception as e:
                counters["failed"] += 1
                logger.error(f"broadcast send failed to {r.get('email')}: {e}")
            done = counters["sent"] + counters["failed"]
            if done % 5 == 0 or done == total:
                await db.email_broadcasts.update_one(
                    {"id": job_id}, {"$set": {"sent": counters["sent"], "failed": counters["failed"]}})

    await asyncio.gather(*[_one(r) for r in recipients])
    await db.email_broadcasts.update_one(
        {"id": job_id},
        {"$set": {"sent": counters["sent"], "failed": counters["failed"], "status": "done",
                  "finished_at": datetime.now(timezone.utc).isoformat()}})


@admin.post("/broadcast")
async def broadcast(data: BulkEmailInput, admin_user=Depends(require_admin)):
    subject = (data.subject or "").strip()
    message = (data.message or "").strip()
    if not subject or not message:
        raise HTTPException(status_code=400, detail="Indica un asunto y un mensaje.")
    q = {"role": {"$ne": "admin"}}
    if data.audience == "active":
        q["is_blocked"] = {"$ne": True}
    elif data.audience == "blocked":
        q["is_blocked"] = True
    rows = await db.users.find(q, {"_id": 0, "email": 1, "name": 1}).to_list(100000)
    recipients = [r for r in rows if r.get("email")]
    if not recipients:
        raise HTTPException(status_code=400, detail="No hay destinatarios para ese criterio.")
    job_id = str(uuid.uuid4())
    await db.email_broadcasts.insert_one({
        "id": job_id, "subject": subject, "audience": data.audience,
        "total": len(recipients), "sent": 0, "failed": 0, "status": "sending",
        "created_by": admin_user.get("email"), "created_at": datetime.now(timezone.utc).isoformat(),
    })
    asyncio.create_task(_run_broadcast(job_id, recipients, subject, message))
    return {"job_id": job_id, "total": len(recipients), "status": "sending"}


@admin.get("/broadcast/{job_id}")
async def broadcast_status(job_id: str, admin_user=Depends(require_admin)):
    job = await db.email_broadcasts.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Envío no encontrado")
    return job

