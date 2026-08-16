"""Iteration 10 - Stripe subscription upgrades + 80% usage warning."""
import datetime as dt
import os
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@fiscalhub.es", "password": "admin123"}


def _new_user():
    email = f"iter10_{uuid.uuid4().hex[:10]}@example.com"
    s = requests.Session()
    r = s.post(f"{API}/auth/register",
               json={"name": "Iter10 User", "email": email, "password": "test1234"})
    assert r.status_code in (200, 201), r.text
    return s, email


def _admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    return s


# -------- Payments checkout --------
class TestCheckout:
    def test_checkout_requires_auth(self):
        r = requests.post(f"{API}/payments/checkout",
                          json={"plan": "medio", "origin_url": BASE_URL})
        assert r.status_code == 401

    def test_checkout_medio(self):
        s, _ = _new_user()
        r = s.post(f"{API}/payments/checkout",
                   json={"plan": "medio", "origin_url": BASE_URL})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["session_id"].startswith("cs_")
        assert "checkout.stripe.com" in d["checkout_url"]

        # status endpoint (unauthenticated) shows pending initially
        r2 = requests.get(f"{API}/payments/status/{d['session_id']}")
        assert r2.status_code == 200, r2.text
        js = r2.json()
        assert js["session_id"] == d["session_id"]
        assert js["plan"] == "medio"
        assert js["payment_status"] in ("pending", "unpaid", "no_payment_required")

    def test_checkout_platino(self):
        s, _ = _new_user()
        r = s.post(f"{API}/payments/checkout",
                   json={"plan": "platino", "origin_url": BASE_URL})
        assert r.status_code == 200, r.text
        assert "checkout.stripe.com" in r.json()["checkout_url"]

    def test_checkout_basico_rejected(self):
        s, _ = _new_user()
        r = s.post(f"{API}/payments/checkout",
                   json={"plan": "basico", "origin_url": BASE_URL})
        assert r.status_code == 400

    def test_checkout_unknown_plan_rejected(self):
        s, _ = _new_user()
        r = s.post(f"{API}/payments/checkout",
                   json={"plan": "diamond", "origin_url": BASE_URL})
        assert r.status_code == 400

    def test_status_unknown_session_404(self):
        r = requests.get(f"{API}/payments/status/cs_unknown_zzz")
        assert r.status_code == 404


# -------- 80% usage warning --------
class TestUsageWarning:
    def _create_invoice(self, s, n):
        payload = {
            "client": {"name": f"TEST Cli {n}", "nif": "12345678Z",
                       "email": "c@t.com", "address": "x"},
            "line_items": [{"description": "s", "quantity": 1, "unit_price": 10.0}],
            "issue_date": dt.date.today().isoformat(),
        }
        return s.post(f"{API}/invoices", json=payload, timeout=20)

    def test_80_percent_and_over_limit(self):
        s, _ = _new_user()
        # basico default: 10 invoices/month
        for i in range(10):
            r = self._create_invoice(s, i)
            assert r.status_code in (200, 201), f"invoice {i}: {r.status_code} {r.text}"

        pl = s.get(f"{API}/plan").json()
        assert pl["usage"]["invoices_month"] == 10
        assert pl["plan"]["max_invoices"] == 10

        # 11th must be blocked
        r = self._create_invoice(s, 11)
        assert r.status_code == 403, r.text
        detail = (r.json().get("detail") or "").lower()
        assert "l" in detail  # límite

    def test_80_percent_threshold_visible(self):
        s, _ = _new_user()
        for i in range(8):
            r = self._create_invoice(s, i)
            assert r.status_code in (200, 201)
        pl = s.get(f"{API}/plan").json()
        assert pl["usage"]["invoices_month"] == 8
        pct = pl["usage"]["invoices_month"] / pl["plan"]["max_invoices"]
        assert pct >= 0.8


# -------- Regression --------
class TestRegression:
    def test_admin_plans_editor_still_works(self):
        s = _admin()
        r = s.get(f"{API}/admin/plans")
        assert r.status_code == 200
        current = r.json()
        # Bump medio price slightly, then restore
        new_plans = {p["id"]: {
            "name": p["name"], "price": p["price"],
            "max_invoices": p["max_invoices"], "max_contacts": p["max_contacts"],
            "features": p["features"],
        } for p in current}
        original_medio = new_plans["medio"]["price"]
        new_plans["medio"]["price"] = 12.34
        r = s.put(f"{API}/admin/plans", json={"plans": new_plans})
        assert r.status_code == 200, r.text
        # verify propagation
        r2 = s.get(f"{API}/plans")
        assert r2.status_code == 200
        assert next(p for p in r2.json() if p["id"] == "medio")["price"] == 12.34
        # restore
        new_plans["medio"]["price"] = original_medio
        r3 = s.put(f"{API}/admin/plans", json={"plans": new_plans})
        assert r3.status_code == 200

    def test_defaults_restored(self):
        s = _admin()
        r = s.get(f"{API}/plans")
        assert r.status_code == 200
        by_id = {p["id"]: p for p in r.json()}
        assert by_id["medio"]["price"] == 9.99
        assert by_id["platino"]["price"] == 24.99

    def test_auth_me_still_works(self):
        s, _ = _new_user()
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json().get("plan") == "basico"
