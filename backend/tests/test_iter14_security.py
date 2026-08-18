"""Iter 14 – Security middleware regression tests (CSRF, headers, docs, regex, password)."""
import os
import uuid
import requests
import pytest

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].splitlines()[0]).rstrip("/")


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": email, "password": password},
               headers={"X-OF-Client": "web"})
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return s, r


# ---------------- Security headers ----------------
class TestSecurityHeaders:
    def test_headers_present_on_get(self):
        r = requests.get(f"{BASE_URL}/api/")
        h = {k.lower(): v for k, v in r.headers.items()}
        assert h.get("x-content-type-options") == "nosniff"
        assert h.get("x-frame-options") == "DENY"
        assert h.get("referrer-policy") == "strict-origin-when-cross-origin"
        assert "permissions-policy" in h
        assert "strict-transport-security" in h


# ---------------- Docs disabled ----------------
class TestDocsDisabled:
    def test_docs_404(self):
        assert requests.get(f"{BASE_URL}/api/docs").status_code == 404

    def test_openapi_404(self):
        assert requests.get(f"{BASE_URL}/api/openapi.json").status_code == 404


# ---------------- Password strength ----------------
class TestPasswordStrength:
    @pytest.mark.parametrize("pw", ["123", "abcdefgh", "short"])
    def test_weak_rejected(self, pw):
        email = f"TEST_pw_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"email": email, "password": pw, "name": "T"},
                          headers={"X-OF-Client": "web"})
        assert r.status_code == 422, f"expected 422 for '{pw}' got {r.status_code} {r.text}"

    def test_strong_accepted(self):
        email = f"TEST_pw_ok_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"email": email, "password": "Segura123", "name": "T"},
                          headers={"X-OF-Client": "web"})
        assert r.status_code == 200, f"{r.status_code} {r.text}"


# ---------------- CSRF ----------------
class TestCSRF:
    def test_cookie_no_header_blocked(self):
        s, _ = _login("admin@fiscalhub.es", "admin123")
        # Remove the X-OF-Client header — session cookie still present
        r = s.post(f"{BASE_URL}/api/contacts",
                   json={"name": "TEST_csrf", "email": "x@x.es"})
        assert r.status_code == 403
        assert "CSRF" in r.text

    def test_cookie_with_header_allowed(self):
        s, _ = _login("admin@fiscalhub.es", "admin123")
        r = s.post(f"{BASE_URL}/api/contacts",
                   json={"name": f"TEST_csrf_ok_{uuid.uuid4().hex[:6]}", "email": "ok@x.es"},
                   headers={"X-OF-Client": "web"})
        assert r.status_code in (200, 201), f"{r.status_code} {r.text}"


# ---------------- Admin regex escape ----------------
class TestAdminRegexEscape:
    @pytest.mark.parametrize("q", [".*", "(", "[abc", "\\", "?"])
    def test_regex_special_safe(self, q):
        s, _ = _login("admin@fiscalhub.es", "admin123")
        r = s.get(f"{BASE_URL}/api/admin/users", params={"q": q},
                  headers={"X-OF-Client": "web"})
        assert r.status_code == 200, f"q={q!r} -> {r.status_code} {r.text[:200]}"
        data = r.json()
        # Literal search: '.*' should not match everything
        if q == ".*":
            items = data if isinstance(data, list) else data.get("items", data.get("users", []))
            # very unlikely any user email/name literally contains '.*'
            assert len(items) < 100
