"""Iteration 6: VeriFactu certificate upload/sign, connection log, cron purge, user isolation."""
import io
import os
import re
from datetime import datetime, timedelta, timezone

import pytest
import requests
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"
CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET") or ""


def _read_backend_env_secret():
    global CRON_SECRET
    if CRON_SECRET:
        return CRON_SECRET
    try:
        with open("/app/backend/.env") as f:
            for line in f:
                if line.startswith("WEBHOOK_CRON_SECRET="):
                    CRON_SECRET = line.split("=", 1)[1].strip().strip('"')
                    break
    except Exception:
        pass
    return CRON_SECRET


def _make_pfx(password: str, cn: str = "TEST_USER", nif: str = "B12312312") -> bytes:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, cn),
        x509.NameAttribute(NameOID.SERIAL_NUMBER, nif),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "TEST_ORG"),
    ])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=365))
        .sign(key, hashes.SHA256())
    )
    return pkcs12.serialize_key_and_certificates(
        name=b"test", key=key, cert=cert, cas=None,
        encryption_algorithm=serialization.BestAvailableEncryption(password.encode()),
    )


@pytest.fixture(scope="module")
def admin_sess():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def other_sess():
    """Create/login a second user for isolation test."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = "TEST_iter6_other@example.com"
    pwd = "Passw0rd!123"
    s.post(f"{BASE_URL}/api/auth/register",
           json={"name": "Other", "email": email, "password": pwd})
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": pwd})
    assert r.status_code == 200, r.text
    # ensure a company (some flows need it) - not required for cert endpoints
    return s


def _upload_cert(sess, pfx_bytes, password):
    # Fresh session copy without JSON content-type
    files = {"file": ("test.pfx", pfx_bytes, "application/x-pkcs12")}
    data = {"password": password}
    # requests will set multipart automatically if we drop the header
    headers = {k: v for k, v in sess.headers.items() if k.lower() != "content-type"}
    return requests.post(f"{BASE_URL}/api/verifactu/certificate",
                         files=files, data=data,
                         cookies=sess.cookies, headers=headers)


def test_upload_certificate_wrong_password_returns_400(admin_sess):
    pfx = _make_pfx("goodpass")
    r = _upload_cert(admin_sess, pfx, "wrongpass")
    assert r.status_code == 400, r.text


def test_upload_certificate_ok_returns_meta(admin_sess):
    pfx = _make_pfx("goodpass", cn="TEST_ADMIN_CN", nif="A11111111")
    r = _upload_cert(admin_sess, pfx, "goodpass")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "meta" in body
    meta = body["meta"]
    assert meta["subject_cn"] == "TEST_ADMIN_CN"
    assert meta["nif"] == "A11111111"
    assert "valid_to" in meta and meta["valid_to"]


def test_get_certificate_does_not_expose_secrets(admin_sess):
    r = admin_sess.get(f"{BASE_URL}/api/verifactu/certificate")
    assert r.status_code == 200
    d = r.json()
    assert "data" not in d
    assert "password" not in d
    assert d.get("meta", {}).get("subject_cn") == "TEST_ADMIN_CN"


def _ensure_verifactu_enabled(sess):
    c = sess.get(f"{BASE_URL}/api/company").json() or {}
    payload = {
        "name": c.get("name") or "TEST Company",
        "nif": c.get("nif") or "A11111111",
        "address": c.get("address") or "Calle Test 1",
        "email": c.get("email") or "test@empresa.es",
        "phone": c.get("phone") or "",
        "invoice_prefix": c.get("invoice_prefix", "FAC"),
        "rectify_prefix": c.get("rectify_prefix", "R"),
        "verifactu_enabled": True,
    }
    r = sess.put(f"{BASE_URL}/api/company", json=payload)
    assert r.status_code == 200, r.text


def _create_invoice(sess, price=123.0):
    body = {
        "issue_date": "2026-03-05",
        "client": {"name": "TEST_C", "nif": "B12312312", "address": "X", "email": "c@t.es"},
        "line_items": [{"description": "Serv", "quantity": 1, "unit_price": price}],
        "iva_rate": 21, "irpf_rate": 0, "notes": "", "status": "pending",
        "invoice_type": "normal",
    }
    r = sess.post(f"{BASE_URL}/api/invoices", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def test_submit_signed_creates_log_entry(admin_sess):
    _ensure_verifactu_enabled(admin_sess)
    # Cert already uploaded in previous test -> signed=true
    inv = _create_invoice(admin_sess, price=155.0)
    r = admin_sess.post(f"{BASE_URL}/api/invoices/{inv['id']}/verifactu/submit")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["signed"] is True
    assert d["csv"].startswith("VF-")

    log = admin_sess.get(f"{BASE_URL}/api/verifactu/connection-log").json()
    assert isinstance(log, list) and len(log) >= 1
    entry = next((e for e in log if e["invoice_id"] == inv["id"]), None)
    assert entry is not None
    assert "RegistroAlta" in entry["request_xml"]
    assert "CSV" in entry["response_xml"]
    assert "EstadoEnvio" in entry["response_xml"]
    assert entry["estado"] == "Correcto"
    assert entry["csv"].startswith("VF-")
    assert entry["signed"] is True
    assert entry["signer"] == "TEST_ADMIN_CN"


def test_connection_log_sorted_desc(admin_sess):
    log = admin_sess.get(f"{BASE_URL}/api/verifactu/connection-log").json()
    if len(log) >= 2:
        assert log[0]["created_at"] >= log[1]["created_at"]


def test_submit_without_certificate_still_works_unsigned(admin_sess):
    # Delete cert first
    r = admin_sess.delete(f"{BASE_URL}/api/verifactu/certificate")
    assert r.status_code == 200
    # confirm gone
    g = admin_sess.get(f"{BASE_URL}/api/verifactu/certificate").json()
    assert g == {} or "meta" not in g

    inv = _create_invoice(admin_sess, price=42.0)
    r = admin_sess.post(f"{BASE_URL}/api/invoices/{inv['id']}/verifactu/submit")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["signed"] is False


def test_user_isolation_cert_and_log(admin_sess, other_sess):
    # other user: no cert, no log
    r = other_sess.get(f"{BASE_URL}/api/verifactu/certificate")
    assert r.status_code == 200
    assert r.json() == {} or "meta" not in r.json()
    r2 = other_sess.get(f"{BASE_URL}/api/verifactu/connection-log")
    assert r2.status_code == 200
    assert r2.json() == []

    # Upload other user's own cert with different CN
    pfx = _make_pfx("otherpwd", cn="TEST_OTHER_CN", nif="C22222222")
    r3 = _upload_cert(other_sess, pfx, "otherpwd")
    assert r3.status_code == 200, r3.text
    assert r3.json()["meta"]["subject_cn"] == "TEST_OTHER_CN"

    # admin still sees no cert (deleted earlier) - not other's
    ag = admin_sess.get(f"{BASE_URL}/api/verifactu/certificate").json()
    assert ag == {} or ag.get("meta", {}).get("subject_cn") != "TEST_OTHER_CN"


def test_cron_purge_requires_auth():
    r = requests.post(f"{BASE_URL}/api/cron/purge-verifactu-log")
    assert r.status_code == 401
    r2 = requests.post(f"{BASE_URL}/api/cron/purge-verifactu-log",
                       headers={"Authorization": "Bearer wrong"})
    assert r2.status_code == 401


def test_cron_purge_clears_log(admin_sess):
    secret = _read_backend_env_secret()
    assert secret, "WEBHOOK_CRON_SECRET missing"
    r = requests.post(f"{BASE_URL}/api/cron/purge-verifactu-log",
                      headers={"Authorization": f"Bearer {secret}"})
    assert r.status_code in (200, 202)
    # background task - give it a moment
    import time
    time.sleep(1.5)
    log = admin_sess.get(f"{BASE_URL}/api/verifactu/connection-log").json()
    assert log == []


def test_delete_certificate_cleanup(other_sess):
    r = other_sess.delete(f"{BASE_URL}/api/verifactu/certificate")
    assert r.status_code == 200
    r2 = other_sess.get(f"{BASE_URL}/api/verifactu/certificate").json()
    assert r2 == {} or "meta" not in r2
