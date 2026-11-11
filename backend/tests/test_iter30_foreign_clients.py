"""Iter 30: clientes extracomunitarios (no sujeta art. 69 LIVA) - facturas, contactos, PDF, VeriFactu precheck."""
import os
import sys
import io
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


def _inv(client, rate=21, irpf=0, itype="general"):
    return {"issue_date": date.today().isoformat(), "client": client,
            "line_items": [{"description": "TEST_Consultoría", "quantity": 2, "unit_price": 500,
                            "iva_rate": rate, "iva_type": itype}],
            "irpf_rate": irpf, "status": "pending"}


@pytest.fixture(scope="module")
def foreign_inv(s):
    r = s.post(f"{BASE_URL}/api/invoices", json=_inv(
        {"name": "TEST_ACME SpA", "nif": "76.123.456-7", "country": "CL"}, irpf=15))
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED_INV.append(d["id"])
    return d


# Maintenance must be off
def test_maintenance_off():
    r = requests.get(f"{BASE_URL}/api/maintenance")
    assert r.status_code == 200 and r.json()["enabled"] is False


# Foreign invoice totals
def test_foreign_invoice_totals(s, foreign_inv):
    d = foreign_inv
    assert d["foreign_client"] is True
    assert d["base"] == 1000 and d["total"] == 1000
    assert d["iva_amount"] == 0 and d["irpf_amount"] == 0 and d["irpf_rate"] == 0
    assert d["base_no_sujeta"] == 1000
    assert all(li["iva_type"] == "no_sujeto" and li["iva_rate"] == 0 for li in d["line_items"])
    assert d["client"]["country"] == "CL"
    g = s.get(f"{BASE_URL}/api/invoices/{d['id']}").json()
    assert g["total"] == 1000 and g["foreign_client"] is True and g["client"]["country"] == "CL"


def test_foreign_lowercase_country(s):
    r = s.post(f"{BASE_URL}/api/invoices", json=_inv({"name": "TEST_US Inc", "nif": "12-3456789", "country": "us"}))
    assert r.status_code == 200, r.text
    CREATED_INV.append(r.json()["id"])
    assert r.json()["foreign_client"] is True and r.json()["client"]["country"] == "US"


def test_es_invalid_nif_422(s):
    r = s.post(f"{BASE_URL}/api/invoices", json=_inv({"name": "TEST_X", "nif": "76.123.456-7", "country": "ES"}))
    assert r.status_code == 422
    assert "elige su país" in r.text


def test_fr_eu_non_spanish_nif_422(s):
    r = s.post(f"{BASE_URL}/api/invoices", json=_inv({"name": "TEST_FR", "nif": "FR12345678901", "country": "FR"}))
    assert r.status_code == 422, r.text


def test_foreign_without_nif_422(s):
    r = s.post(f"{BASE_URL}/api/invoices", json=_inv({"name": "TEST_CL", "nif": "", "country": "CL"}))
    assert r.status_code == 422
    assert "El VAT / identificación fiscal del cliente es obligatorio." in r.text


def test_foreign_pdf(s, foreign_inv):
    r = s.get(f"{BASE_URL}/api/invoices/{foreign_inv['id']}/pdf")
    assert r.status_code == 200 and r.content[:4] == b"%PDF"
    import pymupdf
    doc = pymupdf.open(stream=r.content, filetype="pdf")
    text = " ".join(p.get_text() for p in doc)
    text = " ".join(text.split())
    assert "VAT / Tax ID" in text, text[:1500]
    assert "no sujeta a IVA por reglas de localización (art. 69" in text, text[-1500:]


def test_contact_country(s):
    r = s.post(f"{BASE_URL}/api/contacts", json={"name": "TEST_Contacto CL", "nif": "76.123.456-7",
                                                   "country": "CL", "kind": "client"})
    assert r.status_code == 200, r.text
    CREATED_CONTACTS.append(r.json()["id"])
    assert r.json()["country"] == "CL"
    lst = s.get(f"{BASE_URL}/api/contacts?kind=client").json()
    c = next(x for x in lst if x["id"] == r.json()["id"])
    assert c["country"] == "CL"


def test_contact_default_country_es(s):
    r = s.post(f"{BASE_URL}/api/contacts", json={"name": "TEST_Contacto ES", "nif": "12345678Z", "kind": "client"})
    assert r.status_code == 200
    CREATED_CONTACTS.append(r.json()["id"])
    assert r.json()["country"] == "ES"


# VeriFactu precheck in-process (no AEAT submit)
def test_verifactu_precheck_foreign(s, foreign_inv):
    import verifactu_service as vf
    import spanish_tax
    company = {"nif": "B99999999"}
    inv = s.get(f"{BASE_URL}/api/invoices/{foreign_inv['id']}").json()
    probs = vf.precheck(inv, company, spanish_tax.validate_nif)
    assert not any("NIF del cliente" in p for p in probs), probs
    assert probs == [] or all("empresa" in p for p in probs), probs
    x = vf._build_desglose(inv)
    assert "N2" in x and "1000" in x
    dest = vf._destinatario_id(inv["client"])
    assert "<sum1:CodigoPais>CL</sum1:CodigoPais>" in dest and "<sum1:IDType>04</sum1:IDType>" in dest


def test_verifactu_xml_endpoint(s, foreign_inv):
    r = s.get(f"{BASE_URL}/api/invoices/{foreign_inv['id']}/verifactu/xml")
    if r.status_code == 404:
        pytest.skip("VeriFactu not enabled for company")
    assert r.status_code == 200
    assert "IDOtro" in r.text and "N2" in r.text


# Regression: Spanish invoice
def test_spanish_regression(s):
    r = s.post(f"{BASE_URL}/api/invoices", json=_inv({"name": "TEST_ES SL", "nif": "B12345674", "country": "ES"}, irpf=15))
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED_INV.append(d["id"])
    assert d["foreign_client"] is False
    assert d["base"] == 1000 and d["iva_amount"] == 210 and d["irpf_amount"] == 150 and d["total"] == 1060


def test_spanish_no_country_field(s):
    body = _inv({"name": "TEST_ES2", "nif": "12345678Z"})
    r = s.post(f"{BASE_URL}/api/invoices", json=body)
    assert r.status_code == 200, r.text
    CREATED_INV.append(r.json()["id"])
    assert r.json()["iva_amount"] == 210 and r.json()["total"] == 1210


def test_update_es_to_cl(s):
    r = s.post(f"{BASE_URL}/api/invoices", json=_inv({"name": "TEST_UPD", "nif": "12345678Z"}))
    iid = r.json()["id"]
    CREATED_INV.append(iid)
    u = s.put(f"{BASE_URL}/api/invoices/{iid}", json=_inv({"name": "TEST_UPD", "nif": "76.123.456-7", "country": "CL"}))
    assert u.status_code == 200, u.text
    g = s.get(f"{BASE_URL}/api/invoices/{iid}").json()
    assert g["total"] == 1000 and g["iva_amount"] == 0 and g["foreign_client"] is True
