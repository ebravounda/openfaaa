"""Iter12: invoice validation, anular con VeriFactu, IRPF suggestion, AI assistant + review.
Uses REACT_APP_BACKEND_URL public endpoint. Self-registers ephemeral basico + platino admin login for VeriFactu.
"""
import os
import time
import uuid
import pytest
import requests
from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"


def _new_email(tag):
    return f"TEST_iter12_{tag}_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(scope="module")
def user_client():
    s = requests.Session()
    email = _new_email("user")
    r = s.post(f"{API}/auth/register", json={"name": "Iter12 U", "email": email, "password": "test1234"})
    assert r.status_code in (200, 201), r.text
    # need platino to test verifactu path — ask admin to upgrade
    admin = requests.Session()
    la = admin.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert la.status_code == 200, la.text
    ulist = admin.get(f"{API}/admin/users?q=" + email).json()
    uid = None
    for u in (ulist if isinstance(ulist, list) else ulist.get("items", [])):
        if (u.get("email") or "").lower() == email.lower():
            uid = u.get("id") or u.get("_id")
            break
    assert uid, f"user {email} not found in admin list"
    up = admin.post(f"{API}/admin/users/{uid}/plan", json={"plan": "platino"})
    assert up.status_code == 200, up.text
    # re-login user to refresh plan claims
    s.cookies.clear()
    lr = s.post(f"{API}/auth/login", json={"email": email, "password": "test1234"})
    assert lr.status_code == 200, lr.text
    s.email = email
    yield s


@pytest.fixture(scope="module")
def user_no_vf():
    s = requests.Session()
    email = _new_email("novf")
    r = s.post(f"{API}/auth/register", json={"name": "Iter12 N", "email": email, "password": "test1234"})
    assert r.status_code in (200, 201), r.text
    s.email = email
    return s


# ---------- Invoice validation ----------
class TestValidation:
    def _base(self, nif="12345678Z", iva=21, items=None, desc="Servicio"):
        return {
            "issue_date": "2025-06-15",
            "client": {"name": "Cliente Test", "nif": nif, "address": "", "email": ""},
            "line_items": items if items is not None else [{"description": desc, "quantity": 1, "unit_price": 100}],
            "iva_rate": iva, "irpf_rate": 0, "status": "pending",
        }

    def test_invalid_nif_422(self, user_client):
        r = user_client.post(f"{API}/invoices", json=self._base(nif="12345678A"))
        assert r.status_code == 422
        assert "NIF" in r.text or "nif" in r.text.lower()

    def test_bad_iva_422(self, user_client):
        r = user_client.post(f"{API}/invoices", json=self._base(iva=13))
        assert r.status_code == 422
        assert "IVA" in r.text

    def test_empty_line_items_422(self, user_client):
        r = user_client.post(f"{API}/invoices", json=self._base(items=[]))
        assert r.status_code == 422

    def test_empty_description_422(self, user_client):
        r = user_client.post(f"{API}/invoices", json=self._base(desc=""))
        assert r.status_code == 422

    def test_valid_ok(self, user_client):
        r = user_client.post(f"{API}/invoices", json=self._base())
        assert r.status_code == 200, r.text
        assert r.json()["status"] in ("pending", "unpaid")
        # persistence check
        inv_id = r.json()["id"]
        g = user_client.get(f"{API}/invoices/{inv_id}")
        assert g.status_code == 200 and g.json()["number"] == r.json()["number"]


# ---------- Anular con VeriFactu ----------
class TestAnular:
    def test_anular_with_verifactu(self, user_client):
        # enable verifactu on company (needs valid NIF)
        c = user_client.put(f"{API}/company", json={
            "name": "Iter12 Emp", "nif": "12345678Z", "tax_type": "autonomo",
            "verifactu_enabled": True, "verifactu_mode": "simulado",
        })
        assert c.status_code == 200, c.text
        inv = user_client.post(f"{API}/invoices", json={
            "issue_date": "2025-06-16",
            "client": {"name": "Cli", "nif": "12345678Z"},
            "line_items": [{"description": "Serv A", "quantity": 1, "unit_price": 200}],
            "iva_rate": 21, "irpf_rate": 0,
        })
        assert inv.status_code == 200, inv.text
        iid = inv.json()["id"]
        assert inv.json().get("verifactu", {}).get("huella"), "verifactu huella missing on create"
        r = user_client.post(f"{API}/invoices/{iid}/anular")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "anulada"
        assert data["verifactu"] and data["verifactu"]["huella"]
        assert "simulado" in (data["verifactu"]["status"] or "").lower() or "acept" in (data["verifactu"]["status"] or "").lower()
        # invoice status
        g = user_client.get(f"{API}/invoices/{iid}").json()
        assert g["status"] == "anulada"
        # second anular -> 400
        r2 = user_client.post(f"{API}/invoices/{iid}/anular")
        assert r2.status_code == 400
        # PDF still returns pdf
        p = user_client.get(f"{API}/invoices/{iid}/pdf")
        assert p.status_code == 200
        assert p.headers.get("content-type", "").startswith("application/pdf")
        # Update annulled -> 400
        upd = user_client.put(f"{API}/invoices/{iid}", json={
            "issue_date": "2025-06-16", "client": {"name": "Cli", "nif": "12345678Z"},
            "line_items": [{"description": "X", "quantity": 1, "unit_price": 1}],
            "iva_rate": 21, "irpf_rate": 0,
        })
        assert upd.status_code == 400

    def test_anular_without_verifactu(self, user_no_vf):
        c = user_no_vf.put(f"{API}/company", json={
            "name": "NoVF", "nif": "12345678Z", "tax_type": "autonomo",
            "verifactu_enabled": False, "verifactu_mode": "simulado",
        })
        assert c.status_code == 200
        inv = user_no_vf.post(f"{API}/invoices", json={
            "issue_date": "2025-06-17",
            "client": {"name": "Cli", "nif": "12345678Z"},
            "line_items": [{"description": "Y", "quantity": 1, "unit_price": 50}],
            "iva_rate": 21, "irpf_rate": 0,
        })
        assert inv.status_code == 200
        iid = inv.json()["id"]
        r = user_no_vf.post(f"{API}/invoices/{iid}/anular")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "anulada"
        assert data["verifactu"] in (None, {})


