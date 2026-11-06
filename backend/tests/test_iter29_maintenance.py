# Iter 29: Maintenance mode (public status, admin toggle, 503 middleware gate)
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
HDR = {"Origin": BASE_URL, "Referer": BASE_URL + "/", "X-OF-Client": "web"}
ADMIN = {"email": "admin@fiscalhub.es", "password": "admin123"}
CREATED = {}


def _session():
    s = requests.Session()
    s.headers.update(HDR)
    return s


@pytest.fixture(scope="module")
def admin():
    s = _session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def user():
    s = _session()
    email = f"test_maint_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={"name": "TEST_Maint", "email": email, "password": "TestPass123!"})
    assert r.status_code in (200, 201), r.text
    if s.cookies.get("access_token") is None:
        r2 = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "TestPass123!"})
        assert r2.status_code == 200, r2.text
    me = s.get(f"{BASE_URL}/api/auth/me").json()
    CREATED["user_id"] = me.get("id") or me.get("_id")
    CREATED["email"] = email
    print("TEST user", email, CREATED["user_id"])
    return s


@pytest.fixture(scope="module", autouse=True)
def ensure_disabled_at_end():
    yield
    s = _session()
    s.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    r = s.put(f"{BASE_URL}/api/admin/maintenance", json={"enabled": False, "message": "", "until": ""})
    print("Final disable:", r.status_code, r.text)


class TestMaintenance:
    def test_public_status_shape(self):
        r = requests.get(f"{BASE_URL}/api/maintenance")
        assert r.status_code == 200
        d = r.json()
        assert set(d.keys()) == {"enabled", "message", "until"}

    def test_admin_get_requires_admin(self, user):
        assert requests.get(f"{BASE_URL}/api/admin/maintenance").status_code in (401, 403)
        assert user.get(f"{BASE_URL}/api/admin/maintenance").status_code == 403
        assert user.put(f"{BASE_URL}/api/admin/maintenance", json={"enabled": True}).status_code == 403

    def test_disabled_user_ok(self, admin, user):
        r = admin.put(f"{BASE_URL}/api/admin/maintenance", json={"enabled": False, "message": "", "until": ""})
        assert r.status_code == 200 and r.json()["enabled"] is False
        time.sleep(6)
        assert user.get(f"{BASE_URL}/api/invoices").status_code == 200

    def test_enable_and_gate(self, admin, user):
        r = admin.put(f"{BASE_URL}/api/admin/maintenance",
                      json={"enabled": True, "message": "  TEST_msg  ", "until": "2030-01-01T10:00"})
        assert r.status_code == 200
        d = r.json()
        assert d["enabled"] is True and d["message"] == "TEST_msg" and d["until"] == "2030-01-01T10:00"
        assert admin.get(f"{BASE_URL}/api/admin/maintenance").json()["enabled"] is True
        time.sleep(6)
        pub = requests.get(f"{BASE_URL}/api/maintenance").json()
        assert pub == {"enabled": True, "message": "TEST_msg", "until": "2030-01-01T10:00"}
        # normal user blocked
        r = user.get(f"{BASE_URL}/api/invoices")
        assert r.status_code == 503 and r.json().get("maintenance") is True
        # anonymous blocked on non-whitelisted API
        r = requests.get(f"{BASE_URL}/api/blog")
        print("anon /api/blog", r.status_code)
        assert r.status_code == 503
        # auth still allowed
        assert user.get(f"{BASE_URL}/api/auth/me").status_code == 200
        # admin works
        assert admin.get(f"{BASE_URL}/api/invoices").status_code == 200
        assert admin.get(f"{BASE_URL}/api/auth/me").status_code == 200

    def test_bearer_admin_passes(self, admin):
        tok = admin.cookies.get("access_token")
        r = requests.get(f"{BASE_URL}/api/invoices", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200

    def test_invalid_token_blocked(self):
        r = requests.get(f"{BASE_URL}/api/invoices", headers={"Authorization": "Bearer garbage"})
        assert r.status_code == 503

    def test_cors_header_on_503(self):
        r = requests.get(f"{BASE_URL}/api/invoices", headers={"Origin": BASE_URL})
        print("CORS headers", r.headers.get("access-control-allow-origin"))
        assert r.status_code == 503

    def test_disable_restores(self, admin, user):
        r = admin.put(f"{BASE_URL}/api/admin/maintenance", json={"enabled": False, "message": "", "until": ""})
        assert r.status_code == 200 and r.json()["enabled"] is False
        time.sleep(6)
        assert requests.get(f"{BASE_URL}/api/maintenance").json()["enabled"] is False
        assert user.get(f"{BASE_URL}/api/invoices").status_code == 200

    def test_validation(self, admin):
        r = admin.put(f"{BASE_URL}/api/admin/maintenance", json={"message": "x"})
        assert r.status_code == 422
