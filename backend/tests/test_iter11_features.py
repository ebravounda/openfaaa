"""Iteration 11 tests: activity-based templates, payment history, customer portal, admin audit log."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"


def _register(name, email, password, activity=None):
    payload = {"name": name, "email": email, "password": password}
    if activity is not None:
        payload["activity"] = activity
    return requests.post(f"{API}/auth/register", json=payload)


def _login(email, password):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": password})


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def user_electricista():
    email = f"TEST_iter11_elec_{uuid.uuid4().hex[:8]}@example.com"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "name": "Elec User", "email": email, "password": "test1234", "activity": "electricista"
    })
    assert r.status_code == 200, r.text
    return {"session": s, "email": email, "id": r.json()["id"]}


@pytest.fixture(scope="module")
def user_no_activity():
    email = f"TEST_iter11_noact_{uuid.uuid4().hex[:8]}@example.com"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "name": "NoAct User", "email": email, "password": "test1234"
    })
    assert r.status_code == 200, r.text
    return {"session": s, "email": email, "id": r.json()["id"]}


@pytest.fixture(scope="module")
def user_invalid_activity():
    email = f"TEST_iter11_inv_{uuid.uuid4().hex[:8]}@example.com"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "name": "Inv User", "email": email, "password": "test1234", "activity": "not_a_real_activity"
    })
    assert r.status_code == 200, r.text
    return {"session": s, "email": email, "id": r.json()["id"]}


# ---------- Feature 4: activity at registration ----------
class TestActivityRegistration:
    def test_register_stores_activity_electricista(self, user_electricista):
        r = user_electricista["session"].get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json().get("activity") == "electricista"

    def test_company_stub_suggests_activity_template(self, user_electricista):
        r = user_electricista["session"].get(f"{API}/company")
        assert r.status_code == 200
        body = r.json()
        assert body.get("template_id") == "electricista"

    def test_register_no_activity_defaults_clasico(self, user_no_activity):
        r = user_no_activity["session"].get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json().get("activity", "") == ""
        r2 = user_no_activity["session"].get(f"{API}/company")
        assert r2.status_code == 200
        assert r2.json().get("template_id") == "clasico"

    def test_register_invalid_activity_defaults_clasico(self, user_invalid_activity):
        r = user_invalid_activity["session"].get(f"{API}/auth/me")
        assert r.status_code == 200
        # Invalid activity should not be stored
        assert r.json().get("activity", "") == ""
        r2 = user_invalid_activity["session"].get(f"{API}/company")
        assert r2.status_code == 200
        assert r2.json().get("template_id") == "clasico"


# ---------- Feature 2: payment history ----------
class TestPaymentHistory:
    def test_history_empty_for_basico_no_stripe(self, user_electricista):
        r = user_electricista["session"].get(f"{API}/payments/history")
        assert r.status_code == 200
        assert r.json() == []

    def test_history_requires_auth(self):
        r = requests.get(f"{API}/payments/history")
        assert r.status_code == 401


# ---------- Feature 1: customer portal ----------
class TestCustomerPortal:
    def test_portal_400_no_stripe_customer(self, user_electricista):
        r = user_electricista["session"].post(f"{API}/payments/portal",
                                              json={"return_url": "https://example.com/precios"})
        assert r.status_code == 400
        assert "suscripci" in r.json().get("detail", "").lower()

    def test_portal_requires_auth(self):
        r = requests.post(f"{API}/payments/portal", json={"return_url": "https://example.com/precios"})
        assert r.status_code == 401


# ---------- Feature 3: admin audit log ----------
class TestAdminAudit:
    def test_audit_requires_admin(self, user_electricista):
        r = user_electricista["session"].get(f"{API}/admin/audit")
        assert r.status_code == 403

    def test_audit_unauthenticated(self):
        r = requests.get(f"{API}/admin/audit")
        assert r.status_code == 401

    def test_audit_returns_list_with_enriched_fields(self, admin_session):
        r = admin_session.get(f"{API}/admin/audit")
        assert r.status_code == 200
        body = r.json()
        assert isinstance(body, list)
        if body:
            e = body[0]
            for k in ("action", "actor_email", "target_email", "at"):
                assert k in e, f"missing key {k}"

    def test_audit_new_entry_appears_after_block(self, admin_session, user_no_activity):
        # snapshot count
        before = admin_session.get(f"{API}/admin/audit").json()
        n_before = len(before)
        # block the user
        uid = user_no_activity["id"]
        b = admin_session.post(f"{API}/admin/users/{uid}/block")
        assert b.status_code == 200
        after = admin_session.get(f"{API}/admin/audit").json()
        assert len(after) >= n_before + 1
        # Newest first
        top = after[0]
        assert top["action"] == "block"
        assert top["actor_email"] == ADMIN_EMAIL
        assert top["target_email"].lower() == user_no_activity["email"].lower()
        # unblock cleanup
        admin_session.post(f"{API}/admin/users/{uid}/unblock")


# ---------- Regression ----------
class TestRegression:
    def test_checkout_medio_returns_stripe_url(self, user_electricista):
        r = user_electricista["session"].post(f"{API}/payments/checkout",
                                              json={"plan": "medio",
                                                    "origin_url": "https://example.com"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "checkout.stripe.com" in body.get("checkout_url", "")
        assert body.get("session_id", "").startswith("cs_")

    def test_checkout_platino_returns_stripe_url(self, user_electricista):
        r = user_electricista["session"].post(f"{API}/payments/checkout",
                                              json={"plan": "platino",
                                                    "origin_url": "https://example.com"})
        assert r.status_code == 200, r.text
        assert "checkout.stripe.com" in r.json().get("checkout_url", "")

    def test_admin_plans_defaults_restored(self, admin_session):
        r = admin_session.get(f"{API}/admin/plans")
        assert r.status_code == 200
        plans = {p["id"]: p for p in r.json()}
        assert plans["medio"]["price"] == 9.99
        assert plans["platino"]["price"] == 24.99

    def test_global_templates_goroky_still_works(self, admin_session):
        r = admin_session.get(f"{API}/admin/global-templates/goroky")
        assert r.status_code == 200
        assert "legal_notice" in r.json()
