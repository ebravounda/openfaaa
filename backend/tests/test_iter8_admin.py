"""Iteration 8: Super Admin panel, plan gating, impersonation, block/unblock,
global GoRoky templates, GoRoky 2-page PDF."""
import os
import io
import uuid
import datetime as dt
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sistema-impuestos.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"


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
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def test_user(admin_client):
    """Create a fresh regular user. Return dict(email, password, id, session)."""
    email = f"iter8_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "TestPass123!"
    s = requests.Session()
    r = _register(s, "Iter8 User", email, pwd)
    assert r.status_code in (200, 201), f"register: {r.status_code} {r.text}"
    # login to set auth header
    _login(s, email, pwd)
    # get id via /auth/me
    me = s.get(f"{API}/auth/me", timeout=15).json()
    uid = me.get("id") or me.get("_id")
    # or lookup from admin
    if not uid:
        users = admin_client.get(f"{API}/admin/users", params={"q": email}, timeout=15).json()
        uid = users[0]["id"]
    yield {"email": email, "password": pwd, "id": uid, "session": s}


# -------- Admin login / role --------
class TestAdminLogin:
    def test_admin_role(self, admin_client):
        r = admin_client.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("role") == "admin"
        assert d.get("email") == ADMIN_EMAIL

    def test_admin_plan(self, admin_client):
        r = admin_client.get(f"{API}/plan", timeout=15)
        assert r.status_code == 200
        assert r.json()["plan"]["id"] == "admin"


# -------- Admin endpoints protected --------
class TestAdminAuthz:
    def test_users_nonadmin_forbidden(self, test_user):
        r = test_user["session"].get(f"{API}/admin/users", timeout=15)
        assert r.status_code == 403

    def test_stats_nonadmin_forbidden(self, test_user):
        r = test_user["session"].get(f"{API}/admin/stats", timeout=15)
        assert r.status_code == 403

    def test_users_admin_ok(self, admin_client, test_user):
        r = admin_client.get(f"{API}/admin/users", timeout=15)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        found = next((u for u in users if u["email"] == test_user["email"]), None)
        assert found is not None
        assert "usage" in found and "plan" in found and "is_blocked" in found

    def test_stats(self, admin_client):
        r = admin_client.get(f"{API}/admin/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_users", "blocked", "total_invoices", "by_plan"):
            assert k in d


