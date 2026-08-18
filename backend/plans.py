from database import db

DEFAULT_PLANS = {
    "basico": {
        "id": "basico", "name": "Básico", "price": 0,
        "max_invoices": 10, "max_contacts": 10,
        "features": {"email": False, "verifactu": False, "ocr": False},
    },
    "medio": {
        "id": "medio", "name": "Medio", "price": 9.99,
        "max_invoices": 100, "max_contacts": 100,
        "features": {"email": True, "verifactu": False, "ocr": True},
    },
    "platino": {
        "id": "platino", "name": "Platino", "price": 24.99,
        "max_invoices": None, "max_contacts": None,
        "features": {"email": True, "verifactu": True, "ocr": True},
    },
}

PLAN_ORDER = ["basico", "medio", "platino"]

TRIAL_PLAN = {
    "id": "trial", "name": "Prueba (14 días)", "price": 0,
    "max_invoices": None, "max_contacts": None,
    "features": {"email": True, "verifactu": True, "ocr": True},
}


def _trial_active(user: dict) -> bool:
    te = user.get("trial_ends_at")
    if not te:
        return False
    try:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc) < datetime.fromisoformat(te)
    except Exception:
        return False

# Backwards-compat alias (static defaults)
PLANS = DEFAULT_PLANS

ADMIN_PLAN = {
    "id": "admin", "name": "Administrador", "price": 0,
    "max_invoices": None, "max_contacts": None,
    "features": {"email": True, "verifactu": True, "ocr": True},
}


def _merge_one(pid: str, override: dict) -> dict:
    base = dict(DEFAULT_PLANS[pid])
    base["features"] = dict(base["features"])
    for k in ("name", "price"):
        if override.get(k) is not None:
            base[k] = override[k]
    # max_invoices / max_contacts: None is a valid value (=ilimitado)
    for k in ("max_invoices", "max_contacts"):
        if k in override:
            base[k] = override[k]
    if isinstance(override.get("features"), dict):
        for fk, fv in override["features"].items():
            base["features"][fk] = bool(fv)
    base["id"] = pid
    return base


async def load_plans() -> dict:
    """Effective plans = defaults merged with admin overrides stored in db.global_settings."""
    doc = await db.global_settings.find_one({"_id": "plans"}) or {}
    overrides = doc.get("plans", {}) or {}
    return {pid: _merge_one(pid, overrides.get(pid, {})) for pid in PLAN_ORDER}


async def plans_list() -> list:
    plans = await load_plans()
    return [plans[pid] for pid in PLAN_ORDER]


async def plan_for_user(user: dict) -> dict:
    if user.get("role") == "admin":
        return dict(ADMIN_PLAN)
    if user.get("plan", "basico") == "basico" and _trial_active(user):
        return dict(TRIAL_PLAN)
    plans = await load_plans()
    return plans.get(user.get("plan", "basico"), plans["basico"])
