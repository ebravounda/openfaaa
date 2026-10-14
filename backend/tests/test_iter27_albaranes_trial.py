"""Iter 27: Albaranes CRUD + facturar + quote preview + company trade_name + trial banner data."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sistema-impuestos.preview.emergentagent.com").rstrip("/")
HEADERS = {"Content-Type": "application/json", "X-OF-Client": "web"}
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASS = "admin123"


# --- Fixtures ---
@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update(HEADERS)
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def trial_user():
    """Register a fresh trial user to test banner data & role=user."""
    s = requests.Session()
    s.headers.update(HEADERS)
    email = f"TEST_trial_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Trial", "last_name": "Test", "email": email, "password": "TestPass123",
        "tax_id": "12345678Z", "tax_type": "autonomo",
    })
    assert r.status_code in (200, 201), r.text
    me = s.get(f"{BASE_URL}/api/auth/me").json()
    return {"session": s, "email": email, "user": me}


# --- Trial banner data ---
def test_trial_user_has_trial_ends_at_and_basic_plan(trial_user):
    u = trial_user["user"]
    assert u.get("role") == "user"
    assert u.get("plan") == "basico"
    assert u.get("trial_ends_at"), "trial_ends_at should be set to 14 days from now"


# --- Company trade_name (Nombre de fantasía) ---
def test_company_trade_name_update_and_persist(trial_user):
    s = trial_user["session"]
    r = s.get(f"{BASE_URL}/api/company")
    assert r.status_code == 200
    original = r.json().get("trade_name", "")

    payload = {**r.json(), "trade_name": "TEST Fantasía SL"}
    # Keep only CompanyInput-compatible fields; backend tolerates extras? use PUT /api/company
    r2 = s.put(f"{BASE_URL}/api/company", json=payload)
    assert r2.status_code == 200, r2.text
    r3 = s.get(f"{BASE_URL}/api/company").json()
    assert r3.get("trade_name") == "TEST Fantasía SL"

    # restore
    s.put(f"{BASE_URL}/api/company", json={**r3, "trade_name": original})


# --- Quote preview PDF ---
def test_quote_preview_pdf(trial_user):
    s = trial_user["session"]
    payload = {
        "issue_date": "2026-01-15",
        "valid_until": "2026-02-15",
        "client": {"name": "TEST Cliente", "nif": "11111111H", "address": "Calle 1", "email": "x@y.com"},
        "line_items": [{"description": "Servicio TEST", "quantity": 1, "unit_price": 100, "iva_rate": 21}],
        "notes": "TEST",
    }
    r = s.post(f"{BASE_URL}/api/quotes/preview-pdf", json=payload)
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert r.content[:4] == b"%PDF"


# --- Albaranes CRUD ---
class TestAlbaranes:
    @pytest.fixture(scope="class")
    def ctx(self, trial_user):
        return {"s": trial_user["session"], "created": []}

    def test_next_number(self, ctx):
        r = ctx["s"].get(f"{BASE_URL}/api/albaranes/next-number?issue_date=2026-01-15")
        assert r.status_code == 200
        n = r.json()["number"]
        assert n.startswith("ALB-2026-"), n

    def _payload(self, nif="11111111H", name="TEST Cliente Alb"):
        return {
            "issue_date": "2026-01-15",
            "delivery_date": "2026-01-16",
            "client": {"name": name, "nif": nif, "address": "Calle Entrega 1", "email": "a@b.com"},
            "delivery_address": "Almacén TEST",
            "line_items": [{"description": "Producto TEST", "quantity": 2, "unit_price": 50, "iva_rate": 21}],
            "show_prices": True,
            "notes": "TEST albarán",
            "status": "pendiente",
        }

    def test_create_and_get(self, ctx):
        r = ctx["s"].post(f"{BASE_URL}/api/albaranes", json=self._payload())
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["number"].startswith("ALB-2026-")
        assert a["status"] == "pendiente"
        assert a["total"] == pytest.approx(121.0, rel=1e-3)
        ctx["created"].append(a["id"])

        g = ctx["s"].get(f"{BASE_URL}/api/albaranes/{a['id']}").json()
        assert g["number"] == a["number"]
        assert g["delivery_address"] == "Almacén TEST"

    def test_preview_pdf(self, ctx):
        r = ctx["s"].post(f"{BASE_URL}/api/albaranes/preview-pdf", json=self._payload())
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_get_pdf(self, ctx):
        aid = ctx["created"][0]
        r = ctx["s"].get(f"{BASE_URL}/api/albaranes/{aid}/pdf")
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_update_status(self, ctx):
        aid = ctx["created"][0]
        r = ctx["s"].patch(f"{BASE_URL}/api/albaranes/{aid}/status", json={"status": "entregado"})
        assert r.status_code == 200
        g = ctx["s"].get(f"{BASE_URL}/api/albaranes/{aid}").json()
        assert g["status"] == "entregado"

    def test_update(self, ctx):
        aid = ctx["created"][0]
        p = self._payload()
        p["notes"] = "TEST actualizado"
        r = ctx["s"].put(f"{BASE_URL}/api/albaranes/{aid}", json=p)
        assert r.status_code == 200
        assert r.json()["notes"] == "TEST actualizado"

    def test_facturar_single_two_different_clients_fails(self, ctx):
        # Create second with different NIF
        r = ctx["s"].post(f"{BASE_URL}/api/albaranes", json=self._payload(nif="22222222J", name="TEST Otro"))
        assert r.status_code == 200
        a2 = r.json()
        ctx["created"].append(a2["id"])

        r = ctx["s"].post(f"{BASE_URL}/api/albaranes/facturar", json={
            "ids": [ctx["created"][0], a2["id"]], "mode": "single", "irpf_rate": 0, "recargo_equivalencia": False})
        assert r.status_code == 400
        assert "mismo cliente" in r.json()["detail"]

    def test_facturar_each_creates_two_invoices(self, ctx):
        ids = ctx["created"][:2]
        r = ctx["s"].post(f"{BASE_URL}/api/albaranes/facturar", json={
            "ids": ids, "mode": "each", "irpf_rate": 0, "recargo_equivalencia": False})
        assert r.status_code == 200, r.text
        invs = r.json()["invoices"]
        assert len(invs) == 2
        # Albaranes now facturado
        for aid in ids:
            g = ctx["s"].get(f"{BASE_URL}/api/albaranes/{aid}").json()
            assert g["status"] == "facturado"
            assert g.get("invoice_number")

    def test_cannot_edit_or_delete_facturado(self, ctx):
        aid = ctx["created"][0]
        r = ctx["s"].put(f"{BASE_URL}/api/albaranes/{aid}", json=self._payload())
        assert r.status_code == 400
        r = ctx["s"].delete(f"{BASE_URL}/api/albaranes/{aid}")
        assert r.status_code == 400

    def test_facturar_already_facturado_rejected(self, ctx):
        aid = ctx["created"][0]
        r = ctx["s"].post(f"{BASE_URL}/api/albaranes/facturar",
                          json={"ids": [aid], "mode": "each"})
        assert r.status_code == 400
        assert "facturad" in r.json()["detail"].lower()

    def test_facturar_single_same_client_two_albaranes(self, ctx):
        # Create two with same NIF
        p1 = self._payload(nif="33333333P", name="TEST Mismo")
        p2 = self._payload(nif="33333333P", name="TEST Mismo")
        a1 = ctx["s"].post(f"{BASE_URL}/api/albaranes", json=p1).json()
        a2 = ctx["s"].post(f"{BASE_URL}/api/albaranes", json=p2).json()
        ctx["created"] += [a1["id"], a2["id"]]
        r = ctx["s"].post(f"{BASE_URL}/api/albaranes/facturar", json={
            "ids": [a1["id"], a2["id"]], "mode": "single"})
        assert r.status_code == 200, r.text
        invs = r.json()["invoices"]
        assert len(invs) == 1
        assert len(invs[0]["albaranes"]) == 2

    def test_desde_presupuesto(self, ctx):
        # Create a quote first
        qpayload = {
            "issue_date": "2026-01-15",
            "valid_until": "2026-02-15",
            "client": {"name": "TEST Q", "nif": "12345678Z", "address": "Addr Q"},
            "line_items": [{"description": "L1", "quantity": 1, "unit_price": 80, "iva_rate": 21}],
        }
        q = ctx["s"].post(f"{BASE_URL}/api/quotes", json=qpayload)
        assert q.status_code == 200
        qid = q.json()["id"]
        r = ctx["s"].post(f"{BASE_URL}/api/albaranes/desde-presupuesto/{qid}")
        assert r.status_code == 200
        a = r.json()
        assert a.get("quote_id") == qid
        assert a.get("quote_number")
        ctx["created"].append(a["id"])

    def test_list(self, ctx):
        r = ctx["s"].get(f"{BASE_URL}/api/albaranes")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert len(r.json()) >= 1


# --- Payments checkout: just verify shape with no stripe_subscription_id ---
def test_payments_checkout_returns_url_for_new_subscriber(trial_user):
    s = trial_user["session"]
    r = s.post(f"{BASE_URL}/api/payments/checkout", json={
        "plan": "medio", "cycle": "monthly", "origin_url": "https://example.com"})
    # Could be 200 with checkout_url, or 500/502 if stripe not configured
    if r.status_code == 200:
        assert r.json().get("checkout_url", "").startswith("http")
    else:
        # Document the failure - should NOT be 400/404 for valid plan
        assert r.status_code in (500, 502), f"Unexpected status: {r.status_code} - {r.text}"
