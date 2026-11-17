"""Iter 32 - Ticket OCR (sin IVA) for expenses: scan, scan-batch, manual create, 303 exclusion."""
import os
import pytest
import requests

BASE_URL = None
with open("/app/frontend/.env") as f:
    for ln in f:
        if ln.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"
TICKET = "/app/ticket_test.jpg"
YEAR = 2031  # isolated year for 303 checks


@pytest.fixture(scope="module")
def s():
    ss = requests.Session()
    ss.headers.update({"X-OF-Client": "web"})
    r = ss.post(f"{API}/auth/login", json={"email": "admin@fiscalhub.es", "password": "admin123"})
    if r.status_code != 200:
        pytest.skip("login failed")
    tok = r.json().get("token") or r.json().get("access_token")
    if tok:
        ss.headers.update({"Authorization": f"Bearer {tok}"})
    return ss


@pytest.fixture(scope="module")
def created(s):
    ids = []
    yield ids
    for i in ids:
        s.delete(f"{API}/expenses/{i}")


# Scan: forced ticket mode
def test_scan_forced_ticket(s):
    with open(TICKET, "rb") as fh:
        r = s.post(f"{API}/expenses/scan?ticket=true", files={"file": ("ticket_test.jpg", fh, "image/jpeg")}, timeout=120)
    assert r.status_code == 200, r.text
    ex = r.json()["extracted"]
    print("forced:", ex)
    assert ex["doc_type"] == "ticket"
    assert ex["iva_rate"] == 0
    assert abs(ex["base_amount"] - 13.5) < 0.01
    assert abs(ex["total"] - 13.5) < 0.01
    assert ex["vendor_name"]
    from ocr_service import CATEGORIES  # noqa
    assert ex["category"] in CATEGORIES


# Scan: auto detection
def test_scan_auto_detect(s):
    with open(TICKET, "rb") as fh:
        r = s.post(f"{API}/expenses/scan", files={"file": ("ticket_test.jpg", fh, "image/jpeg")}, timeout=120)
    assert r.status_code == 200, r.text
    ex = r.json()["extracted"]
    print("auto:", ex)
    assert ex["doc_type"] == "ticket", f"observation: AI returned {ex['doc_type']}"
    assert ex["iva_rate"] == 0
    assert abs(ex["base_amount"] - 13.5) < 0.01


# Batch scan with ticket flag
def test_scan_batch_ticket(s):
    with open(TICKET, "rb") as a, open(TICKET, "rb") as b:
        files = [("files", ("t1.jpg", a, "image/jpeg")), ("files", ("t2.jpg", b, "image/jpeg"))]
        r = s.post(f"{API}/expenses/scan-batch?ticket=true", files=files, timeout=180)
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    print([(i["extracted"], i["duplicate_type"], i["error"]) for i in items])
    assert len(items) == 2
    for it in items:
        assert it["error"] is None
        assert it["extracted"]["doc_type"] == "ticket"
        assert it["extracted"]["iva_rate"] == 0
    # second one is a batch duplicate of the first
    assert any(i["duplicate_type"] == "batch" for i in items)


# Manual create: ticket forces no IVA
def test_create_ticket_forces_no_iva(s, created):
    r = s.post(f"{API}/expenses", json={"date": f"{YEAR}-02-10", "vendor_name": "TEST_Bazar", "base_amount": 13.5,
                                         "iva_rate": 21, "doc_type": "ticket", "category": "Material"})
    assert r.status_code == 200, r.text
    d = r.json()
    created.append(d["id"])
    assert d["doc_type"] == "ticket" and d["iva_rate"] == 0 and d["iva_amount"] == 0 and d["total"] == 13.5
    lst = s.get(f"{API}/expenses").json()
    got = next(x for x in lst if x["id"] == d["id"])
    assert got["iva_rate"] == 0 and got["total"] == 13.5 and got["doc_type"] == "ticket"


# Manual create: default factura with IVA (regression)
def test_create_factura_default(s, created):
    r = s.post(f"{API}/expenses", json={"date": f"{YEAR}-02-11", "vendor_name": "TEST_Proveedor", "base_amount": 100, "iva_rate": 21})
    assert r.status_code == 200
    d = r.json()
    created.append(d["id"])
    assert d["doc_type"] == "factura" and d["iva_amount"] == 21 and d["total"] == 121


# Invalid doc_type falls back to factura
def test_create_unknown_doc_type(s, created):
    r = s.post(f"{API}/expenses", json={"date": f"{YEAR}-02-12", "vendor_name": "TEST_X", "base_amount": 10, "iva_rate": 21, "doc_type": "zzz"})
    assert r.status_code == 200
    d = r.json()
    created.append(d["id"])
    assert d["doc_type"] == "factura" and d["total"] == 12.1


# Update factura -> ticket
def test_update_to_ticket(s, created):
    eid = created[1]
    r = s.put(f"{API}/expenses/{eid}", json={"date": f"{YEAR}-02-11", "vendor_name": "TEST_Proveedor", "base_amount": 100, "iva_rate": 21, "doc_type": "ticket"})
    assert r.status_code == 200
    assert r.json()["iva_amount"] == 0 and r.json()["total"] == 100
    # revert
    s.put(f"{API}/expenses/{eid}", json={"date": f"{YEAR}-02-11", "vendor_name": "TEST_Proveedor", "base_amount": 100, "iva_rate": 21})


# 303: ticket excluded from IVA soportado
def test_303_excludes_ticket(s, created):
    r = s.get(f"{API}/dashboard?year={YEAR}")
    assert r.status_code == 200
    d = r.json()
    print({k: d[k] for k in d if "iva" in k})
    # factura 21 + unknown 2.1 -> 23.1 ; ticket contributes 0
    assert abs(d["iva_soportado"] - 23.1) < 0.01


# Bulk save with ticket
def test_bulk_ticket(s, created):
    r = s.post(f"{API}/expenses/bulk", json={"items": [{"date": f"{YEAR}-03-01", "vendor_name": "TEST_BulkBazar", "base_amount": 9.99, "iva_rate": 21, "doc_type": "ticket"}]})
    assert r.status_code == 200
    it = r.json()["items"][0]
    created.append(it["id"])
    assert it["iva_rate"] == 0 and it["total"] == 9.99
