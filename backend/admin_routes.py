from datetime import datetime, timezone
import re

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
        "email": u.get("email", ""),
        "role": u.get("role", "user"),
        "plan": u.get("plan", "basico"),
        "is_blocked": bool(u.get("is_blocked", False)),
        "created_at": u.get("created_at"),
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
    return {"total_users": total_users, "blocked": blocked,
            "total_invoices": total_invoices, "by_plan": by_plan}


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


@admin.post("/users/{user_id}/plan")
async def set_plan(user_id: str, data: PlanInput, admin_user=Depends(require_admin)):
    if data.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Plan no válido")
    res = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"plan": data.plan}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await _audit(admin_user["id"], f"plan:{data.plan}", user_id)
    return {"status": "ok", "plan": data.plan}


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

