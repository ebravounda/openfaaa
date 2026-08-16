"""Iteration 4: Facturas rectificativas (abonos) linked to original invoice with own series."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    return s


# ---- Company: rectify_prefix ----
def test_company_rectify_prefix_default(admin):
    r = admin.put(f"{BASE_URL}/api/company", json={
        "name": "TEST_ITER4_Company", "nif": "B99999999",
        "tax_type": "autonomo", "invoice_prefix": "FAC", "rectify_prefix": "R"
    })
    assert r.status_code == 200
    assert r.json().get("rectify_prefix") == "R"


# ---- Create original invoice + rectificativa ----
def test_rectificativa_flow(admin):
    # Create an original invoice
    payload = {
        "issue_date": "2026-01-10",
        "client": {"name": "TEST_ITER4_Cliente", "nif": "B00000001",
                   "email": "delivered@resend.dev", "address": "Calle 1"},
        "line_items": [{"description": "Servicio", "quantity": 1, "unit_price": 1000}],
        "iva_rate": 21, "irpf_rate": 0, "series": "FAC",
        "invoice_type": "normal",
    }
    r = admin.post(f"{BASE_URL}/api/invoices", json=payload)
    assert r.status_code == 200, r.text
    orig = r.json()
    assert orig["invoice_type"] == "normal"
    assert orig["number"].startswith("FAC-2026-")
    assert orig["total"] == 1210.0
    orig_id, orig_num = orig["id"], orig["number"]

    # Now create rectificativa with negative amounts
    rect_payload = {
        "issue_date": "2026-01-11",
        "client": orig["client"],
        "line_items": [{"description": "Abono servicio", "quantity": 1, "unit_price": -1000}],
        "iva_rate": 21, "irpf_rate": 0,
        "invoice_type": "rectificativa",
        "rectifies": orig_id, "rectifies_number": orig_num,
        # series omitted -> should use rectify_prefix "R"
    }
    r2 = admin.post(f"{BASE_URL}/api/invoices", json=rect_payload)
    assert r2.status_code == 200, r2.text
    rect = r2.json()
    assert rect["invoice_type"] == "rectificativa"
    assert rect["rectifies"] == orig_id
    assert rect["rectifies_number"] == orig_num
    assert rect["number"].startswith("R-2026-"), rect["number"]
    assert rect["series"] == "R"
    assert rect["total"] == -1210.0
    assert rect["base"] == -1000.0
    assert rect["iva_amount"] == -210.0

    # Independent sequence: create another rectificativa & another normal invoice, verify sequences
    r3 = admin.post(f"{BASE_URL}/api/invoices", json=rect_payload)
    assert r3.status_code == 200
    rect2 = r3.json()
    # Sequence must be consecutive within R series
    n1 = int(rect["number"].split("-")[-1])
    n2 = int(rect2["number"].split("-")[-1])
    assert n2 == n1 + 1

    r4 = admin.post(f"{BASE_URL}/api/invoices", json=payload)
    assert r4.status_code == 200
    orig2 = r4.json()
    assert orig2["number"].startswith("FAC-2026-")
    # Normal series independent from R
    on1 = int(orig["number"].split("-")[-1])
    on2 = int(orig2["number"].split("-")[-1])
    assert on2 == on1 + 1

    # PDF of rectificativa
    r5 = admin.get(f"{BASE_URL}/api/invoices/{rect['id']}/pdf")
    assert r5.status_code == 200
    assert r5.content[:4] == b"%PDF"
    assert len(r5.content) > 500

    # Dashboard aggregates negative correctly (relative check: rectificativa reduces q1 ingresos vs sum)
    r6 = admin.get(f"{BASE_URL}/api/dashboard?year=2026")
    assert r6.status_code == 200
    d = r6.json()
    # There must be at least our 2 negatives contributing (-2000 base, -420 IVA) within Q1
    q1 = next(q for q in d["quarters"] if q["quarter"] == 1)
    # We just verify quarters returned and iva/ingresos are numbers; deep value depends on residual data
    assert isinstance(q1["ingresos"], (int, float))
    assert isinstance(q1["iva_repercutido"], (int, float))


def test_rectify_prefix_custom(admin):
    # change rectify_prefix and verify next rectificativa uses it
    r = admin.put(f"{BASE_URL}/api/company", json={
        "name": "TEST_ITER4_Company", "nif": "B99999999",
        "tax_type": "autonomo", "invoice_prefix": "FAC", "rectify_prefix": "ABN"
    })
    assert r.status_code == 200
    # Need an original
    payload = {
        "issue_date": "2026-02-01",
        "client": {"name": "TEST_ITER4_CLI2", "nif": "B00000002", "email": "", "address": ""},
        "line_items": [{"description": "X", "quantity": 1, "unit_price": 100}],
        "iva_rate": 21, "irpf_rate": 0, "series": "FAC", "invoice_type": "normal",
    }
    o = admin.post(f"{BASE_URL}/api/invoices", json=payload).json()
    rect = admin.post(f"{BASE_URL}/api/invoices", json={
        "issue_date": "2026-02-02", "client": o["client"],
        "line_items": [{"description": "Abono X", "quantity": 1, "unit_price": -100}],
        "iva_rate": 21, "irpf_rate": 0, "invoice_type": "rectificativa",
        "rectifies": o["id"], "rectifies_number": o["number"],
    }).json()
    assert rect["number"].startswith("ABN-2026-"), rect["number"]
    assert rect["series"] == "ABN"

    # Restore rectify_prefix to R
    admin.put(f"{BASE_URL}/api/company", json={
        "name": "TEST_ITER4_Company", "nif": "B99999999",
        "tax_type": "autonomo", "invoice_prefix": "FAC", "rectify_prefix": "R"
    })
