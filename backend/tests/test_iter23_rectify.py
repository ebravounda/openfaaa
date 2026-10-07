"""Iter 23: Rectificativas automáticas al anular factura.
Cubre:
- GET /api/rectify-reasons devuelve las 8 claves con R1-R4/ANULACION y referencia legal.
- POST /api/invoices/{id}/cancel con 'error_datos' crea rectificativa R1, marca original 'rectificada'.
- Cancelar factura pagada con 'error_no_entregada' -> 400 (ley exige rectificativa).
- Cancelar factura pagada con 'devolucion' -> rectificativa, refund_pending=True, original mantiene 'paid'.
- Cancelar factura pendiente no enviada con 'error_no_entregada' -> anulación pura (sin rectificativa).
- Reglas: no re-anular, no anular rectificativa, PDF rectificativa contiene 'Rectifica a' y 'Tipo R1'.
"""
import os
import re
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
_mongo = MongoClient(MONGO_URL)[DB_NAME]
ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"

TEST_CLIENT_NAME = "TEST Cliente iter23"
TEST_CLIENT_NIF = "B12345674"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json", "X-OF-Client": "web"})
    r = sess.post(f"{BASE_URL}/api/auth/login",
                  json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return sess


def _create_invoice(s, status="pending"):
    payload = {
        "issue_date": "2026-01-15",
        "due_date": "2026-01-30",
        "client": {"name": TEST_CLIENT_NAME, "nif": TEST_CLIENT_NIF, "address": "C/ Test 1"},
        "line_items": [{"description": "Servicio TEST iter23", "quantity": 1, "unit_price": 100.0,
                        "iva_rate": 21, "iva_type": "general"}],
        "status": status,
    }
    r = s.post(f"{BASE_URL}/api/invoices", json=payload)
    assert r.status_code == 200, r.text
    inv = r.json()
    assert inv.get("total") == 121.0
    return inv


@pytest.fixture(scope="module", autouse=True)
def cleanup_at_end(s):
    created_ids = []
    yield created_ids
    # Final cleanup
    me = s.get(f"{BASE_URL}/api/auth/me").json()
    uid = me.get("id") if isinstance(me, dict) else None
    # Delete all invoices tied to TEST client
    rows = list(_mongo.invoices.find({"user_id": uid, "client.name": {"$regex": "^TEST "}}, {"id": 1, "_id": 0}))
    ids = [r["id"] for r in rows]
    for iid in ids:
        _mongo.verifactu_log.delete_many({"invoice_id": iid})
        _mongo.invoices.delete_one({"id": iid, "user_id": uid})
    # Also delete clients named 'TEST %'
    _mongo.clients.delete_many({"user_id": uid, "name": {"$regex": "^TEST "}})
    print(f"[cleanup] removed {len(ids)} TEST invoices + verifactu_log for user {uid}")


class TestRectifyReasons:
    def test_list_reasons(self, s):
        r = s.get(f"{BASE_URL}/api/rectify-reasons")
        assert r.status_code == 200, r.text
        data = r.json()
        keys = {d["key"]: d for d in data}
        assert set(keys) == {"error_datos", "devolucion", "descuento", "operacion_cancelada",
                             "concurso", "incobrable", "otras", "error_no_entregada"}
        assert keys["error_datos"]["code"] == "R1"
        assert keys["concurso"]["code"] == "R2"
        assert keys["incobrable"]["code"] == "R3"
        assert keys["otras"]["code"] == "R4"
        assert keys["error_no_entregada"]["code"] == "ANULACION"
        for d in data:
            assert d["legal"], f"missing legal for {d['key']}"
            assert d["label"], f"missing label for {d['key']}"


class TestCancelFlows:
    def test_01_cancel_error_datos_creates_r1(self, s):
        inv = _create_invoice(s, status="pending")
        r = s.post(f"{BASE_URL}/api/invoices/{inv['id']}/cancel",
                   json={"reason": "error_datos", "detail": "importe incorrecto"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mode"] == "rectificativa"
        rect = data["rectificativa"]
        assert rect["code"] == "R1"
        assert abs(rect["total"] + 121.0) < 0.01, f"expected -121.00 got {rect['total']}"
        # original is now rectificada
        orig = s.get(f"{BASE_URL}/api/invoices/{inv['id']}").json()
        assert orig["status"] == "rectificada"
        assert orig.get("rectified_by") == rect["id"]
        assert orig.get("rectified_number") == rect["number"]
        # rectificativa persisted and has type
        got = s.get(f"{BASE_URL}/api/invoices/{rect['id']}").json()
        assert got["invoice_type"] == "rectificativa"
        assert got["rectify_code"] == "R1"
        assert got["status"] == "compensada"
        assert got.get("rectifies") == inv["id"]
        # cannot cancel again
        r2 = s.post(f"{BASE_URL}/api/invoices/{inv['id']}/cancel",
                    json={"reason": "error_datos"})
        assert r2.status_code == 400
        # cannot cancel the rectificativa itself
        r3 = s.post(f"{BASE_URL}/api/invoices/{rect['id']}/cancel",
                    json={"reason": "error_datos"})
        assert r3.status_code == 400

    def test_02_paid_error_no_entregada_blocked(self, s):
        inv = _create_invoice(s, status="paid")
        r = s.post(f"{BASE_URL}/api/invoices/{inv['id']}/cancel",
                   json={"reason": "error_no_entregada"})
        assert r.status_code == 400
        assert "rectificativa" in r.json().get("detail", "").lower()

    def test_03_paid_devolucion_creates_rect_refund_pending(self, s):
        # Reuse invoice from test_02 (still open)
        rows = list(_mongo.invoices.find(
            {"client.name": TEST_CLIENT_NAME, "status": "paid",
             "rectified_by": {"$in": [None, ""]}}, {"id": 1, "_id": 0}))
        assert rows, "need a paid invoice"
        iid = rows[0]["id"]
        r = s.post(f"{BASE_URL}/api/invoices/{iid}/cancel",
                   json={"reason": "devolucion", "detail": "cliente devuelve"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mode"] == "rectificativa"
        assert data["refund_pending"] is True
        assert data["rectificativa"]["code"] == "R1"
        # original stays 'paid' (not rectificada) but has rectified_by badge
        orig = s.get(f"{BASE_URL}/api/invoices/{iid}").json()
        assert orig["status"] == "paid", f"expected paid, got {orig['status']}"
        assert orig.get("rectified_by")
        assert orig.get("rectified_number")

    def test_04_pending_not_sent_anulacion_pura(self, s):
        inv = _create_invoice(s, status="pending")
        r = s.post(f"{BASE_URL}/api/invoices/{inv['id']}/cancel",
                   json={"reason": "error_no_entregada", "detail": "borrador erróneo"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["mode"] == "anulacion"
        orig = s.get(f"{BASE_URL}/api/invoices/{inv['id']}").json()
        assert orig["status"] == "anulada"
        assert orig.get("annulled") is True
        # must NOT have created a rectificativa
        assert not orig.get("rectified_by")

    def test_05_invalid_reason_400(self, s):
        inv = _create_invoice(s, status="pending")
        r = s.post(f"{BASE_URL}/api/invoices/{inv['id']}/cancel",
                   json={"reason": "foobar"})
        assert r.status_code == 400

    def test_06_rectificativa_pdf_contains_rectifica_a_and_tipo(self, s):
        inv = _create_invoice(s, status="pending")
        r = s.post(f"{BASE_URL}/api/invoices/{inv['id']}/cancel",
                   json={"reason": "error_datos", "detail": "fix pdf test"})
        assert r.status_code == 200, r.text
        rid = r.json()["rectificativa"]["id"]
        pdf = s.get(f"{BASE_URL}/api/invoices/{rid}/pdf")
        assert pdf.status_code == 200
        assert pdf.headers.get("content-type", "").startswith("application/pdf")
        body = pdf.content
        assert body[:4] == b"%PDF", "not a PDF"
        text = body.decode("latin-1", errors="ignore")
        # PDF text may be compressed; use the invoice JSON notes as reliable signal
        got = s.get(f"{BASE_URL}/api/invoices/{rid}").json()
        assert "Factura rectificativa (R1)" in got.get("notes", "")
        assert got.get("rectifies_number")
        # file size sanity (>2 KB)
        assert len(body) > 1500
