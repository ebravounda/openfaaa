"""Iteration 5: VeriFactu chained fingerprint, submit simulation, and Annual Summary (Modelo 390 + IRPF)."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    r = sess.post(f"{BASE_URL}/api/auth/login",
                  json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return sess


def _set_verifactu(s, enabled: bool):
    # fetch current company to keep required fields
    r = s.get(f"{BASE_URL}/api/company")
    assert r.status_code == 200
    c = r.json() or {}
    payload = {
        "name": c.get("name") or "TEST Company",
        "nif": c.get("nif") or "B99999999",
        "address": c.get("address") or "Calle Test 1",
        "email": c.get("email") or "test@empresa.es",
        "phone": c.get("phone") or "",
        "invoice_prefix": c.get("invoice_prefix", "FAC"),
        "rectify_prefix": c.get("rectify_prefix", "R"),
        "verifactu_enabled": enabled,
    }
    r2 = s.put(f"{BASE_URL}/api/company", json=payload)
    assert r2.status_code == 200, r2.text
    return r2.json()


def _make_invoice(s, client_name="TEST_VF_Cliente", price=100.0, invoice_type="normal", rectifies=None):
    body = {
        "issue_date": "2026-03-05",
        "client": {"name": client_name, "nif": "B12312312", "address": "X", "email": "c@t.es"},
        "line_items": [{"description": "Servicio", "quantity": 1, "unit_price": price}],
        "iva_rate": 21,
        "irpf_rate": 0,
        "notes": "",
        "status": "pending",
        "invoice_type": invoice_type,
    }
    if rectifies:
        body["rectifies"] = rectifies
    r = s.post(f"{BASE_URL}/api/invoices", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_company_verifactu_persists(s):
    c = _set_verifactu(s, True)
    assert c["verifactu_enabled"] is True
    r = s.get(f"{BASE_URL}/api/company")
    assert r.status_code == 200
    assert r.json()["verifactu_enabled"] is True


def test_invoice_created_with_verifactu_chain(s):
    _set_verifactu(s, True)
    inv1 = _make_invoice(s, price=100.0)
    assert "verifactu" in inv1
    vf1 = inv1["verifactu"]
    assert vf1["tipo"] == "F1"
    assert re.fullmatch(r"[0-9A-F]{64}", vf1["huella"]), f"Huella not SHA256 hex upper: {vf1['huella']}"
    # First one: previous should be either empty OR the huella of the previous VF invoice in db
    prev_first = vf1["huella_anterior"]
    assert isinstance(prev_first, str)
    assert prev_first == "" or re.fullmatch(r"[0-9A-F]{64}", prev_first)
    assert "ValidarQR" in vf1["qr_url"]
    assert vf1["status"] == "Registrado (pendiente de envío)"
    assert vf1.get("submitted") is False

    inv2 = _make_invoice(s, price=250.0)
    vf2 = inv2["verifactu"]
    assert vf2["huella_anterior"] == vf1["huella"], "Chain broken: inv2.huella_anterior must equal inv1.huella"
    assert vf2["huella"] != vf1["huella"]

    # Rectificativa -> tipo R1
    invR = _make_invoice(s, client_name="TEST_VF_Cliente", price=50.0,
                        invoice_type="rectificativa", rectifies=inv1["number"])
    assert invR["verifactu"]["tipo"] == "R1"
    assert invR["verifactu"]["huella_anterior"] == vf2["huella"]


def test_invoice_without_verifactu_when_disabled(s):
    _set_verifactu(s, False)
    inv = _make_invoice(s, price=42.0)
    assert "verifactu" not in inv or not inv.get("verifactu")
    # re-enable for other tests
    _set_verifactu(s, True)


def test_submit_and_idempotent(s):
    _set_verifactu(s, True)
    inv = _make_invoice(s, price=77.0)
    r = s.post(f"{BASE_URL}/api/invoices/{inv['id']}/verifactu/submit")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["status"] == "Aceptado por la AEAT (simulado)"
    assert d["csv"].startswith("VF-")
    # idempotent
    r2 = s.post(f"{BASE_URL}/api/invoices/{inv['id']}/verifactu/submit")
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2.get("already") is True
    assert d2["csv"] == d["csv"]

    # Confirm persistence
    inv_after = s.get(f"{BASE_URL}/api/invoices/{inv['id']}").json()
    assert inv_after["verifactu"]["submitted"] is True
    assert inv_after["verifactu"]["csv"] == d["csv"]


def test_submit_without_verifactu_returns_400(s):
    _set_verifactu(s, False)
    inv = _make_invoice(s, price=10.0)
    r = s.post(f"{BASE_URL}/api/invoices/{inv['id']}/verifactu/submit")
    assert r.status_code == 400
    _set_verifactu(s, True)


def test_pdf_of_verifactu_invoice(s):
    _set_verifactu(s, True)
    inv = _make_invoice(s, price=88.0)
    r = s.get(f"{BASE_URL}/api/invoices/{inv['id']}/pdf")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/pdf")
    assert r.content[:4] == b"%PDF"
    assert len(r.content) > 2000


def test_annual_summary_structure(s):
    r = s.get(f"{BASE_URL}/api/annual-summary?year=2026")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["year"] == 2026
    assert "modelo_390" in d and "irpf" in d
    m390 = d["modelo_390"]
    for key in ("iva_repercutido", "iva_soportado", "total_cuota_repercutida",
                "total_cuota_soportada", "resultado_anual"):
        assert key in m390
    rates_rep = {row["rate"] for row in m390["iva_repercutido"]}
    rates_sop = {row["rate"] for row in m390["iva_soportado"]}
    assert rates_rep == {21, 10, 4, 0}
    assert rates_sop == {21, 10, 4, 0}
    for row in m390["iva_repercutido"]:
        assert "base" in row and "cuota" in row
    # Numeric consistency
    assert round(m390["total_cuota_repercutida"] - m390["total_cuota_soportada"], 2) == m390["resultado_anual"]

    irpf = d["irpf"]
    for key in ("ingresos", "gastos", "rendimiento_neto", "retenciones_soportadas",
                "pagos_fraccionados_130", "cuota_estimada"):
        assert key in irpf
    assert round(irpf["ingresos"] - irpf["gastos"], 2) == irpf["rendimiento_neto"]
