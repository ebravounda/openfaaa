"""Backend tests for FiscalHub España - Spanish invoicing system."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sistema-impuestos.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    return s


# -------- Auth --------
def test_auth_me(client):
    r = client.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


def test_login_invalid():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


# -------- Company --------
def test_company_upsert_and_get(client):
    payload = {"name": "TEST_Empresa SL", "nif": "B12345678", "address": "Calle Test 1",
               "email": "empresa@test.es", "phone": "600000000", "tax_type": "empresa"}
    r = client.put(f"{BASE_URL}/api/company", json=payload)
    assert r.status_code == 200
    r2 = client.get(f"{BASE_URL}/api/company")
    assert r2.status_code == 200
    got = r2.json()
    assert got["name"] == "TEST_Empresa SL"
    assert got["nif"] == "B12345678"


# -------- Invoices --------
@pytest.fixture(scope="module")
def created_invoice(client):
    payload = {
        "issue_date": "2026-01-15",
        "client": {"name": "TEST Cliente", "nif": "12345678Z", "email": "delivered@resend.dev", "address": "X"},
        "line_items": [
            {"description": "Servicio A", "quantity": 10, "unit_price": 100},
            {"description": "Servicio B", "quantity": 5, "unit_price": 290},
        ],
        "iva_rate": 21,
        "irpf_rate": 15,
        "status": "pending",
    }
    r = client.post(f"{BASE_URL}/api/invoices", json=payload)
    assert r.status_code == 200, r.text
    inv = r.json()
    yield inv
    client.delete(f"{BASE_URL}/api/invoices/{inv['id']}")


def test_invoice_computation(created_invoice):
    inv = created_invoice
    # base = 10*100 + 5*290 = 2450
    assert inv["base"] == 2450
    assert inv["iva_amount"] == 514.5
    assert inv["irpf_amount"] == 367.5
    assert inv["total"] == 2597
    assert inv["number"].startswith("2026-")


def test_invoice_list(client, created_invoice):
    r = client.get(f"{BASE_URL}/api/invoices")
    assert r.status_code == 200
    ids = [i["id"] for i in r.json()]
    assert created_invoice["id"] in ids


def test_invoice_pdf(client, created_invoice):
    r = client.get(f"{BASE_URL}/api/invoices/{created_invoice['id']}/pdf")
    assert r.status_code == 200
    assert "application/pdf" in r.headers.get("content-type", "")
    assert r.content[:4] == b"%PDF"


def test_invoice_send_email(client, created_invoice):
    r = client.post(f"{BASE_URL}/api/invoices/{created_invoice['id']}/send-email")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "sent"
    assert d["to"] == "delivered@resend.dev"


def test_invoice_send_email_no_client_email(client):
    payload = {
        "issue_date": "2026-02-01",
        "client": {"name": "NoEmail Cliente", "nif": "", "email": "", "address": ""},
        "line_items": [{"description": "X", "quantity": 1, "unit_price": 100}],
        "iva_rate": 21, "irpf_rate": 0, "status": "pending",
    }
    r = client.post(f"{BASE_URL}/api/invoices", json=payload)
    assert r.status_code == 200
    inv = r.json()
    r2 = client.post(f"{BASE_URL}/api/invoices/{inv['id']}/send-email")
    assert r2.status_code == 400
    client.delete(f"{BASE_URL}/api/invoices/{inv['id']}")


def test_invoice_status_toggle(client, created_invoice):
    r = client.patch(f"{BASE_URL}/api/invoices/{created_invoice['id']}/status", json={"status": "paid"})
    assert r.status_code == 200
    r2 = client.get(f"{BASE_URL}/api/invoices/{created_invoice['id']}")
    assert r2.json()["status"] == "paid"


# -------- Expenses --------
def test_expense_create_and_delete(client):
    payload = {"date": "2026-01-20", "vendor_name": "TEST Prov", "vendor_nif": "B00000000",
               "description": "Material", "category": "Oficina", "base_amount": 200, "iva_rate": 21}
    r = client.post(f"{BASE_URL}/api/expenses", json=payload)
    assert r.status_code == 200
    exp = r.json()
    assert exp["base"] == 200
    assert exp["iva_amount"] == 42
    assert exp["total"] == 242

    r2 = client.get(f"{BASE_URL}/api/expenses")
    assert any(e["id"] == exp["id"] for e in r2.json())
    client.delete(f"{BASE_URL}/api/expenses/{exp['id']}")


# -------- Dashboard --------
def test_dashboard(client):
    r = client.get(f"{BASE_URL}/api/dashboard?year=2026")
    assert r.status_code == 200
    d = r.json()
    assert d["year"] == 2026
    assert len(d["quarters"]) == 4
    # Verify deadlines
    dl = {q["quarter"]: q["deadline"] for q in d["quarters"]}
    assert dl[1] == "2026-04-20"
    assert dl[2] == "2026-07-20"
    assert dl[3] == "2026-10-20"
    assert dl[4] == "2027-01-30"


# -------- Register --------
def test_register_new_user():
    import uuid as _u
    email = f"test_{_u.uuid4().hex[:8]}@test.es"
    r = requests.post(f"{BASE_URL}/api/auth/register",
                      json={"name": "TEST User", "email": email, "password": "pass1234"})
    assert r.status_code == 200
    assert r.json()["email"] == email
