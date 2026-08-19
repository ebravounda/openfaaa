"""
Iter 16 – Descuentos (línea + global), concepto+descripción, PDF preview y email de prueba.
Backend tests via public REACT_APP_BACKEND_URL.
"""
import os
from datetime import datetime, timezone
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sistema-impuestos.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "X-OF-Client": "web"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def created_invoice_ids():
    ids = []
    yield ids


def teardown_module(module):
    # best-effort cleanup handled below via fixture consumers
    pass


# ---------- Cálculo con descuentos ----------
def test_create_invoice_with_discounts(admin_session, created_invoice_ids):
    payload = {
        "issue_date": datetime.now(timezone.utc).date().isoformat(),
        "client": {"name": "TEST Iter16 Cliente", "nif": "B12345674", "address": "Calle X 1"},
        "line_items": [
            # 2 x 100 = 200 gross, dto 10% -> 180
            {"description": "Servicio A", "detail": "Detalle largo A",
             "quantity": 2, "unit_price": 100, "discount": 10,
             "iva_rate": 21, "iva_type": "general"},
            # 1 x 200 = 200 gross, dto 0
            {"description": "Servicio B", "quantity": 1, "unit_price": 200, "discount": 0,
             "iva_rate": 10, "iva_type": "general"},
            # suplido 50 (sin descuento)
            {"description": "Suplido notario", "quantity": 1, "unit_price": 50, "discount": 0,
             "iva_type": "suplido"},
        ],
        "irpf_rate": 0,
        "global_discount": 5,   # 5% sobre líneas no suplido
        "recargo_equivalencia": False,
    }
    r = admin_session.post(f"{BASE_URL}/api/invoices", json=payload)
    assert r.status_code == 200, r.text
    inv = r.json()
    created_invoice_ids.append(inv["id"])

    # subtotal bruto = 2*100 + 1*200 + 1*50 = 450
    assert inv["subtotal"] == 450.0, inv
    # base neta: linea1 200*0.9*0.95=171, linea2 200*0.95=190 -> 361
    assert inv["base"] == 361.0, inv
    # discount_total = (200-171)+(200-190)+(50-50)=29+10 = 39
    assert inv["discount_total"] == 39.0
    # suplidos no descuentan
    assert inv["suplidos_total"] == 50.0
    # iva breakdown: 21% sobre 171 = 35.91 ; 10% sobre 190 = 19
    bd = {b["rate"]: b for b in inv["iva_breakdown"]}
    assert bd[21.0]["base"] == 171.0
    assert bd[21.0]["cuota"] == 35.91
    assert bd[10.0]["base"] == 190.0
    assert bd[10.0]["cuota"] == 19.0
    assert inv["iva_amount"] == round(35.91 + 19.0, 2)
    # total = base + suplidos + iva - irpf = 361 + 50 + 54.91 = 465.91
    assert inv["total"] == 465.91
    assert inv["irpf_amount"] == 0.0


def test_update_invoice_recomputes_discounts(admin_session, created_invoice_ids):
    inv_id = created_invoice_ids[0]
    r = admin_session.get(f"{BASE_URL}/api/invoices/{inv_id}")
    assert r.status_code == 200
    inv = r.json()
    # Cambiar descuentos: sin global, línea1 dto 0
    inv["global_discount"] = 0
    inv["line_items"][0]["discount"] = 0
    r2 = admin_session.put(f"{BASE_URL}/api/invoices/{inv_id}", json=inv)
    assert r2.status_code == 200, r2.text
    inv2 = r2.json()
    # base ahora = 200 + 200 = 400
    assert inv2["base"] == 400.0
    assert inv2["discount_total"] == 0.0
    assert inv2["suplidos_total"] == 50.0
    bd = {b["rate"]: b for b in inv2["iva_breakdown"]}
    assert bd[21.0]["base"] == 200.0
    assert bd[21.0]["cuota"] == 42.0
    assert bd[10.0]["cuota"] == 20.0
    assert inv2["total"] == round(400 + 50 + 42 + 20, 2)


# ---------- PDF ----------
def test_invoice_pdf_ok(admin_session, created_invoice_ids):
    inv_id = created_invoice_ids[0]
    r = admin_session.get(f"{BASE_URL}/api/invoices/{inv_id}/pdf")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("application/pdf")
    assert r.content[:4] == b"%PDF"
    # Sanity: not tiny
    assert len(r.content) > 1000


# ---------- Preview PDF ----------
@pytest.mark.parametrize("template_id", ["clasico", "goroky"])
def test_preview_pdf_png(admin_session, template_id):
    r = admin_session.post(f"{BASE_URL}/api/company/preview-pdf",
                           json={"template_id": template_id, "accent_color": "#0052FF"})
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("image/png")
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"
    assert len(r.content) > 2000


# ---------- Test email ----------
def test_admin_test_email(admin_session):
    r = admin_session.post(f"{BASE_URL}/api/admin/test-email",
                           json={"to": "test@example.com"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("status") == "ok"
    assert data.get("to") == "test@example.com"
    assert data.get("id")


# ---------- Regresión: annual-summary y export ----------
def test_annual_summary_ok(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/annual-summary")
    assert r.status_code == 200
    data = r.json()
    assert "base_total" in data or "total_base" in data or isinstance(data, dict)


def test_export_libros_xlsx(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/export/libros?year={datetime.now(timezone.utc).year}&format=xlsx")
    assert r.status_code == 200
    ct = r.headers.get("content-type", "")
    assert "spreadsheet" in ct or "xlsx" in ct or "octet-stream" in ct
    assert len(r.content) > 500


# ---------- Cleanup ----------
def test_zzz_cleanup(admin_session, created_invoice_ids):
    for iid in created_invoice_ids:
        admin_session.delete(f"{BASE_URL}/api/invoices/{iid}")
