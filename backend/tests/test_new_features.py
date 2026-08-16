"""New iteration backend tests: tax_type, contacts, expense scan (OCR), files, dashboard modelo_130, available-years."""
import io
import os
import uuid as _u
import pytest
import requests
from PIL import Image, ImageDraw, ImageFont

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


# ---- Register with tax_type ----
def test_register_with_tax_type_empresa():
    email = f"test_empresa_{_u.uuid4().hex[:8]}@test.es"
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"name": "TEST Empresa User", "email": email, "password": "pass1234",
                     "tax_type": "empresa"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["tax_type"] == "empresa"

    r2 = s.get(f"{BASE_URL}/api/auth/me")
    assert r2.status_code == 200
    assert r2.json()["tax_type"] == "empresa"


def test_register_with_tax_type_autonomo():
    email = f"test_auto_{_u.uuid4().hex[:8]}@test.es"
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"name": "TEST Auto User", "email": email, "password": "pass1234",
                     "tax_type": "autonomo"})
    assert r.status_code == 200
    assert r.json()["tax_type"] == "autonomo"


# ---- Available years ----
def test_available_years(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/available-years")
    assert r.status_code == 200
    years = r.json()
    assert isinstance(years, list)
    from datetime import datetime, timezone
    assert datetime.now(timezone.utc).year in years


# ---- Contacts CRUD ----
def test_contacts_crud(admin_client):
    # Create client
    r1 = admin_client.post(f"{BASE_URL}/api/contacts",
                           json={"name": "TEST_ClientCo", "nif": "B11111111",
                                 "email": "client@t.es", "kind": "client"})
    assert r1.status_code == 200
    client_id = r1.json()["id"]
    assert r1.json()["kind"] == "client"

    # Create provider
    r2 = admin_client.post(f"{BASE_URL}/api/contacts",
                           json={"name": "TEST_Provider", "nif": "B22222222", "kind": "provider"})
    assert r2.status_code == 200
    prov_id = r2.json()["id"]

    # List clients only
    r3 = admin_client.get(f"{BASE_URL}/api/contacts?kind=client")
    assert r3.status_code == 200
    ids = [c["id"] for c in r3.json()]
    assert client_id in ids
    assert prov_id not in ids

    # List providers only
    r4 = admin_client.get(f"{BASE_URL}/api/contacts?kind=provider")
    prov_ids = [c["id"] for c in r4.json()]
    assert prov_id in prov_ids
    assert client_id not in prov_ids

    # Delete both
    assert admin_client.delete(f"{BASE_URL}/api/contacts/{client_id}").status_code == 200
    assert admin_client.delete(f"{BASE_URL}/api/contacts/{prov_id}").status_code == 200


# ---- Dashboard modelo_130 ----
def test_dashboard_with_modelo_130(admin_client):
    r = admin_client.get(f"{BASE_URL}/api/dashboard?year=2026")
    assert r.status_code == 200
    d = r.json()
    assert "tax_type" in d
    assert "modelo_130" in d
    assert isinstance(d["modelo_130"], list)
    assert len(d["modelo_130"]) == 4
    for q in d["modelo_130"]:
        assert "quarter" in q
        assert "rendimiento_acumulado" in q
        assert "irpf_retenido_acumulado" in q
        assert "pago_fraccionado" in q
        assert "deadline" in q
    assert "modelo_130_total" in d


# ---- Files endpoint auth ----
def test_files_requires_auth():
    r = requests.get(f"{BASE_URL}/api/files/some/random/path.jpg")
    assert r.status_code == 401


# ---- Expense scan (OCR) with real ticket image ----
def _make_ticket_image() -> bytes:
    img = Image.new("RGB", (600, 800), "white")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
        small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
    except Exception:
        font = ImageFont.load_default()
        small = font
    lines = [
        ("SUPERMERCADO EJEMPLO S.L.", font),
        ("NIF: B12345678", small),
        ("Calle Mayor 1, Madrid", small),
        ("Fecha: 2026-01-15", small),
        ("", small),
        ("Descripcion: Material oficina", small),
        ("", small),
        ("Base imponible: 95,04 EUR", small),
        ("IVA 21%: 19,96 EUR", small),
        ("TOTAL: 115,00 EUR", font),
        ("", small),
        ("Gracias por su compra", small),
    ]
    y = 40
    for text, f in lines:
        d.text((30, y), text, fill="black", font=f)
        y += 40
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_expense_scan_ocr(admin_client):
    img_bytes = _make_ticket_image()
    files = {"file": ("ticket.jpg", img_bytes, "image/jpeg")}
    # requests session has Content-Type=application/json; must remove for multipart
    headers = {k: v for k, v in admin_client.headers.items() if k.lower() != "content-type"}
    r = requests.post(f"{BASE_URL}/api/expenses/scan", files=files,
                      cookies=admin_client.cookies, headers=headers, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "attachment_path" in data
    assert "extracted" in data
    ex = data["extracted"]
    for key in ("vendor_name", "vendor_nif", "date", "description",
                "category", "base_amount", "iva_rate", "total"):
        assert key in ex, f"missing key {key}"
    assert ex["iva_rate"] in (21, 10, 4, 0)

    # Verify file is downloadable by owner
    path = data["attachment_path"]
    r2 = admin_client.get(f"{BASE_URL}/api/files/{path}")
    assert r2.status_code == 200
    assert len(r2.content) > 100
