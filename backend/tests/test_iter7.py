"""Iteration 7 backend tests: VIES NIF lookup, verifactu preproduccion mode,
signed XML download, cron cert expiry, idempotency regression."""
import os
import io
import uuid
import datetime as dt

import pytest
import requests
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://sistema-impuestos.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@fiscalhub.es")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

# WEBHOOK_CRON_SECRET - read directly from backend/.env at test time
def _cron_secret():
    try:
        with open("/app/backend/.env") as f:
            for line in f:
                if line.startswith("WEBHOOK_CRON_SECRET"):
                    return line.split("=", 1)[1].strip().strip('"')
    except Exception:
        return ""
    return ""

CRON_SECRET = _cron_secret()


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("access_token") or data.get("token")
    if token:
        s.headers["Authorization"] = f"Bearer {token}"
    return s


def _make_pfx(cn="TEST_ITER7_CN", password="test1234", days=365):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, cn),
        x509.NameAttribute(NameOID.SERIAL_NUMBER, "99999999R"),
    ])
    now = dt.datetime.utcnow()
    cert = (x509.CertificateBuilder()
            .subject_name(name).issuer_name(name).public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - dt.timedelta(days=1))
            .not_valid_after(now + dt.timedelta(days=days))
            .sign(key, hashes.SHA256()))
    return pkcs12.serialize_key_and_certificates(
        name=cn.encode(), key=key, cert=cert, cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(password.encode())), password


