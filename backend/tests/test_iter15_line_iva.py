"""Iteration 15 – IVA por línea backend tests.

Cubre:
- POST /api/invoices con múltiples líneas y distintos iva_type/iva_rate.
- PUT /api/invoices/{id} recálculo.
- Validaciones 422 (iva_rate no permitido, iva_type inválido).
- PDF /api/invoices/{id}/pdf.
- GET /api/annual-summary agregando por iva_breakdown.
- Export libros csv/xlsx.
"""
import os
import re
import pytest
import requests

def _load_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except Exception:
            pass
    assert url, "REACT_APP_BACKEND_URL missing"
    return url.rstrip("/")


BASE_URL = _load_url()
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json", "X-OF-Client": "web"})
    r = sess.post(f"{BASE_URL}/api/auth/login",
                  json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return sess


def _payload(**overrides):
    p = {
        "issue_date": "2026-01-15",
        "client": {"name": "TEST Cliente Iter15", "nif": "B12345674",
                   "address": "C/ Falsa 1", "email": "t@t.es"},
        "line_items": [
            {"description": "Consultoría", "quantity": 1, "unit_price": 1000.0,
             "iva_rate": 21, "iva_type": "general"},
            {"description": "Comida", "quantity": 2, "unit_price": 50.0,
             "iva_rate": 10, "iva_type": "general"},
            {"description": "Formación exenta", "quantity": 1, "unit_price": 200.0,
             "iva_rate": 0, "iva_type": "exento"},
            {"description": "Suplido tasa", "quantity": 1, "unit_price": 30.0,
             "iva_rate": 0, "iva_type": "suplido"},
        ],
        "irpf_rate": 15,
        "recargo_equivalencia": True,
        "status": "pending",
        "notes": "TEST iter15",
    }
    p.update(overrides)
    return p


class TestInvoiceLineIVA:
    invoice_id = None

    def test_create_multi_iva_invoice(self, s):
        r = s.post(f"{BASE_URL}/api/invoices", json=_payload())
        assert r.status_code == 200, r.text
        d = r.json()
        TestInvoiceLineIVA.invoice_id = d["id"]

        # base = 1000 + 100 + 200 = 1300 (suplidos excluidos)
        assert d["base"] == 1300.00, f"base={d['base']}"
        assert d["suplidos_total"] == 30.00
        assert d["base_exenta"] == 200.00

        # IVA amount = 1000*0.21 + 100*0.10 = 210 + 10 = 220
        assert d["iva_amount"] == 220.00, d["iva_amount"]

        # RE: 21% -> 5.2% : 1000*0.052=52 ; 10% -> 1.4% : 100*0.014=1.4 -> 53.40
        assert d["re_amount"] == 53.40, d["re_amount"]

        # IRPF base = general + exenta = 1000 + 100 + 200 = 1300 ; 15% = 195
        assert d["irpf_base"] == 1300.00
        assert d["irpf_amount"] == 195.00

        # Total = base + suplidos + iva + re - irpf
        # = 1300 + 30 + 220 + 53.40 - 195 = 1408.40
        assert d["total"] == 1408.40, d["total"]

        bd = {b["rate"]: b for b in d["iva_breakdown"]}
        assert 21 in bd and 10 in bd
        assert bd[21]["base"] == 1000.0 and bd[21]["cuota"] == 210.0
        assert bd[21]["re_rate"] == 5.2 and bd[21]["re_cuota"] == 52.0
        assert bd[10]["base"] == 100.0 and bd[10]["cuota"] == 10.0
        assert bd[10]["re_rate"] == 1.4 and abs(bd[10]["re_cuota"] - 1.4) < 0.01

    def test_update_recomputes(self, s):
        assert TestInvoiceLineIVA.invoice_id
        # Sustituimos líneas: solo 500 al 4% + un suplido
        p = _payload()
        p["line_items"] = [
            {"description": "Libro", "quantity": 1, "unit_price": 500.0,
             "iva_rate": 4, "iva_type": "general"},
            {"description": "Suplido", "quantity": 1, "unit_price": 20.0,
             "iva_rate": 0, "iva_type": "suplido"},
        ]
        p["irpf_rate"] = 0
        r = s.put(f"{BASE_URL}/api/invoices/{TestInvoiceLineIVA.invoice_id}", json=p)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["base"] == 500.0
        assert d["suplidos_total"] == 20.0
        assert d["iva_amount"] == 20.0  # 500*4%
        # re 4% -> 0.5% : 500*0.005=2.5
        assert d["re_amount"] == 2.5
        assert d["irpf_amount"] == 0.0
        # total = 500 + 20 + 20 + 2.5 = 542.5
        assert d["total"] == 542.5

    def test_reject_invalid_iva_rate(self, s):
        p = _payload()
        p["line_items"] = [
            {"description": "X", "quantity": 1, "unit_price": 100,
             "iva_rate": 7, "iva_type": "general"},
        ]
        r = s.post(f"{BASE_URL}/api/invoices", json=p)
        assert r.status_code == 422, r.status_code

    def test_reject_invalid_iva_type(self, s):
        p = _payload()
        p["line_items"] = [
            {"description": "X", "quantity": 1, "unit_price": 100,
             "iva_rate": 21, "iva_type": "foobar"},
        ]
        r = s.post(f"{BASE_URL}/api/invoices", json=p)
        assert r.status_code == 422

    def test_accept_allowed_rates(self, s):
        for rate in (0, 4, 10, 21):
            p = _payload()
            p["line_items"] = [
                {"description": f"OK {rate}", "quantity": 1, "unit_price": 10,
                 "iva_rate": rate, "iva_type": "general"},
            ]
            p["recargo_equivalencia"] = False
            r = s.post(f"{BASE_URL}/api/invoices", json=p)
            assert r.status_code == 200, f"rate {rate}: {r.text}"

    def test_pdf_download(self, s):
        assert TestInvoiceLineIVA.invoice_id
        r = s.get(f"{BASE_URL}/api/invoices/{TestInvoiceLineIVA.invoice_id}/pdf")
        assert r.status_code == 200, r.text[:200]
        assert "pdf" in r.headers.get("content-type", "").lower()
        assert r.content[:4] == b"%PDF"

    def test_annual_summary_uses_breakdown(self, s):
        # Crear una factura conocida para 2026
        p = _payload()
        p["issue_date"] = "2026-02-10"
        p["line_items"] = [
            {"description": "S1", "quantity": 1, "unit_price": 100,
             "iva_rate": 21, "iva_type": "general"},
            {"description": "S2", "quantity": 1, "unit_price": 200,
             "iva_rate": 10, "iva_type": "general"},
        ]
        p["irpf_rate"] = 0
        p["recargo_equivalencia"] = False
        r = s.post(f"{BASE_URL}/api/invoices", json=p)
        assert r.status_code == 200
        r = s.get(f"{BASE_URL}/api/annual-summary?year=2026")
        assert r.status_code == 200
        d = r.json()
        rep = {x["rate"]: x for x in d["modelo_390"]["iva_repercutido"]}
        # Debe tener bases > 0 para 21 y 10 (acumula todas las TEST creadas)
        assert rep[21]["cuota"] > 0
        assert rep[10]["cuota"] > 0
        # Consistencia: cuota ≈ base * rate / 100 (tolerancia por redondeos)
        for r_ in (21, 10):
            expected = round(rep[r_]["base"] * r_ / 100, 2)
            assert abs(rep[r_]["cuota"] - expected) < 1.0, (r_, rep[r_])

    def test_export_libros_csv(self, s):
        r = s.get(f"{BASE_URL}/api/export/libros?year=2026&format=csv")
        assert r.status_code == 200, r.text[:200]

    def test_export_libros_xlsx(self, s):
        r = s.get(f"{BASE_URL}/api/export/libros?year=2026&format=xlsx")
        assert r.status_code == 200, r.text[:200]
        ctype = r.headers.get("content-type", "")
        assert "spreadsheet" in ctype or "excel" in ctype or "xlsx" in ctype.lower(), ctype


@pytest.fixture(scope="module", autouse=True)
def cleanup(s):
    yield
    # Limpieza: borrar facturas de TEST creadas
    try:
        r = s.get(f"{BASE_URL}/api/invoices")
        if r.status_code == 200:
            for inv in r.json():
                cl = inv.get("client") or {}
                if "TEST Cliente Iter15" in (cl.get("name") or "") or "TEST iter15" in (inv.get("notes") or ""):
                    s.delete(f"{BASE_URL}/api/invoices/{inv['id']}")
    except Exception:
        pass
