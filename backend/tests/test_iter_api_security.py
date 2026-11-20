# Iter: API security - webhook SSRF guard, Mongo-backed rate limit (api_rate), regression of /api/v1
import os
import time
import pytest
import requests
from concurrent.futures import ThreadPoolExecutor

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = ("admin@fiscalhub.es", "admin123")
PLATINO = ("clidemo1@example.com", "CliDemo123")

CREATED = {"keys": [], "hooks": []}


def login(cred):
    s = requests.Session()
    s.headers.update({"X-OF-Client": "web", "Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": cred[0], "password": cred[1]})
    if r.status_code != 200:
        pytest.skip(f"login failed {cred[0]}: {r.status_code}")
    return s


@pytest.fixture(scope="module")
def admin():
    s = login(ADMIN)
    yield s
    for hid in CREATED["hooks"]:
        s.delete(f"{BASE_URL}/api/developer/webhooks/{hid}")
    for kid in CREATED["keys"]:
        s.delete(f"{BASE_URL}/api/developer/keys/{kid}")


@pytest.fixture(scope="module")
def comp(admin):
    comps = admin.get(f"{BASE_URL}/api/developer/companies").json()
    assert comps
    return comps[0]["id"]


def mk_key(sess, cid, name):
    r = sess.post(f"{BASE_URL}/api/developer/keys", json={"name": name, "company_id": cid, "scope": "read"})
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED["keys"].append((d["id"]))
    return d


BAD = ["https://localhost/x", "https://127.0.0.1/", "https://169.254.169.254/latest", "https://10.0.0.5/",
       "http://example.com", "https://no-existe-zzz.invalid/", "https://[::1]/x", "https://192.168.1.1/",
       "https://0.0.0.0/", "https://user:pw@example.com/", "https://2130706433/", "https://0x7f000001/",
       "https://localtest.me/", "https://[::ffff:127.0.0.1]/", "https://100.64.0.1/"]


# --- SSRF guard on webhook creation ---
class TestWebhookSSRF:
    @pytest.mark.parametrize("url", BAD)
    def test_bad_url_rejected(self, admin, comp, url):
        r = admin.post(f"{BASE_URL}/api/developer/webhooks", json={"url": url, "company_id": comp})
        if r.status_code == 200:
            CREATED["hooks"].append(r.json()["id"])
        assert r.status_code == 400, f"{url} -> {r.status_code} {r.text}"
        det = r.json().get("detail", "")
        assert "webhook" in det.lower() or "URL" in det, det

    def test_good_url_and_test_and_delete(self, admin, comp):
        r = admin.post(f"{BASE_URL}/api/developer/webhooks",
                       json={"url": "https://httpbin.org/post", "company_id": comp, "events": ["invoice.created"]})
        assert r.status_code == 200, r.text
        h = r.json()
        CREATED["hooks"].append(h["id"])
        assert h["secret"].startswith("whsec_") and h["active"] is True
        t = admin.post(f"{BASE_URL}/api/developer/webhooks/{h['id']}/test")
        assert t.status_code == 200, t.text
        d = t.json()
        assert d and d["webhook_id"] == h["id"] and d["event"] == "ping"
        print("delivery", d)
        lst = admin.get(f"{BASE_URL}/api/developer/webhooks").json()
        assert any(x["webhook_id"] == h["id"] for x in lst["deliveries"])
        admin.delete(f"{BASE_URL}/api/developer/webhooks/{h['id']}")
        t2 = admin.post(f"{BASE_URL}/api/developer/webhooks/{h['id']}/test")
        assert t2.status_code == 404, t2.text
        lst = admin.get(f"{BASE_URL}/api/developer/webhooks").json()
        assert not any(x["id"] == h["id"] for x in lst["webhooks"])

    def test_unknown_hook_test_404(self, admin):
        assert admin.post(f"{BASE_URL}/api/developer/webhooks/nope-123/test").status_code == 404


# --- Regression /api/v1 ---
class TestV1Regression:
    def test_endpoints(self, admin, comp):
        k = mk_key(admin, comp, "TEST_reg")["key"]
        H = {"Authorization": f"Bearer {k}"}
        for p in ["me", "clients", "invoices", "expenses"]:
            r = requests.get(f"{BASE_URL}/api/v1/{p}", headers=H)
            assert r.status_code == 200, f"{p}: {r.status_code} {r.text[:200]}"
        assert requests.get(f"{BASE_URL}/api/v1/me", headers={"X-API-Key": k}).status_code == 200
        assert requests.get(f"{BASE_URL}/api/v1/me").status_code == 401
        assert requests.get(f"{BASE_URL}/api/v1/docs").status_code == 200


# --- Rate limit (Mongo, cross-worker) ---
class TestRateLimit:
    def _burst(self, key, n):
        def one(_):
            r = requests.get(f"{BASE_URL}/api/v1/me", headers={"Authorization": f"Bearer {key}"})
            return r.status_code, r.headers.get("Retry-After")
        with ThreadPoolExecutor(10) as ex:
            return list(ex.map(one, range(n)))

    def _wait_fresh_minute(self):
        s = time.time() % 60
        if s > 15:
            time.sleep(61 - s)
        print("burst start sec", time.time() % 60)

    def test_admin_120_limit_and_other_key_unaffected(self, admin, comp):
        self._wait_fresh_minute()
        k1 = mk_key(admin, comp, "TEST_rl1")["key"]
        k2 = mk_key(admin, comp, "TEST_rl2")["key"]
        self._wait_fresh_minute()
        res = self._burst(k1, 130)
        print("burst end sec", time.time() % 60)
        codes = [c for c, _ in res]
        ok, lim = codes.count(200), codes.count(429)
        print("admin burst", ok, lim)
        assert ok == 120, codes
        assert lim == 10
        ra = [r for c, r in res if c == 429]
        assert all(r and 0 < int(r) <= 60 for r in ra), ra
        r2 = requests.get(f"{BASE_URL}/api/v1/me", headers={"Authorization": f"Bearer {k2}"})
        assert r2.status_code == 200

    def test_platino_60_limit(self):
        s = login(PLATINO)
        st = s.get(f"{BASE_URL}/api/developer/status").json()
        print("platino status", st)
        if st.get("rate") != 60:
            pytest.skip(f"clidemo1 not platino: {st}")
        comps = s.get(f"{BASE_URL}/api/developer/companies").json()
        r = s.post(f"{BASE_URL}/api/developer/keys", json={"name": "TEST_rlp", "company_id": comps[0]["id"], "scope": "read"})
        assert r.status_code == 200, r.text
        kd = r.json()
        try:
            self._wait_fresh_minute()
            codes = [c for c, _ in self._burst(kd["key"], 66)]
            print("platino burst", codes.count(200), codes.count(429))
            assert codes.count(200) == 60 and codes.count(429) == 6
        finally:
            s.delete(f"{BASE_URL}/api/developer/keys/{kd['id']}")