# ---------- VIES lookup ----------
class TestLookupNif:
    def test_lookup_valid_es_cif(self, client):
        r = client.get(f"{API}/lookup/nif", params={"nif": "ESB84570936"}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("valid") is True
        assert d.get("source", "").startswith("VIES")
        assert "name" in d and "address" in d

    def test_lookup_empty(self, client):
        r = client.get(f"{API}/lookup/nif", params={"nif": ""}, timeout=15)
        assert r.status_code == 400

    def test_lookup_unauth(self):
        r = requests.get(f"{API}/lookup/nif", params={"nif": "ESB84570936"}, timeout=15)
        assert r.status_code in (401, 403)


# ---------- Company verifactu_mode ----------
class TestCompanyMode:
    def test_set_preproduccion(self, client):
        _enable_verifactu_on_company(client, "preproduccion")
        d = client.get(f"{API}/company", timeout=15).json()
        assert d.get("verifactu_mode") == "preproduccion"

    def test_set_simulado(self, client):
        _enable_verifactu_on_company(client, "simulado")
        d = client.get(f"{API}/company", timeout=15).json()
        assert d.get("verifactu_mode") == "simulado"


# ---------- Invoice + VeriFactu XML + idempotency ----------
def _enable_verifactu_on_company(client, mode="simulado"):
    cur = client.get(f"{API}/company", timeout=15).json() or {}
    keys = ["name","nif","address","email","phone","tax_type","invoice_prefix","rectify_prefix"]
    payload = {k: (cur.get(k) or ("Test Co" if k=="name" else "")) for k in keys}
    payload["verifactu_enabled"] = True
    payload["verifactu_mode"] = mode
    r = client.put(f"{API}/company", json=payload, timeout=15)
    assert r.status_code == 200, r.text


def _new_invoice(client):
    payload = {
        "client": {"name": "TEST_ITER7 Cliente", "nif": "12345678Z", "email": "c@t.com", "address": "C/ Test 1"},
        "line_items": [{"description": "Servicio", "quantity": 1, "unit_price": 100.0}],
        "issue_date": dt.date.today().isoformat(),
        "iva_rate": 21,
        "irpf_rate": 0,
        "notes": "iter7 test",
    }
    r = client.post(f"{API}/invoices", json=payload, timeout=20)
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


@pytest.fixture(scope="module")
def invoice_id(client):
    _enable_verifactu_on_company(client, "simulado")
    return _new_invoice(client)


class TestVerifactuSimulado:
    def test_submit_simulado(self, client, invoice_id):
        _enable_verifactu_on_company(client, "simulado")
        r = client.post(f"{API}/invoices/{invoice_id}/verifactu/submit", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("simulated") is True
        assert "Aceptado" in d.get("status", "") or "Correcto" in d.get("status", "")
        assert d.get("csv")

    def test_submit_idempotent(self, client, invoice_id):
        # count log entries for this invoice
        log1 = client.get(f"{API}/verifactu/connection-log", timeout=15).json()
        n1 = sum(1 for e in log1 if e.get("invoice_id") == invoice_id)
        r = client.post(f"{API}/invoices/{invoice_id}/verifactu/submit", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d.get("already") is True, f"expected already:true, got {d}"
        log2 = client.get(f"{API}/verifactu/connection-log", timeout=15).json()
        n2 = sum(1 for e in log2 if e.get("invoice_id") == invoice_id)
        assert n1 == n2, f"log grew from {n1} to {n2} on idempotent submit"

    def test_download_signed_xml(self, client, invoice_id):
        r = client.get(f"{API}/invoices/{invoice_id}/verifactu/xml", timeout=20)
        assert r.status_code == 200
        assert "xml" in r.headers.get("content-type", "").lower()
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        body = r.text
        assert "RegistroAlta" in body or "RegFactuSistemaFacturacion" in body
        assert "soap" in body.lower()

    def test_download_xml_404_no_verifactu(self, client):
        # temporarily disable verifactu at company level, create invoice, restore
        cur = client.get(f"{API}/company", timeout=15).json() or {}
        keys = ["name","nif","address","email","phone","tax_type","invoice_prefix","rectify_prefix"]
        base = {k: (cur.get(k) or ("Test Co" if k=="name" else "")) for k in keys}
        client.put(f"{API}/company", json={**base, "verifactu_enabled": False, "verifactu_mode": "simulado"}, timeout=15)
        payload = {
            "client": {"name": "TEST_ITER7 NoVF", "nif": "12345678Z", "email": "n@t.com", "address": "x"},
            "line_items": [{"description": "s", "quantity": 1, "unit_price": 10.0}],
            "issue_date": dt.date.today().isoformat(),
        }
        r = client.post(f"{API}/invoices", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        inv_id = r.json()["id"]
        try:
            r2 = client.get(f"{API}/invoices/{inv_id}/verifactu/xml", timeout=15)
            assert r2.status_code == 404
        finally:
            client.delete(f"{API}/invoices/{inv_id}", timeout=15)
            _enable_verifactu_on_company(client, "simulado")


# ---------- Preproduccion mode - real attempt (expected to fail from this env) ----------
class TestVerifactuPreproduccion:
    def test_preprod_captures_error(self, client):
        # upload cert
        pfx, pwd = _make_pfx()
        files = {"file": ("test_iter7.pfx", pfx, "application/x-pkcs12")}
        r = client.post(f"{API}/verifactu/certificate", data={"password": pwd}, files=files, timeout=30)
        assert r.status_code == 200, r.text

        _enable_verifactu_on_company(client, "preproduccion")

        # create fresh invoice with verifactu (company has verifactu_enabled)
        payload = {
            "client": {"name": "TEST_ITER7 PRE", "nif": "12345678Z", "email": "p@t.com", "address": "x"},
            "line_items": [{"description": "s", "quantity": 1, "unit_price": 50.0}],
            "issue_date": dt.date.today().isoformat(),
        }
        r = client.post(f"{API}/invoices", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        inv_id = r.json()["id"]
        try:
            r = client.post(f"{API}/invoices/{inv_id}/verifactu/submit", timeout=60)
            assert r.status_code == 200, f"preprod submit must not 500: {r.status_code} {r.text}"
            d = r.json()
            assert d.get("mode") == "preproduccion"
            assert d.get("simulated") is False
            log = client.get(f"{API}/verifactu/connection-log", timeout=15).json()
            e = next((x for x in log if x.get("invoice_id") == inv_id), None)
            assert e is not None
            assert e.get("mode") == "preproduccion"
            assert e.get("simulated") is False
            assert e.get("response_xml"), "response_xml (real response or captured error) must be present"
        finally:
            client.delete(f"{API}/invoices/{inv_id}", timeout=15)
            _enable_verifactu_on_company(client, "simulado")


# ---------- Cron cert-expiry ----------
class TestCronCertExpiry:
    def test_no_auth(self):
        r = requests.post(f"{API}/cron/check-cert-expiry", timeout=15)
        assert r.status_code == 401

    def test_wrong_auth(self):
        r = requests.post(f"{API}/cron/check-cert-expiry",
                          headers={"Authorization": "Bearer wrong"}, timeout=15)
        assert r.status_code == 401

    def test_with_secret(self):
        assert CRON_SECRET, "WEBHOOK_CRON_SECRET missing from backend/.env"
        r = requests.post(f"{API}/cron/check-cert-expiry",
                          headers={"Authorization": f"Bearer {CRON_SECRET}"}, timeout=20)
        assert r.status_code in (200, 202), r.text
        assert r.json().get("status") == "accepted"
