"""Iteration 9: Expenses CIF lookup, admin-editable plans + gating, public /plans + /plan."""
import os
import uuid
import datetime as dt
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"

DEFAULTS = {
    "basico": {"name": "Básico", "price": 0, "max_invoices": 10, "max_contacts": 10,
               "features": {"email": False, "verifactu": False, "ocr": False}},
    "medio": {"name": "Medio", "price": 9.99, "max_invoices": 100, "max_contacts": 100,
              "features": {"email": True, "verifactu": False, "ocr": True}},
    "platino": {"name": "Platino", "price": 24.99, "max_invoices": None, "max_contacts": None,
                "features": {"email": True, "verifactu": True, "ocr": True}},
}


def _login(session, email, password):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    if r.status_code == 200:
        tok = r.json().get("access_token") or r.json().get("token")
        if tok:
            session.headers["Authorization"] = f"Bearer {tok}"
    return r


def _register(session, name, email, password):
    return session.post(f"{API}/auth/register",
                        json={"name": name, "email": email, "password": password}, timeout=15)


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    r = _login(s, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    yield s
    # teardown: always restore defaults
    s.put(f"{API}/admin/plans", json={"plans": DEFAULTS}, timeout=15)


@pytest.fixture(scope="module")
def basico_user(admin_client):
    email = f"iter9_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "TestPass123!"
    s = requests.Session()
    r = _register(s, "Iter9 User", email, pwd)
    assert r.status_code in (200, 201), r.text
    _login(s, email, pwd)
    me = s.get(f"{API}/auth/me", timeout=15).json()
    uid = me.get("id") or me.get("_id")
    # ensure minimal company for invoice creation
    s.put(f"{API}/company", json={
        "name": "Iter9 Co", "nif": "12345678Z", "address": "x",
        "email": "", "phone": "", "tax_type": "autonomo",
        "invoice_prefix": "", "rectify_prefix": "R",
    }, timeout=15)
    return {"email": email, "password": pwd, "id": uid, "session": s}


# ---------- Public /plans and /plan ----------
class TestPublicPlans:
    def test_plans_list(self, basico_user):
        r = basico_user["session"].get(f"{API}/plans", timeout=15)
        assert r.status_code == 200
        plans = r.json()
        assert isinstance(plans, list) and len(plans) == 3
        ids = [p["id"] for p in plans]
        assert ids == ["basico", "medio", "platino"]
        for p in plans:
            assert "name" in p and "price" in p and "features" in p
            assert set(p["features"].keys()) >= {"email", "verifactu", "ocr"}

    def test_plans_requires_auth(self):
        r = requests.get(f"{API}/plans", timeout=15)
        assert r.status_code in (401, 403)

    def test_my_plan(self, basico_user):
        r = basico_user["session"].get(f"{API}/plan", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "plan" in d and "usage" in d
        assert d["plan"]["id"] == "basico"
        assert "invoices_month" in d["usage"]
        assert "contacts" in d["usage"]


# ---------- Admin plans editor ----------
class TestAdminPlansEditor:
    def test_get_admin_plans(self, admin_client):
        r = admin_client.get(f"{API}/admin/plans", timeout=15)
        assert r.status_code == 200
        plans = r.json()
        assert len(plans) == 3

    def test_nonadmin_forbidden(self, basico_user):
        r = basico_user["session"].get(f"{API}/admin/plans", timeout=15)
        assert r.status_code == 403
        r2 = basico_user["session"].put(f"{API}/admin/plans", json={"plans": DEFAULTS}, timeout=15)
        assert r2.status_code == 403

    def test_put_persists_and_reflects(self, admin_client, basico_user):
        modified = {
            "basico": {"name": "Básico X", "price": 5, "max_invoices": 15, "max_contacts": 10,
                       "features": {"email": False, "verifactu": False, "ocr": True}},
        }
        r = admin_client.put(f"{API}/admin/plans", json={"plans": modified}, timeout=15)
        assert r.status_code == 200
        # verify persisted through admin GET
        plans = admin_client.get(f"{API}/admin/plans", timeout=15).json()
        b = next(p for p in plans if p["id"] == "basico")
        assert b["name"] == "Básico X"
        assert b["price"] == 5
        assert b["max_invoices"] == 15
        assert b["features"]["ocr"] is True

        # public /plans also reflects
        pub = basico_user["session"].get(f"{API}/plans", timeout=15).json()
        pb = next(p for p in pub if p["id"] == "basico")
        assert pb["max_invoices"] == 15
        assert pb["features"]["ocr"] is True

        # /plan for basico user reflects the override
        mp = basico_user["session"].get(f"{API}/plan", timeout=15).json()
        assert mp["plan"]["max_invoices"] == 15
        assert mp["plan"]["features"]["ocr"] is True

    def test_restore_defaults(self, admin_client):
        r = admin_client.put(f"{API}/admin/plans", json={"plans": DEFAULTS}, timeout=15)
        assert r.status_code == 200
        plans = admin_client.get(f"{API}/admin/plans", timeout=15).json()
        b = next(p for p in plans if p["id"] == "basico")
        assert b["max_invoices"] == 10
        assert b["price"] == 0
        assert b["features"]["ocr"] is False


# ---------- Plan overrides affect gating ----------
class TestGatingWithOverrides:
    def test_low_invoice_limit_enforced(self, admin_client, basico_user):
        # Set basico max_invoices to 2 and enable ocr
        override = {
            "basico": {"name": "Básico", "price": 0, "max_invoices": 2, "max_contacts": 10,
                       "features": {"email": False, "verifactu": False, "ocr": True}},
        }
        r = admin_client.put(f"{API}/admin/plans", json={"plans": override}, timeout=15)
        assert r.status_code == 200

        s = basico_user["session"]
        # Existing invoices count towards the month — count first
        cur = s.get(f"{API}/plan", timeout=15).json()
        already = cur["usage"]["invoices_month"]
        # The new limit is 2. If already >=2, next post should be 403.
        # If < 2, create invoices up to 2 then verify next is 403.
        last = None
        for i in range(max(0, 2 - already) + 1):
            payload = {
                "client": {"name": f"Cli9 {i}", "nif": "12345678Z", "email": "c@t.com", "address": "x"},
                "line_items": [{"description": "s", "quantity": 1, "unit_price": 10.0}],
                "issue_date": dt.date.today().isoformat(),
            }
            last = s.post(f"{API}/invoices", json=payload, timeout=20)
            if last.status_code == 403:
                break
        assert last is not None
        assert last.status_code == 403, f"expected 403, got {last.status_code}: {last.text[:200]}"

    def test_ocr_enabled_via_override(self, admin_client, basico_user):
        # override still has features.ocr=true from previous test — but ensure it
        override = {
            "basico": {"name": "Básico", "price": 0, "max_invoices": 2, "max_contacts": 10,
                       "features": {"email": False, "verifactu": False, "ocr": True}},
        }
        admin_client.put(f"{API}/admin/plans", json={"plans": override}, timeout=15)

        s = basico_user["session"]
        # tiny fake image - OCR endpoint may return 400 for bad image, but must NOT be 403 plan-denied
        files = {"file": ("t.png", b"\x89PNG\r\n\x1a\n" + b"0" * 50, "image/png")}
        r = s.post(f"{API}/expenses/scan", files=files, timeout=30)
        assert r.status_code != 403, f"OCR should be enabled via override but got 403: {r.text[:200]}"

    def test_restore_defaults_after(self, admin_client):
        r = admin_client.put(f"{API}/admin/plans", json={"plans": DEFAULTS}, timeout=15)
        assert r.status_code == 200


# ---------- CIF lookup for expense provider ----------
class TestExpenseNifLookup:
    def test_lookup_from_saved_provider(self, admin_client):
        """Reuses the shared lookup endpoint. Create a provider contact under admin and look it up."""
        s = admin_client
        nif = "B12345674"
        provider_name = f"TEST Iter9 Provider {uuid.uuid4().hex[:4]}"
        # Create as provider contact
        r = s.post(f"{API}/contacts", json={
            "name": provider_name, "nif": nif, "email": "p@t.com", "phone": "",
            "address": "C/ Test 1", "kind": "provider",
        }, timeout=15)
        assert r.status_code in (200, 201), r.text
        cid = r.json().get("id")
        try:
            # Lookup
            r2 = s.get(f"{API}/lookup/nif", params={"nif": nif}, timeout=15)
            assert r2.status_code == 200, r2.text
            d = r2.json()
            assert d.get("valid") is True
            assert d.get("name") == provider_name
            assert d.get("source", "").lower().startswith("contactos")
        finally:
            if cid:
                s.delete(f"{API}/contacts/{cid}", timeout=15)

    def test_lookup_empty_returns_400(self, admin_client):
        r = admin_client.get(f"{API}/lookup/nif", params={"nif": ""}, timeout=15)
        assert r.status_code == 400
