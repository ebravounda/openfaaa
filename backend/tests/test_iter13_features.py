"""Backend tests for iteration 13: trial, yearly checkout, admin revenue, landing/legal pages."""
import os
import uuid
import requests
from datetime import datetime, timezone
from pathlib import Path

def _load_frontend_url():
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL missing")

BASE_URL = _load_frontend_url().rstrip("/") + "/api"

ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"


def _login(session, email, password):
    r = session.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def _register_new_user(session):
    email = f"TEST_trial_{uuid.uuid4().hex[:8]}@example.com"
    r = session.post(f"{BASE_URL}/auth/register", json={
        "name": "Trial User", "email": email, "password": "test1234",
        "tax_type": "autonomo", "activity": ""
    })
    assert r.status_code == 200, r.text
    return email, r.json()


# --- Trial on registration ---
def test_register_grants_14day_trial():
    s = requests.Session()
    email, data = _register_new_user(s)
    # user object should contain trial_ends_at in the future
    trial = data.get("user", {}).get("trial_ends_at") or data.get("trial_ends_at")
    assert trial, f"No trial_ends_at in register response: {data}"
    end = datetime.fromisoformat(trial.replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    delta_days = (end - now).days
    assert 12 <= delta_days <= 15, f"Trial should be ~14 days, got {delta_days}"


def test_plan_endpoint_returns_trial_for_new_user():
    s = requests.Session()
    _register_new_user(s)
    r = s.get(f"{BASE_URL}/plan")
    assert r.status_code == 200, r.text
    body = r.json()
    plan = body.get("plan", {})
    assert plan.get("id") == "trial", f"Expected trial plan, got {plan}"
    # trial should have features unlocked (like paid plan)
    features = plan.get("features", {})
    assert features.get("verifactu") is True
    assert features.get("email") is True


# --- Admin revenue endpoint ---
def test_admin_revenue_endpoint():
    s = requests.Session()
    _login(s, ADMIN_EMAIL, ADMIN_PASSWORD)
    r = s.get(f"{BASE_URL}/admin/revenue")
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ("mrr", "arr", "by_plan", "altas_mes", "trials_activos"):
        assert key in data, f"Missing key {key} in {data}"
    assert isinstance(data["by_plan"], dict)
    for pid in ("basico", "medio", "platino"):
        assert pid in data["by_plan"]
    # ARR should equal MRR*12
    assert abs(data["arr"] - data["mrr"] * 12) < 0.01
    # trials_activos should be >= 1 since we just created trial users
    assert data["trials_activos"] >= 0


def test_admin_revenue_requires_admin():
    s = requests.Session()
    _register_new_user(s)
    r = s.get(f"{BASE_URL}/admin/revenue")
    assert r.status_code in (401, 403)


# --- Yearly checkout ---
def test_yearly_checkout_returns_stripe_url():
    s = requests.Session()
    _register_new_user(s)
    r = s.post(f"{BASE_URL}/payments/checkout", json={
        "plan": "medio", "cycle": "yearly",
        "origin_url": "https://example.com"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "checkout_url" in data
    assert "checkout.stripe.com" in data["checkout_url"], data["checkout_url"]


def test_monthly_checkout_returns_stripe_url():
    s = requests.Session()
    _register_new_user(s)
    r = s.post(f"{BASE_URL}/payments/checkout", json={
        "plan": "medio", "cycle": "monthly",
        "origin_url": "https://example.com"
    })
    assert r.status_code == 200, r.text
    assert "checkout.stripe.com" in r.json()["checkout_url"]


# --- Plans endpoint returns 3 plans (used by pricing toggle) ---
def test_plans_list():
    s = requests.Session()
    _register_new_user(s)
    r = s.get(f"{BASE_URL}/plans")
    assert r.status_code == 200
    plans = r.json()
    ids = [p["id"] for p in plans]
    assert set(ids) >= {"basico", "medio", "platino"}
