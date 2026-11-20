# Iter 33: API REST pública v1 (claves por empresa, logs, rate limit, webhooks, openapi)
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = ("admin@fiscalhub.es", "admin123")
GEST = ("demo_gestoria@openfactura.es", "DemoGest123")
PLATINO = ("clidemo1@example.com", "CliDemo123")
MEDIO = ("clidemo2@example.com", "CliDemo123")

CREATED = {"keys": [], "hooks": [], "invoices": [], "contacts": [], "expenses": []}


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
    # cleanup only what we created
    for iid in CREATED["invoices"]:
        s.delete(f"{BASE_URL}/api/invoices/{iid}")
    for cid in CREATED["contacts"]:
        s.delete(f"{BASE_URL}/api/contacts/{cid}")
    for eid in CREATED["expenses"]:
        s.delete(f"{BASE_URL}/api/expenses/{eid}")
    for hid in CREATED["hooks"]:
        s.delete(f"{BASE_URL}/api/developer/webhooks/{hid}")
    for kid in CREATED["keys"]:
        s.delete(f"{BASE_URL}/api/developer/keys/{kid}")


@pytest.fixture(scope="module")
def companies(admin):
    comps = admin.get(f"{BASE_URL}/api/companies").json()
    named = [c for c in comps if c.get("name")]
    assert len(named) >= 2
    return named[0], named[1]


def mk_key(sess, cid, scope="write", name="TEST_key"):
    r = sess.post(f"{BASE_URL}/api/developer/keys", json={"name": name, "company_id": cid, "scope": scope})
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED["keys"].append(d["id"])
    return d


@pytest.fixture(scope="module")
def key_a(admin, companies):
    return mk_key(admin, companies[0]["id"], name="TEST_keyA")


@pytest.fixture(scope="module")
def key_b(admin, companies):
    return mk_key(admin, companies[1]["id"], name="TEST_keyB")


def H(k):
    return {"Authorization": f"Bearer {k}"}


INV = {"issue_date": time.strftime("%Y-%m-%d"),
       "client": {"name": "TEST_Cliente API", "nif": "B21796925", "country": "ES"},
       "line_items": [{"description": "TEST_servicio", "quantity": 1, "unit_price": 100, "iva_rate": 21}]}


# --- Status / access ---
class TestStatus:
    def test_admin_status(self, admin):
        d = admin.get(f"{BASE_URL}/api/developer/status").json()
        for f in ("allowed", "rate", "plan", "keys", "requests_24h", "errors_24h", "webhooks", "events"):
            assert f in d
        assert d["allowed"] is True and d["rate"] == 120

    def test_gestoria_allowed(self):
        d = login(GEST).get(f"{BASE_URL}/api/developer/status").json()
        assert d["allowed"] is True

    def test_platino_rate60(self):
        d = login(PLATINO).get(f"{BASE_URL}/api/developer/status").json()
        assert d["allowed"] is True and d["rate"] == 60

    def test_medio_denied(self):
        s = login(MEDIO)
        d = s.get(f"{BASE_URL}/api/developer/status").json()
        assert d["allowed"] is False
        cid = s.get(f"{BASE_URL}/api/companies").json()[0]["id"]
        r = s.post(f"{BASE_URL}/api/developer/keys", json={"name": "TEST_x", "company_id": cid})
        assert r.status_code == 403
        assert s.get(f"{BASE_URL}/api/developer/keys").status_code == 403


# --- Keys ---
class TestKeys:
    def test_key_shape_and_list_hides_hash(self, admin, key_a):
        assert key_a["key"].startswith("of_live_")
        lst = admin.get(f"{BASE_URL}/api/developer/keys").json()
        mine = [k for k in lst if k["id"] == key_a["id"]]
        assert mine and "key_hash" not in mine[0] and "key" not in mine[0]

    def test_foreign_company_404(self, admin):
        p = login(PLATINO)
        foreign = p.get(f"{BASE_URL}/api/companies").json()[0]["id"]
        r = admin.post(f"{BASE_URL}/api/developer/keys", json={"name": "TEST_f", "company_id": foreign})
        assert r.status_code == 404

    def test_revoke_then_401(self, admin, companies):
        k = mk_key(admin, companies[0]["id"], name="TEST_revoke")
        assert requests.get(f"{BASE_URL}/api/v1/me", headers=H(k["key"])).status_code == 200
        assert admin.delete(f"{BASE_URL}/api/developer/keys/{k['id']}").status_code == 200
        assert requests.get(f"{BASE_URL}/api/v1/me", headers=H(k["key"])).status_code == 401


