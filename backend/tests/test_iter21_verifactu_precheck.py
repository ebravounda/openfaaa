"""Iter 21: VeriFactu precheck (block + explain) + XML totals with suplidos/N1."""
import os
import re
import pytest
import requests
from datetime import date, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
_mongo = MongoClient(MONGO_URL)[DB_NAME]
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


@pytest.fixture(scope="module")
def original_company(s):
    r = s.get(f"{BASE_URL}/api/company")
    assert r.status_code == 200, r.text
    return r.json() or {}


def _put_company(s, orig, **overrides):
    payload = {
        "name": orig.get("name") or "TEST Empresa",
        "nif": overrides.pop("nif", orig.get("nif") or "B99999999"),
        "address": orig.get("address") or "Calle Test 1",
        "email": orig.get("email") or "test@empresa.es",
        "phone": orig.get("phone") or "",
        "tax_type": orig.get("tax_type", "autonomo"),
        "invoice_prefix": orig.get("invoice_prefix", "TESTVF"),
        "rectify_prefix": orig.get("rectify_prefix", "R"),
        "quote_prefix": orig.get("quote_prefix", "PRE"),
        "invoice_start_number": int(orig.get("invoice_start_number", 1) or 1),
        "invoice_due_days": int(orig.get("invoice_due_days", 15) or 15),
        "verifactu_enabled": overrides.pop("verifactu_enabled", True),
        "verifactu_mode": overrides.pop("verifactu_mode", "simulado"),
        "verifactu_cert_type": orig.get("verifactu_cert_type", "personal"),
        "template_id": orig.get("template_id", "clasico"),
        "accent_color": orig.get("accent_color", ""),
        "logo": orig.get("logo", ""),
        "invoice_footer": orig.get("invoice_footer", ""),
        "legal_name": orig.get("legal_name", ""),
        "legal_notice": orig.get("legal_notice", ""),
    }
    payload.update(overrides)
    r = s.put(f"{BASE_URL}/api/company", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module", autouse=True)
def enable_vf_simulado(s, original_company):
    _put_company(s, original_company, verifactu_enabled=True, verifactu_mode="simulado",
                 nif=original_company.get("nif") or "B99999999")
    yield
    # Restore
    _put_company(s, original_company,
                 verifactu_enabled=bool(original_company.get("verifactu_enabled", False)),
                 verifactu_mode=original_company.get("verifactu_mode", "simulado"),
                 nif=original_company.get("nif") or "B99999999")


# Track created invoice ids for cleanup
CREATED = []


def _mk_invoice(s, client=None, line_items=None, issue_date=None, recargo=False):
    body = {
        "issue_date": issue_date or date.today().isoformat(),
        "client": client or {"name": "TEST_Cliente VF", "nif": "12345678Z",
                             "address": "C/ Test 1", "email": "c@test.es"},
        "line_items": line_items or [{"description": "TEST Servicio", "quantity": 1,
                                      "unit_price": 100.0, "iva_rate": 21,
                                      "iva_type": "general"}],
        "iva_rate": 21,
        "irpf_rate": 0,
        "recargo_equivalencia": recargo,
        "notes": "TEST_VF21",
        "status": "pending",
        "invoice_type": "normal",
    }
    r = s.post(f"{BASE_URL}/api/invoices", json=body)
    assert r.status_code == 200, r.text
    inv = r.json()
    CREATED.append(inv["id"])
    return inv


# ---------- Regression: list/create works, total still includes suplidos ----------
class TestRegression:
    def test_list_invoices_ok(self, s):
        r = s.get(f"{BASE_URL}/api/invoices")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_total_includes_suplidos(self, s):
        inv = _mk_invoice(s, line_items=[
            {"description": "TEST Servicio", "quantity": 1, "unit_price": 100.0,
             "iva_rate": 21, "iva_type": "general"},
            {"description": "TEST Suplido Notaria", "quantity": 1, "unit_price": 50.0,
             "iva_rate": 0, "iva_type": "suplido"},
        ])
        # base_general=100, IVA=21, suplidos=50 -> total=171
        assert inv["suplidos_total"] == 50.0
        assert inv["base"] == 100.0
        assert inv["iva_amount"] == 21.0
        assert inv["total"] == 171.0
        # verify persistence
        r = s.get(f"{BASE_URL}/api/invoices/{inv['id']}")
        assert r.status_code == 200
        assert r.json()["total"] == 171.0


# ---------- Precheck: must block submit (422) and NOT mark submitted ----------
class TestPrecheckBlock:
    def _assert_blocked(self, s, inv_id):
        r = s.post(f"{BASE_URL}/api/invoices/{inv_id}/verifactu/submit")
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert detail.startswith("No se ha enviado a la AEAT. Corrige esto antes:"), detail
        inv = s.get(f"{BASE_URL}/api/invoices/{inv_id}").json()
        vfd = inv.get("verifactu") or {}
        assert vfd.get("submitted") is False
        # No verifactu_log entry for this invoice
        n = _mongo.verifactu_log.count_documents({"invoice_id": inv_id})
        assert n == 0, f"Expected no verifactu_log for blocked submit, got {n}"
        return detail

    def test_block_invalid_client_nif(self, s):
        # Create valid invoice first, then corrupt client NIF in DB to simulate stale data
        inv = _mk_invoice(s)
        _mongo.invoices.update_one({"id": inv["id"]}, {"$set": {"client.nif": "INVALIDO"}})
        detail = self._assert_blocked(s, inv["id"])
        assert "NIF del cliente" in detail

    def test_block_missing_client_name(self, s):
        inv = _mk_invoice(s)
        _mongo.invoices.update_one({"id": inv["id"]}, {"$set": {"client.name": "   "}})
        detail = self._assert_blocked(s, inv["id"])
        assert "nombre del cliente" in detail.lower()

    def test_block_future_date(self, s):
        future = (date.today() + timedelta(days=10)).isoformat()
        inv = _mk_invoice(s, issue_date=future)
        detail = self._assert_blocked(s, inv["id"])
        assert "futura" in detail.lower()

    def test_block_invalid_company_nif(self, s, original_company):
        # Switch company NIF to invalid
        _put_company(s, original_company, nif="BADNIF", verifactu_enabled=True,
                     verifactu_mode="simulado")
        try:
            inv = _mk_invoice(s)
            detail = self._assert_blocked(s, inv["id"])
            assert "NIF de tu empresa" in detail
        finally:
            # restore company NIF
            _put_company(s, original_company,
                         nif=original_company.get("nif") or "B99999999",
                         verifactu_enabled=True, verifactu_mode="simulado")


# ---------- Valid invoice submits successfully (simulado) ----------
class TestSimulatedSubmit:
    def test_submit_valid_simulado(self, s):
        inv = _mk_invoice(s)
        r = s.post(f"{BASE_URL}/api/invoices/{inv['id']}/verifactu/submit")
        assert r.status_code == 200, r.text
        data = r.json()
        status = data.get("status", "")
        assert "simulado" in status.lower() or "aceptado" in status.lower(), data
        # persisted
        inv2 = s.get(f"{BASE_URL}/api/invoices/{inv['id']}").json()
        assert inv2["verifactu"]["submitted"] is True


# ---------- XML totals: suplidos excluded, RE included; N1 for no_sujeto ----------
class TestXmlTotals:
    def test_xml_suplidos_recargo(self, s):
        # line1: 100 @ 21% + RE; line2: 50 suplido
        inv = _mk_invoice(s, recargo=True, line_items=[
            {"description": "TEST Servicio", "quantity": 1, "unit_price": 100.0,
             "iva_rate": 21, "iva_type": "general"},
            {"description": "TEST Suplido", "quantity": 1, "unit_price": 50.0,
             "iva_rate": 0, "iva_type": "suplido"},
        ])
        # expected: base=100, iva=21, re=5.2, suplidos=50 -> total=176.20
        # ImporteTotal VF (sin suplidos) = 100+21+5.20 = 126.20
        # CuotaTotal = 21 + 5.20 = 26.20
        assert inv["iva_amount"] == 21.0
        assert inv["re_amount"] == 5.20
        assert inv["suplidos_total"] == 50.0
        assert inv["total"] == 176.20

        r = s.get(f"{BASE_URL}/api/invoices/{inv['id']}/verifactu/xml")
        assert r.status_code == 200, r.text
        xml = r.text
        m_imp = re.search(r"<sum1:ImporteTotal>([\d.]+)</sum1:ImporteTotal>", xml)
        m_cuo = re.search(r"<sum1:CuotaTotal>([\d.]+)</sum1:CuotaTotal>", xml)
        assert m_imp and m_cuo, xml[:1000]
        assert float(m_imp.group(1)) == 126.20
        assert float(m_cuo.group(1)) == 26.20
        # Suplido NOT in Desglose: bases+cuotas+recargos must equal ImporteTotal
        bases = sum(map(float, re.findall(
            r"<sum1:BaseImponibleOimporteNoSujeto>([\d.]+)</sum1:BaseImponibleOimporteNoSujeto>", xml)))
        cuotas = sum(map(float, re.findall(
            r"<sum1:CuotaRepercutida>([\d.]+)</sum1:CuotaRepercutida>", xml)))
        recargos = sum(map(float, re.findall(
            r"<sum1:CuotaRecargoEquivalencia>([\d.]+)</sum1:CuotaRecargoEquivalencia>", xml)))
        assert round(bases + cuotas + recargos, 2) == 126.20
        # The 50€ suplido should NOT appear as a Base in the XML
        assert bases == 100.0

    def test_xml_no_sujeto_N1(self, s):
        inv = _mk_invoice(s, line_items=[
            {"description": "TEST Servicio", "quantity": 1, "unit_price": 100.0,
             "iva_rate": 21, "iva_type": "general"},
            {"description": "TEST No sujeto", "quantity": 1, "unit_price": 30.0,
             "iva_rate": 0, "iva_type": "no_sujeto"},
        ])
        assert inv["base_no_sujeta"] == 30.0
        r = s.get(f"{BASE_URL}/api/invoices/{inv['id']}/verifactu/xml")
        assert r.status_code == 200
        xml = r.text
        # Find DetalleDesglose that contains N1
        assert "<sum1:CalificacionOperacion>N1</sum1:CalificacionOperacion>" in xml
        # Should contain a block with N1 followed by Base = 30.00
        m = re.search(
            r"<sum1:DetalleDesglose>[^<]*(?:<sum1:[^>]+>[^<]*</sum1:[^>]+>)*?<sum1:CalificacionOperacion>N1</sum1:CalificacionOperacion>.*?</sum1:DetalleDesglose>",
            xml, re.S)
        assert m, "No DetalleDesglose with N1 found"
        assert "<sum1:BaseImponibleOimporteNoSujeto>30.00</sum1:BaseImponibleOimporteNoSujeto>" in m.group(0)


# ---------- Cleanup ----------
def test_zz_cleanup(s):
    for iid in list(CREATED):
        try:
            s.delete(f"{BASE_URL}/api/invoices/{iid}")
        except Exception:
            pass
