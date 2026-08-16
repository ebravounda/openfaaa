PLANS = {
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


def get_plan(plan_id: str) -> dict:
    return PLANS.get(plan_id or "basico", PLANS["basico"])


def plan_for_user(user: dict) -> dict:
    # Admin has no limits and all features
    if user.get("role") == "admin":
        return {"id": "admin", "name": "Administrador", "price": 0,
                "max_invoices": None, "max_contacts": None,
                "features": {"email": True, "verifactu": True, "ocr": True}}
    return get_plan(user.get("plan", "basico"))