# --- Auth on v1 ---
class TestV1Auth:
    def test_no_key(self):
        assert requests.get(f"{BASE_URL}/api/v1/me").status_code == 401

    def test_fake_key(self):
        assert requests.get(f"{BASE_URL}/api/v1/me", headers=H("of_live_fake123")).status_code == 401

    def test_x_api_key_header(self, key_a, companies):
        r = requests.get(f"{BASE_URL}/api/v1/me", headers={"X-API-Key": key_a["key"]})
        assert r.status_code == 200
        assert r.json()["company"]["id"] == companies[0]["id"]
        assert r.headers.get("X-OpenFactura-Api-Version") == "1"

    def test_read_scope_post_403(self, admin, companies):
        k = mk_key(admin, companies[0]["id"], scope="read", name="TEST_read")
        assert requests.get(f"{BASE_URL}/api/v1/clients", headers=H(k["key"])).status_code == 200
        r = requests.post(f"{BASE_URL}/api/v1/clients", headers=H(k["key"]), json={"name": "TEST_ro"})
        assert r.status_code == 403


# --- v1 CRUD ---
class TestV1Data:
    def test_clients(self, key_a):
        r = requests.post(f"{BASE_URL}/api/v1/clients", headers=H(key_a["key"]),
                          json={"name": "TEST_ClienteV1", "nif": "B21796925", "country": "ES"})
        assert r.status_code == 201, r.text
        CREATED["contacts"].append(r.json()["id"])
        lst = requests.get(f"{BASE_URL}/api/v1/clients", headers=H(key_a["key"])).json()
        assert any(c["id"] == r.json()["id"] for c in lst)

    def test_invoice_create_get_pdf(self, key_a, companies):
        r = requests.post(f"{BASE_URL}/api/v1/invoices", headers=H(key_a["key"]), json=INV)
        assert r.status_code == 201, r.text
        inv = r.json()
        CREATED["invoices"].append(inv["id"])
        assert inv["company_id"] == companies[0]["id"]
        g = requests.get(f"{BASE_URL}/api/v1/invoices/{inv['id']}", headers=H(key_a["key"]))
        assert g.status_code == 200 and g.json()["id"] == inv["id"]
        lst = requests.get(f"{BASE_URL}/api/v1/invoices", headers=H(key_a["key"])).json()
        assert any(i["id"] == inv["id"] for i in lst)
        p = requests.get(f"{BASE_URL}/api/v1/invoices/{inv['id']}/pdf", headers=H(key_a["key"]))
        assert p.status_code == 200 and "application/pdf" in p.headers.get("content-type", "")
        assert p.content[:4] == b"%PDF"

    def test_expenses(self, key_a):
        r = requests.post(f"{BASE_URL}/api/v1/expenses", headers=H(key_a["key"]),
                          json={"date": time.strftime("%Y-%m-%d"), "vendor_name": "TEST_Proveedor", "base_amount": 50})
        assert r.status_code == 201, r.text
        CREATED["expenses"].append(r.json()["id"])
        lst = requests.get(f"{BASE_URL}/api/v1/expenses", headers=H(key_a["key"])).json()
        assert any(e["id"] == r.json()["id"] for e in lst)

    def test_isolation_list(self, key_a, key_b):
        ids_a = {i["id"] for i in requests.get(f"{BASE_URL}/api/v1/invoices", headers=H(key_a["key"])).json()}
        lst_b = requests.get(f"{BASE_URL}/api/v1/invoices", headers=H(key_b["key"])).json()
        assert not ids_a.intersection({i["id"] for i in lst_b})
        assert all(i.get("company_id") == key_b["company_id"] for i in lst_b)

    def test_isolation_get_by_id(self, key_a, key_b):
        """Key of company B must NOT read invoice of company A by id."""
        inv_id = CREATED["invoices"][0]
        r = requests.get(f"{BASE_URL}/api/v1/invoices/{inv_id}", headers=H(key_b["key"]))
        assert r.status_code == 404, f"LEAK: key B read invoice of A ({r.status_code})"

    def test_isolation_pdf_by_id(self, key_b):
        inv_id = CREATED["invoices"][0]
        r = requests.get(f"{BASE_URL}/api/v1/invoices/{inv_id}/pdf", headers=H(key_b["key"]))
        assert r.status_code == 404, f"LEAK: key B downloaded PDF of A ({r.status_code})"


