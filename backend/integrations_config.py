"""Configuración de integraciones gestionada por el Super Admin.

Las claves secretas se guardan CIFRADAS en db.global_settings (_id="integrations")
usando Fernet (cert_service). Los servicios leen de aquí con prioridad sobre el .env.
"""
import os
import cert_service
from database import db

_ID = "integrations"


async def _load() -> dict:
    return await db.global_settings.find_one({"_id": _ID}) or {}


def _dec(v: str) -> str:
    if not v:
        return ""
    try:
        return cert_service.decrypt(v.encode()).decode()
    except Exception:
        return ""


def enc(v: str) -> str:
    return cert_service.encrypt((v or "").encode()).decode()


async def get_stripe() -> dict:
    s = (await _load()).get("stripe", {})
    return {
        "secret_key": _dec(s.get("secret_key")) or os.environ.get("STRIPE_SECRET_KEY", ""),
        "publishable_key": s.get("publishable_key") or os.environ.get("STRIPE_PUBLISHABLE_KEY", ""),
        "webhook_secret": _dec(s.get("webhook_secret")) or os.environ.get("STRIPE_WEBHOOK_SECRET", ""),
        "mode": s.get("mode") or os.environ.get("STRIPE_MODE", "test"),
    }


async def get_ai() -> dict:
    a = (await _load()).get("ai", {})
    return {
        "provider": a.get("provider", "emergent"),  # emergent | openai | groq
        "model": a.get("model", ""),
        "openai_key": _dec(a.get("openai_key")),
        "groq_key": _dec(a.get("groq_key")),
    }


async def get_resend() -> dict:
    r = (await _load()).get("resend", {})
    return {
        "api_key": _dec(r.get("api_key")),
        "from_email": r.get("from_email", ""),
        "from_name": r.get("from_name") or os.environ.get("EMAIL_FROM_NAME", "OpenFactura"),
        "reply_to": r.get("reply_to", ""),
    }