# -------- Plan management + limits --------
class TestPlanLimits:
    def test_assign_basico(self, admin_client, test_user):
        r = admin_client.post(f"{API}/admin/users/{test_user['id']}/plan",
                              json={"plan": "basico"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["plan"] == "basico"

    def test_invoice_limit_11th_denied(self, admin_client, test_user):
        s = test_user["session"]
        # ensure basico
        admin_client.post(f"{API}/admin/users/{test_user['id']}/plan", json={"plan": "basico"}, timeout=15)
        # setup minimal company
        s.put(f"{API}/company", json={
            "name": "Test Co", "nif": "12345678Z", "address": "x",
            "email": "", "phone": "", "tax_type": "autonomo",
            "invoice_prefix": "", "rectify_prefix": "R",
        }, timeout=15)
        created = 0
        last = None
        for i in range(11):
            payload = {
                "client": {"name": f"Cli {i}", "nif": "12345678Z", "email": "c@t.com", "address": "x"},
                "line_items": [{"description": "s", "quantity": 1, "unit_price": 10.0}],
                "issue_date": dt.date.today().isoformat(),
            }
            last = s.post(f"{API}/invoices", json=payload, timeout=20)
            if last.status_code in (200, 201):
                created += 1
            else:
                break
        assert last is not None
        assert last.status_code == 403, f"expected 403 on 11th, got {last.status_code}: {last.text}"
        assert "límite" in last.text.lower() or "limite" in last.text.lower()
        assert created == 10

    def test_contact_limit(self, admin_client, test_user):
        s = test_user["session"]
        last = None
        for i in range(11):
            last = s.post(f"{API}/contacts", json={
                "name": f"C{i}_{uuid.uuid4().hex[:4]}", "nif": "", "email": "", "phone": "",
                "address": "", "kind": "client",
            }, timeout=15)
            if last.status_code not in (200, 201):
                break
        assert last.status_code == 403
        assert "límite" in last.text.lower() or "limite" in last.text.lower()

    def test_email_feature_denied_basico(self, test_user):
        # need an invoice id from earlier test — fetch one
        s = test_user["session"]
        invs = s.get(f"{API}/invoices", timeout=15).json()
        if not invs:
            pytest.skip("no invoice available")
        inv_id = invs[0]["id"]
        r = s.post(f"{API}/invoices/{inv_id}/send-email", timeout=15)
        assert r.status_code == 403
        assert "plan" in r.text.lower()

    def test_verifactu_denied_basico(self, test_user):
        s = test_user["session"]
        invs = s.get(f"{API}/invoices", timeout=15).json()
        if not invs:
            pytest.skip("no invoice available")
        inv_id = invs[0]["id"]
        r = s.post(f"{API}/invoices/{inv_id}/verifactu/submit", timeout=15)
        assert r.status_code == 403

    def test_ocr_denied_basico(self, test_user):
        s = test_user["session"]
        files = {"file": ("t.png", b"\x89PNG\r\n\x1a\n" + b"0" * 50, "image/png")}
        r = s.post(f"{API}/expenses/scan", files=files, timeout=15)
        assert r.status_code == 403


# -------- Block / unblock --------
class TestBlockUnblock:
    def test_block_user_prevents_login(self, admin_client, test_user):
        r = admin_client.post(f"{API}/admin/users/{test_user['id']}/block", timeout=15)
        assert r.status_code == 200
        assert r.json()["is_blocked"] is True

        s2 = requests.Session()
        r2 = s2.post(f"{API}/auth/login",
                     json={"email": test_user["email"], "password": test_user["password"]}, timeout=15)
        assert r2.status_code == 403, r2.text
        assert "bloqueada" in r2.text.lower()

    def test_unblock_restores_login(self, admin_client, test_user):
        r = admin_client.post(f"{API}/admin/users/{test_user['id']}/unblock", timeout=15)
        assert r.status_code == 200
        s2 = requests.Session()
        r2 = _login(s2, test_user["email"], test_user["password"])
        assert r2.status_code == 200

    def test_cannot_block_admin(self, admin_client):
        me = admin_client.get(f"{API}/auth/me", timeout=15).json()
        admin_id = me.get("id")
        r = admin_client.post(f"{API}/admin/users/{admin_id}/block", timeout=15)
        assert r.status_code == 400


# -------- Impersonation --------
class TestImpersonation:
    def test_impersonation_flow(self, test_user):
        # Use a fresh cookie-jar session so cookies overwrite properly
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        # DO NOT set Bearer, cookies drive impersonation
        r = s.post(f"{API}/admin/impersonate/{test_user['id']}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("is_impersonating") is True
        assert d.get("email") == test_user["email"]

        # now /auth/me should show target and is_impersonating
        me = s.get(f"{API}/auth/me", timeout=15).json()
        assert me.get("email") == test_user["email"]
        assert me.get("is_impersonating") is True

        # admin endpoints should be 403 while impersonating
        r2 = s.get(f"{API}/admin/users", timeout=15)
        assert r2.status_code == 403, f"impersonating user must not access admin: {r2.status_code}"

        # stop impersonation
        r3 = s.post(f"{API}/admin/stop-impersonate", timeout=15)
        assert r3.status_code == 200
        assert r3.json().get("role") == "admin"

        me2 = s.get(f"{API}/auth/me", timeout=15).json()
        assert me2.get("role") == "admin"
        assert me2.get("email") == ADMIN_EMAIL


# -------- Global GoRoky templates --------
class TestGlobalGoroky:
    def test_put_and_get_global(self, admin_client, test_user):
        payload = {"legal_notice": "AVISO GLOBAL ITER8", "footer_message": "PIE GLOBAL ITER8"}
        r = admin_client.put(f"{API}/admin/global-templates/goroky", json=payload, timeout=15)
        assert r.status_code == 200
        # admin GET
        d = admin_client.get(f"{API}/admin/global-templates/goroky", timeout=15).json()
        assert d["legal_notice"] == payload["legal_notice"]
        assert d["footer_message"] == payload["footer_message"]
        # normal user GET public
        pub = test_user["session"].get(f"{API}/global-templates/goroky", timeout=15).json()
        assert pub["legal_notice"] == payload["legal_notice"]
        assert pub["footer_message"] == payload["footer_message"]


# -------- GoRoky PDF 2-page --------
class TestGorokyPdf:
    def test_goroky_pdf_two_pages(self, admin_client):
        s = admin_client
        # Set admin's company template to goroky (admin has no plan limits)
        cur = s.get(f"{API}/company", timeout=15).json() or {}
        payload = {
            "name": cur.get("name") or "Admin Co", "nif": cur.get("nif") or "12345678Z",
            "address": cur.get("address") or "x", "email": cur.get("email") or "",
            "phone": cur.get("phone") or "", "tax_type": cur.get("tax_type") or "autonomo",
            "invoice_prefix": cur.get("invoice_prefix") or "",
            "rectify_prefix": cur.get("rectify_prefix") or "R",
            "template_id": "goroky",
        }
        r = s.put(f"{API}/company", json=payload, timeout=15)
        assert r.status_code == 200

        inv = {
            "client": {"name": "TEST GoRoky", "nif": "12345678Z", "email": "c@t.com", "address": "x"},
            "line_items": [{"description": "Servicio", "quantity": 1, "unit_price": 100.0}],
            "issue_date": dt.date.today().isoformat(),
            "due_date": (dt.date.today() + dt.timedelta(days=30)).isoformat(),
            "period": "01/2026",
            "payment_method": "Transferencia",
            "iban": "ES9121000418450200051332",
            "concept_label": "Concepto",
            "iva_rate": 21, "irpf_rate": 0,
        }
        r = s.post(f"{API}/invoices", json=inv, timeout=20)
        assert r.status_code in (200, 201), r.text
        inv_id = r.json()["id"]
        try:
            r = s.get(f"{API}/invoices/{inv_id}/pdf", timeout=30)
            assert r.status_code == 200, r.text
            assert r.headers.get("content-type", "").startswith("application/pdf")
            body = r.content
            assert body[:4] == b"%PDF"
            # count pages: crude parse
            pages = body.count(b"/Type /Page")
            if pages == 0:
                pages = body.count(b"/Type/Page")
            assert pages >= 2, f"expected >=2 pages, got {pages}"
        finally:
            s.delete(f"{API}/invoices/{inv_id}", timeout=15)
            # restore template
            payload["template_id"] = cur.get("template_id", "")
            s.put(f"{API}/company", json=payload, timeout=15)