# --- Logs ---
class TestLogs:
    def test_logs_recorded(self, admin, key_a):
        before = admin.get(f"{BASE_URL}/api/developer/status").json()["requests_24h"]
        requests.get(f"{BASE_URL}/api/v1/me", headers=H(key_a["key"]))
        time.sleep(0.5)
        after = admin.get(f"{BASE_URL}/api/developer/status").json()["requests_24h"]
        assert after > before
        logs = admin.get(f"{BASE_URL}/api/developer/logs?key_id={key_a['id']}").json()
        assert logs
        for f in ("method", "path", "status", "ms", "key_name"):
            assert f in logs[0]
        assert logs[0]["key_name"] == "TEST_keyA"


# --- Webhooks ---
class TestWebhooks:
    def test_http_rejected(self, admin, companies):
        r = admin.post(f"{BASE_URL}/api/developer/webhooks",
                       json={"url": "http://example.com/hook", "company_id": companies[0]["id"]})
        assert r.status_code == 400

    def test_hook_lifecycle(self, admin, companies, key_a):
        r = admin.post(f"{BASE_URL}/api/developer/webhooks",
                       json={"url": "https://httpbin.org/post", "company_id": companies[0]["id"]})
        assert r.status_code == 200, r.text
        h = r.json()
        CREATED["hooks"].append(h["id"])
        assert h["secret"].startswith("whsec_")
        t = admin.post(f"{BASE_URL}/api/developer/webhooks/{h['id']}/test")
        assert t.status_code == 200 and t.json()["event"] == "ping"
        # invoice.created via v1
        inv = requests.post(f"{BASE_URL}/api/v1/invoices", headers=H(key_a["key"]), json=INV)
        assert inv.status_code == 201
        CREATED["invoices"].append(inv.json()["id"])
        found = False
        for _ in range(12):
            time.sleep(1)
            d = admin.get(f"{BASE_URL}/api/developer/webhooks").json()["deliveries"]
            if any(x["webhook_id"] == h["id"] and x["event"] == "invoice.created" for x in d):
                found = True
                break
        assert found
        assert admin.delete(f"{BASE_URL}/api/developer/webhooks/{h['id']}").status_code == 200
        lst = admin.get(f"{BASE_URL}/api/developer/webhooks").json()["webhooks"]
        assert not any(x["id"] == h["id"] for x in lst)


# --- OpenAPI ---
class TestDocs:
    def test_openapi(self):
        d = requests.get(f"{BASE_URL}/api/v1/openapi.json").json()
        assert "/api/v1/invoices" in d["paths"] and "/api/v1/me" in d["paths"]
        assert d["components"]["securitySchemes"]["ApiKey"]["scheme"] == "bearer"

    def test_swagger(self):
        r = requests.get(f"{BASE_URL}/api/v1/docs")
        assert r.status_code == 200 and "swagger" in r.text.lower()


# --- Rate limit (run last) ---
class TestZRateLimit:
    def test_platino_429(self):
        s = login(PLATINO)
        cid = s.get(f"{BASE_URL}/api/companies").json()[0]["id"]
        r = s.post(f"{BASE_URL}/api/developer/keys", json={"name": "TEST_rate", "company_id": cid})
        assert r.status_code == 200
        k = r.json()
        try:
            codes = []
            for _ in range(66):
                codes.append(requests.get(f"{BASE_URL}/api/v1/me", headers=H(k["key"])).status_code)
                if codes[-1] == 429:
                    break
            assert 429 in codes, f"no 429 after {len(codes)} reqs: {set(codes)}"
            assert codes.count(200) >= 55
        finally:
            s.delete(f"{BASE_URL}/api/developer/keys/{k['id']}")