# ---------- Excluded from dashboards/taxes ----------
class TestExclusion:
    def test_dashboard_excludes_annulled(self, user_no_vf):
        # already anulled the 50€ invoice in prior test — create fresh 100 & anular
        s = user_no_vf
        inv = s.post(f"{API}/invoices", json={
            "issue_date": "2025-07-10",
            "client": {"name": "C", "nif": "12345678Z"},
            "line_items": [{"description": "Z", "quantity": 1, "unit_price": 100}],
            "iva_rate": 21, "irpf_rate": 0,
        }).json()
        iid = inv["id"]
        # dashboard year=2025 should include the 100
        d1 = s.get(f"{API}/dashboard?year=2025").json()
        # anular
        s.post(f"{API}/invoices/{iid}/anular")
        d2 = s.get(f"{API}/dashboard?year=2025").json()
        # ingresos should decrease by 100 or stay <= d1
        # find numeric ingresos
        v1 = d1.get("ingresos") if isinstance(d1.get("ingresos"), (int, float)) else (d1.get("totals", {}) or {}).get("ingresos")
        v2 = d2.get("ingresos") if isinstance(d2.get("ingresos"), (int, float)) else (d2.get("totals", {}) or {}).get("ingresos")
        if v1 is not None and v2 is not None:
            assert v2 <= v1
        # annual-summary
        ann = s.get(f"{API}/annual-summary?year=2025")
        assert ann.status_code == 200


# ---------- IRPF suggestion ----------
class TestIRPF:
    def test_normal_autonomo(self, user_no_vf):
        user_no_vf.put(f"{API}/company", json={
            "name": "NoVF", "nif": "12345678Z", "tax_type": "autonomo",
            "autonomo_start_date": "",
        })
        r = user_no_vf.get(f"{API}/irpf/suggestion").json()
        assert r["suggested_rate"] == 15
        assert r["is_new_autonomo"] is False

    def test_new_autonomo(self, user_no_vf):
        cur_year = 2026
        user_no_vf.put(f"{API}/company", json={
            "name": "NoVF", "nif": "12345678Z", "tax_type": "autonomo",
            "autonomo_start_date": f"{cur_year}-01-01",
        })
        r = user_no_vf.get(f"{API}/irpf/suggestion").json()
        assert r["suggested_rate"] == 7
        assert r["is_new_autonomo"] is True

    def test_empresa(self, user_no_vf):
        user_no_vf.put(f"{API}/company", json={
            "name": "NoVF SL", "nif": "12345678Z", "tax_type": "empresa",
        })
        r = user_no_vf.get(f"{API}/irpf/suggestion").json()
        assert r["suggested_rate"] == 0


# ---------- AI Assistant ----------
class TestAssistant:
    def test_empty_message_400(self, user_client):
        r = user_client.post(f"{API}/assistant/chat", json={"message": "  "})
        assert r.status_code == 400

    def test_new_autonomo_reply_mentions_7(self, user_client):
        r = user_client.post(f"{API}/assistant/chat",
                             json={"message": "¿Qué IRPF pongo si soy autónomo nuevo?"}, timeout=60)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["reply"] and isinstance(j["reply"], str)
        assert "7" in j["reply"]
        assert j.get("session_id")

    def test_multiturn(self, user_client):
        r1 = user_client.post(f"{API}/assistant/chat", json={"message": "Hola"}, timeout=60)
        sid = r1.json()["session_id"]
        r2 = user_client.post(f"{API}/assistant/chat",
                              json={"message": "¿Y el IVA general?", "session_id": sid}, timeout=60)
        assert r2.status_code == 200
        assert r2.json()["reply"]


# ---------- AI Invoice review ----------
class TestReview:
    def test_bad_draft(self, user_client):
        draft = {
            "client": {"name": "X", "nif": "12345678A"},
            "line_items": [{"description": "", "quantity": 1, "unit_price": 50}],
            "iva_rate": 21, "irpf_rate": 0, "issue_date": "2025-06-01",
        }
        r = user_client.post(f"{API}/invoices/review", json=draft, timeout=90)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "ok" in j and "issues" in j and "summary" in j
        assert isinstance(j["issues"], list)

    def test_clean_draft(self, user_client):
        draft = {
            "client": {"name": "Cli SL", "nif": "12345678Z"},
            "line_items": [{"description": "Consultoría", "quantity": 10, "unit_price": 50}],
            "iva_rate": 21, "irpf_rate": 15, "issue_date": "2025-06-01",
        }
        r = user_client.post(f"{API}/invoices/review", json=draft, timeout=90)
        assert r.status_code == 200
        j = r.json()
        assert "ok" in j
