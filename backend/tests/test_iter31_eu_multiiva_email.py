"""Iter 31: clientes UE (IT, inversión sujeto pasivo), desglose multi-IVA, plantilla email con logo + PDF."""
import os
import sys
import io
import base64
import pytest
import requests
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"
CREATED_INV, CREATED_CONTACTS = [], []


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json", "X-OF-Client": "web"})
    r = sess.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    yield sess
    for i in CREATED_INV:
        sess.delete(f"{BASE_URL}/api/invoices/{i}")
    for c in CREATED_CONTACTS:
        sess.delete(f"{BASE_URL}/api/contacts/{c}")


def _inv(client, lines=None, irpf=0):
    lines = lines or [{"description": "TEST_Consultoría", "quantity": 2, "unit_price": 500,
                       "iva_rate": 21, "iva_type": "general"}]
    return {"issue_date": date.today().isoformat(), "client": client, "line_items": lines,
            "irpf_rate": irpf, "status": "pending"}


def _create(s, payload):
    r = s.post(f"{BASE_URL}/api/invoices", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED_INV.append(d["id"])
    return d


def _pdf_text(s, inv_id):
    import fitz
    r = s.get(f"{BASE_URL}/api/invoices/{inv_id}/pdf")
    assert r.status_code == 200, r.text[:200]
    doc = fitz.open(stream=r.content, filetype="pdf")
    return " ".join(p.get_text() for p in doc).replace("\n", " ")


@pytest.fixture(scope="module")
def it_inv(s):
    return _create(s, _inv({"name": "TEST_GLOBAL TECHNOLOGY SRL", "nif": "IT08903531211", "country": "IT"}, irpf=15))


@pytest.fixture(scope="module")
def multi_inv(s):
    return _create(s, _inv({"name": "TEST_Cliente ES", "nif": "B12345674", "country": "ES"}, lines=[
        {"description": "TEST_A", "quantity": 1, "unit_price": 100, "iva_rate": 21, "iva_type": "general"},
        {"description": "TEST_B", "quantity": 1, "unit_price": 200, "iva_rate": 10, "iva_type": "general"}]))


# Italian invoice with prefixed VAT
def test_it_invoice(it_inv):
    d = it_inv
    assert d["foreign_client"] is True and d["foreign_eu"] is True
    assert d["iva_amount"] == 0 and d["irpf_rate"] == 0 and d["irpf_amount"] == 0
    assert d["total"] == 1000 and d["base_no_sujeta"] == 1000
    assert all(li["iva_type"] == "no_sujeto" and li["iva_rate"] == 0 for li in d["line_items"])


# Italian invoice without prefix -> VeriFactu ID gets prefix
def test_it_invoice_no_prefix_xml(s):
    d = _create(s, _inv({"name": "TEST_GT noprefix", "nif": "08903531211", "country": "it"}, irpf=15))
    assert d["foreign_eu"] is True and d["client"]["country"] == "IT" and d["irpf_rate"] == 0
    r = s.get(f"{BASE_URL}/api/invoices/{d['id']}/verifactu/xml")
    assert r.status_code == 200, r.text[:300]
    x = r.text
    assert "<sum1:CodigoPais>IT</sum1:CodigoPais>" in x
    assert "<sum1:IDType>02</sum1:IDType>" in x
    assert "<sum1:ID>IT08903531211</sum1:ID>" in x
    assert "N2" in x


def test_it_xml(s, it_inv):
    r = s.get(f"{BASE_URL}/api/invoices/{it_inv['id']}/verifactu/xml")
    assert r.status_code == 200
    x = r.text
    assert "IDOtro" in x and "<sum1:IDType>02</sum1:IDType>" in x and "<sum1:ID>IT08903531211</sum1:ID>" in x
    assert "<sum1:CalificacionOperacion>N2</sum1:CalificacionOperacion>" in x


# Regression: CL -> IDType 04
def test_cl_xml_and_pdf(s):
    d = _create(s, _inv({"name": "TEST_ACME SpA", "nif": "76.123.456-7", "country": "CL"}))
    assert d["foreign_eu"] is False and d["foreign_client"] is True
    r = s.get(f"{BASE_URL}/api/invoices/{d['id']}/verifactu/xml")
    assert "<sum1:IDType>04</sum1:IDType>" in r.text and "<sum1:CodigoPais>CL</sum1:CodigoPais>" in r.text
    t = _pdf_text(s, d["id"])
    assert "art. 69" in t and "outside the EU" in t
    assert "Inversión del sujeto pasivo" not in t


# FR with VAT now accepted
def test_fr_accepted(s):
    d = _create(s, _inv({"name": "TEST_FR SARL", "nif": "FR40303265045", "country": "FR"}))
    assert d["foreign_eu"] is True and d["iva_amount"] == 0


def test_it_pdf(s, it_inv):
    t = _pdf_text(s, it_inv["id"])
    assert "VAT / Tax ID" in t
    assert "Inversión del sujeto pasivo" in t and "Reverse charge" in t


# Multi-IVA breakdown
def test_multi_iva_breakdown(s, multi_inv):
    r = s.get(f"{BASE_URL}/api/invoices/{multi_inv['id']}")
    assert r.status_code == 200
    d = r.json()
    bd = {b["rate"]: b for b in d["iva_breakdown"]}
    assert set(bd) == {21, 10}
    assert bd[21]["base"] == 100 and bd[21]["cuota"] == 21
    assert bd[10]["base"] == 200 and bd[10]["cuota"] == 20
    assert d["base"] == 300 and d["iva_amount"] == 41 and d["total"] == 341


def test_multi_iva_pdf(s, multi_inv):
    t = _pdf_text(s, multi_inv["id"])
    for k in ["Base imponible al 21%", "IVA 21%", "Base imponible al 10%", "IVA 10%", "Total base imponible", "Total IVA"]:
        assert k in t, k


def test_single_iva_pdf(s):
    d = _create(s, _inv({"name": "TEST_Cliente ES1", "nif": "B12345674", "country": "ES"}))
    t = _pdf_text(s, d["id"])
    assert "Base imponible" in t and "IVA (21%)" in t
    assert "Total base imponible" not in t


# Contacts IT
def test_contact_it(s):
    r = s.post(f"{BASE_URL}/api/contacts", json={"name": "TEST_GLOBAL TECH", "nif": "IT08903531211", "country": "IT",
                                                 "type": "client"})
    assert r.status_code in (200, 201), r.text
    d = r.json()
    CREATED_CONTACTS.append(d["id"])
    assert d["country"] == "IT"


# ES invalid still rejected
def test_es_invalid_nif(s):
    r = s.post(f"{BASE_URL}/api/invoices", json=_inv({"name": "TEST_bad", "nif": "IT08903531211", "country": "ES"}))
    assert r.status_code == 422


# Send email without client email -> 400 (no real send)
def test_send_email_no_address(s, it_inv):
    r = s.post(f"{BASE_URL}/api/invoices/{it_inv['id']}/send-email")
    assert r.status_code == 400 and "email" in r.json()["detail"].lower()


# Email template in-process
def test_email_template_inproc():
    import email_service
    import email_template
    png = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 64).decode()
    comp = {"name": "TEST_Empresa", "logo": f"data:image/png;base64,{png}", "nif": "B12345674"}
    att = email_template.logo_attachment(comp)
    assert att and att["content_id"] == "company-logo" and att["filename"] == "logo.png"
    doc = {"number": "F-1", "total": 341, "base": 300, "iva_amount": 41, "issue_date": "2026-01-10",
           "client": {"name": "Cli"}, "line_items": [{"description": "x", "quantity": 1, "unit_price": 100}],
           "iva_breakdown": [{"rate": 21, "base": 100, "cuota": 21}, {"rate": 10, "base": 200, "cuota": 20}]}
    html = email_service.build_invoice_email_html(doc, comp, has_logo=True, pdf_name="factura-F-1.pdf")
    email_service._assert_safe_email("Factura F-1 - TEST_Empresa", html)
    assert 'cid:company-logo' in html and "factura-F-1.pdf" in html
    assert "Base al 21%" in html and "Base al 10%" in html
    assert email_template.logo_attachment({"logo": "https://x/logo.png"}) is None
