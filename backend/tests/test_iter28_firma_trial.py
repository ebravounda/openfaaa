"""Iter 28: Firma de entrega (albaranes) + trial reminders.

Covers:
- POST /api/albaranes/{id}/firmar (presencial)
- POST /api/albaranes/{id}/enlace-firma (crear enlace)
- GET/POST /api/public/albaran-firma/{token} y /pdf
- Validaciones: PNG inválido, nombre corto, segunda firma, edición tras firmar
- Lista albaranes NO devuelve signature.image
- run_trial_reminders con usuarios TEST
"""
import base64
import os
import re
import io
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN = {"email": "admin@fiscalhub.es", "password": "admin123"}

# A real small PNG (16x16 with some pixels drawn) so it exceeds 400 bytes
def _make_png_bytes():
    try:
        from PIL import Image, ImageDraw
    except Exception:
        pytest.skip("Pillow not available")
    img = Image.new("RGBA", (200, 80), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)
    d.line([(10, 60), (60, 20), (120, 55), (190, 25)], fill=(10, 10, 10, 255), width=3)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def png_data_url():
    raw = _make_png_bytes()
    return "data:image/png;base64," + base64.b64encode(raw).decode()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "X-OF-Client": "web"})
    r = s.post(f"{API}/auth/login", json=ADMIN)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def created_ids():
    return []


def _mk_albaran_payload():
    return {
        "issue_date": datetime.now(timezone.utc).date().isoformat(),
        "delivery_date": datetime.now(timezone.utc).date().isoformat(),
        "client": {"name": "TEST Firma Cliente", "nif": "12345678Z", "address": "C/ TEST 1", "email": ""},
        "delivery_address": "Almacén TEST",
        "line_items": [{"description": "TEST Producto", "quantity": 2, "unit_price": 50.0, "iva_rate": 21, "iva_type": "general"}],
        "show_prices": True,
        "notes": "TEST Firma",
        "status": "pendiente",
    }


def test_create_albaran_for_sign(session, created_ids):
    r = session.post(f"{API}/albaranes", json=_mk_albaran_payload())
    assert r.status_code == 200, r.text
    a = r.json()
    assert "id" in a and "number" in a
    created_ids.append(a["id"])


def test_sign_invalid_png(session, created_ids):
    aid = created_ids[0]
    r = session.post(f"{API}/albaranes/{aid}/firmar",
                     json={"name": "Pepe Test", "dni": "12345678Z", "signature": "data:image/png;base64,AAAA", "send_email": False})
    assert r.status_code == 400


def test_sign_short_name(session, created_ids, png_data_url):
    aid = created_ids[0]
    r = session.post(f"{API}/albaranes/{aid}/firmar",
                     json={"name": "A", "dni": "", "signature": png_data_url, "send_email": False})
    assert r.status_code == 400


def test_sign_success_and_get_pdf(session, created_ids, png_data_url):
    aid = created_ids[0]
    r = session.post(f"{API}/albaranes/{aid}/firmar",
                     json={"name": "Juan TEST Pérez", "dni": "12345678Z", "signature": png_data_url, "send_email": False})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "entregado"
    assert data["signature"]["name"] == "Juan TEST Pérez"
    assert "image" not in data["signature"]  # no se devuelve

    # GET pdf
    r2 = session.get(f"{API}/albaranes/{aid}/pdf")
    assert r2.status_code == 200
    assert r2.content[:4] == b"%PDF"


def test_sign_second_time_fails(session, created_ids, png_data_url):
    aid = created_ids[0]
    r = session.post(f"{API}/albaranes/{aid}/firmar",
                     json={"name": "Otro TEST", "signature": png_data_url, "send_email": False})
    assert r.status_code == 400


def test_update_signed_fails(session, created_ids):
    aid = created_ids[0]
    r = session.put(f"{API}/albaranes/{aid}", json=_mk_albaran_payload())
    assert r.status_code == 400


def test_list_hides_signature_image(session, created_ids):
    r = session.get(f"{API}/albaranes")
    assert r.status_code == 200
    for a in r.json():
        if a["id"] == created_ids[0]:
            assert "image" not in (a.get("signature") or {}), "list no debe devolver signature.image"
            assert (a.get("signature") or {}).get("name") == "Juan TEST Pérez"
            return
    pytest.fail("Albarán firmado no encontrado en lista")


# ----- Enlace de firma + endpoints públicos -----
def test_create_sign_link(session, created_ids):
    # Create fresh albaran
    r = session.post(f"{API}/albaranes", json=_mk_albaran_payload())
    assert r.status_code == 200
    aid = r.json()["id"]
    created_ids.append(aid)

    r = session.post(f"{API}/albaranes/{aid}/enlace-firma", json={"email": False})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "/firmar/" in data["url"]
    token = data["url"].rsplit("/", 1)[-1]
    assert len(token) >= 20
    # Save on fixture
    created_ids.append(("token", aid, token))


def _last_token(created_ids):
    for t in reversed(created_ids):
        if isinstance(t, tuple) and t[0] == "token":
            return t[1], t[2]
    return None, None


def test_public_view(created_ids):
    aid, token = _last_token(created_ids)
    assert token
    r = requests.get(f"{API}/public/albaran-firma/{token}")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "number" in data and data["lines"]


def test_public_pdf(created_ids):
    aid, token = _last_token(created_ids)
    r = requests.get(f"{API}/public/albaran-firma/{token}/pdf")
    assert r.status_code == 200
    assert r.content[:4] == b"%PDF"


def test_public_sign_invalid_token():
    r = requests.get(f"{API}/public/albaran-firma/invalid_token_xxxxxxxxxxxx")
    assert r.status_code == 404


def test_public_sign_success(created_ids, png_data_url):
    aid, token = _last_token(created_ids)
    r = requests.post(f"{API}/public/albaran-firma/{token}",
                      json={"name": "Cliente TEST Público", "dni": "", "signature": png_data_url, "send_email": True},
                      headers={"Content-Type": "application/json"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "ok"


def test_public_sign_token_invalidated(created_ids, png_data_url):
    aid, token = _last_token(created_ids)
    # Reusar enlace → ahora el token ya debe estar inválido (sign_token: None)
    r = requests.get(f"{API}/public/albaran-firma/{token}")
    assert r.status_code == 404


# ----- Cleanup -----
def test_cleanup(session, created_ids):
    for item in created_ids:
        if isinstance(item, tuple):
            continue
        # Attempt delete (firmados no son facturados, se pueden borrar)
        session.delete(f"{API}/albaranes/{item}")


# ----- Trial reminders -----
def test_trial_reminders_logic(monkeypatch):
    """Insert TEST users with trial_ends_at within windows and verify run_trial_reminders."""
    import sys
    sys.path.insert(0, "/app/backend")
    from database import db
    import trial_reminders

    sent_log = []

    async def fake_send(**kwargs):
        sent_log.append(kwargs.get("to"))
        return "fake-id"

    monkeypatch.setattr(trial_reminders, "send_email", fake_send)

    async def run():
        now = datetime.now(timezone.utc)
        users = []
        # d=3: trial_ends_at in (now+2d, now+3d]
        u3 = {"_id": f"TEST_{uuid.uuid4()}", "id": str(uuid.uuid4()), "email": "test3@example.invalid",
              "name": "Test 3d", "plan": "basico", "role": "user",
              "trial_ends_at": (now + timedelta(days=2, hours=12)).isoformat(),
              "stripe_subscription_id": None}
        # d=1: trial_ends_at in (now, now+1d]
        u1 = {"_id": f"TEST_{uuid.uuid4()}", "id": str(uuid.uuid4()), "email": "test1@example.invalid",
              "name": "Test 1d", "plan": "basico", "role": "user",
              "trial_ends_at": (now + timedelta(hours=12)).isoformat(),
              "stripe_subscription_id": ""}
        # Should NOT be sent: has stripe subscription
        u_paid = {"_id": f"TEST_{uuid.uuid4()}", "id": str(uuid.uuid4()), "email": "testpaid@example.invalid",
                  "name": "Paid", "plan": "basico", "role": "user",
                  "trial_ends_at": (now + timedelta(hours=12)).isoformat(),
                  "stripe_subscription_id": "sub_123"}
        # Should NOT be sent: out of window
        u_far = {"_id": f"TEST_{uuid.uuid4()}", "id": str(uuid.uuid4()), "email": "testfar@example.invalid",
                 "name": "Far", "plan": "basico", "role": "user",
                 "trial_ends_at": (now + timedelta(days=10)).isoformat(),
                 "stripe_subscription_id": None}
        users = [u3, u1, u_paid, u_far]
        try:
            for u in users:
                await db.users.insert_one(dict(u))
            sent = await trial_reminders.run_trial_reminders()
            assert sent >= 2, f"Expected >=2 sent, got {sent}"
            assert "test3@example.invalid" in sent_log
            assert "test1@example.invalid" in sent_log
            assert "testpaid@example.invalid" not in sent_log
            assert "testfar@example.invalid" not in sent_log
            # Idempotencia: segunda llamada no reenvía
            sent_log.clear()
            sent2 = await trial_reminders.run_trial_reminders()
            assert "test3@example.invalid" not in sent_log
            assert "test1@example.invalid" not in sent_log
            # Flag marked
            u3_db = await db.users.find_one({"_id": u3["_id"]})
            assert u3_db.get("trial_reminder_3d_sent")
            u1_db = await db.users.find_one({"_id": u1["_id"]})
            assert u1_db.get("trial_reminder_1d_sent")
        finally:
            for u in users:
                await db.users.delete_one({"_id": u["_id"]})

    asyncio.get_event_loop().run_until_complete(run())
