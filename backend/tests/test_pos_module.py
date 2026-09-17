"""POS module backend tests - iteration 18."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_EMAIL = "admin@fiscalhub.es"
ADMIN_PASSWORD = "admin123"
USER_EMAIL = "demo_pricing@example.com"
USER_PASSWORD = "test1234"

HEADERS = {"Content-Type": "application/json", "X-OF-Client": "web"}


def _login(email: str, password: str):
    s = requests.Session()
    s.headers.update(HEADERS)
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return s, r.json()


@pytest.fixture(scope="module")
def admin():
    s, me = _login(ADMIN_EMAIL, ADMIN_PASSWORD)
    return s, me


@pytest.fixture(scope="module")
def user_basic():
    s, me = _login(USER_EMAIL, USER_PASSWORD)
    return s, me


# ---------- GATING ----------
class TestGating:
    def test_basic_user_denied_pos_endpoints(self, user_basic):
        s, _ = user_basic
        for path in ["/api/pos/settings", "/api/pos/products", "/api/pos/categories",
                     "/api/pos/tables", "/api/pos/session/current", "/api/pos/tickets"]:
            r = s.get(f"{BASE_URL}{path}", timeout=15)
            assert r.status_code == 403, f"{path}: expected 403 got {r.status_code}"

    def test_admin_has_access(self, admin):
        s, _ = admin
        r = s.get(f"{BASE_URL}/api/pos/settings", timeout=15)
        assert r.status_code == 200


# ---------- Admin toggle ----------
class TestAdminToggle:
    def test_admin_pos_toggle_flow(self, admin, user_basic):
        adm_s, _ = admin
        user_s, user_me = user_basic
        user_id = user_me["id"]

        # list users and find is_pos_enabled key
        r = adm_s.get(f"{BASE_URL}/api/admin/users?q={USER_EMAIL}", timeout=20)
        assert r.status_code == 200
        row = next((u for u in r.json() if u["email"] == USER_EMAIL), None)
        assert row is not None, "user not in list"
        assert "is_pos_enabled" in row
        initial = row["is_pos_enabled"]

        # Toggle ON if not
        target_on = not initial
        r = adm_s.post(f"{BASE_URL}/api/admin/users/{user_id}/pos-toggle", timeout=15)
        assert r.status_code == 200
        assert r.json()["is_pos_enabled"] == target_on

        # Refresh user session (cookie still valid) and check access after ensuring it's ON
        if not target_on:
            # toggle again to ON
            r = adm_s.post(f"{BASE_URL}/api/admin/users/{user_id}/pos-toggle", timeout=15)
            assert r.status_code == 200
            assert r.json()["is_pos_enabled"] is True

        # re-login user to get fresh token with pos_enabled reflected (session-based on user doc lookup - should be immediate)
        u2, _ = _login(USER_EMAIL, USER_PASSWORD)
        r = u2.get(f"{BASE_URL}/api/pos/settings", timeout=15)
        assert r.status_code == 200, f"user with pos_enabled should access: {r.status_code} {r.text}"

        # Turn OFF and verify 403 again
        r = adm_s.post(f"{BASE_URL}/api/admin/users/{user_id}/pos-toggle", timeout=15)
        assert r.status_code == 200
        assert r.json()["is_pos_enabled"] is False
        u3, _ = _login(USER_EMAIL, USER_PASSWORD)
        r = u3.get(f"{BASE_URL}/api/pos/settings", timeout=15)
        assert r.status_code == 403


# ---------- Settings ----------
class TestSettings:
    def test_get_settings_defaults(self, admin):
        s, _ = admin
        r = s.get(f"{BASE_URL}/api/pos/settings", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("pos_type") in ("retail", "hosteleria")
        assert str(d.get("ticket_width")) in ("80", "58")

    def test_put_settings_valid_and_invalid(self, admin):
        s, _ = admin
        # invalid pos_type
        r = s.put(f"{BASE_URL}/api/pos/settings", json={"pos_type": "bar"}, timeout=15)
        assert r.status_code == 400
        # invalid width
        r = s.put(f"{BASE_URL}/api/pos/settings", json={"ticket_width": "72"}, timeout=15)
        assert r.status_code == 400
        # valid update to hosteleria/58
        r = s.put(f"{BASE_URL}/api/pos/settings",
                  json={"pos_type": "hosteleria", "ticket_width": "58",
                        "tip_enabled": True, "verifactu_tickets": True,
                        "business_name": "TEST Bar", "footer_note": "gracias"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["pos_type"] == "hosteleria"
        assert str(d["ticket_width"]) == "58"
        assert d["verifactu_tickets"] is True
        # revert to retail 80 for stability
        r = s.put(f"{BASE_URL}/api/pos/settings",
                  json={"pos_type": "retail", "ticket_width": "80"}, timeout=15)
        assert r.status_code == 200


# ---------- Categories + Products ----------
class TestCatalog:
    def test_categories_crud_and_product(self, admin):
        s, _ = admin
        # create cat
        r = s.post(f"{BASE_URL}/api/pos/categories",
                   json={"name": "TEST_Cat", "color": "#ff0000"}, timeout=15)
        assert r.status_code == 200
        cat = r.json()
        cid = cat["id"]
        # list
        r = s.get(f"{BASE_URL}/api/pos/categories", timeout=15)
        assert r.status_code == 200
        assert any(c["id"] == cid for c in r.json())
        # edit
        r = s.put(f"{BASE_URL}/api/pos/categories/{cid}", json={"name": "TEST_Cat2"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Cat2"

        # create product in category with variants+stock
        r = s.post(f"{BASE_URL}/api/pos/products",
                   json={"name": "TEST_Prod", "category_id": cid, "price": 12.10,
                         "tax_rate": 21, "track_stock": True, "stock": 50,
                         "variants": [{"name": "S", "price_delta": 0, "stock": 10},
                                      {"name": "M", "price_delta": 1, "stock": 20}]},
                   timeout=15)
        assert r.status_code == 200
        prod = r.json()
        pid = prod["id"]
        assert prod["stock"] == 50
        assert len(prod["variants"]) == 2

        # edit product
        r = s.put(f"{BASE_URL}/api/pos/products/{pid}",
                  json={"name": "TEST_Prod2", "price": 15, "tax_rate": 21,
                        "track_stock": True, "stock": 60}, timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Prod2"

        # delete category -> product should have category_id=None
        r = s.delete(f"{BASE_URL}/api/pos/categories/{cid}", timeout=15)
        assert r.status_code == 200
        r = s.get(f"{BASE_URL}/api/pos/products", timeout=15)
        prods = r.json()
        p = next((x for x in prods if x["id"] == pid), None)
        assert p and p.get("category_id") in (None, "")

        # delete product
        r = s.delete(f"{BASE_URL}/api/pos/products/{pid}", timeout=15)
        assert r.status_code == 200


# ---------- Tables ----------
class TestTables:
    def test_tables_crud(self, admin):
        s, _ = admin
        r = s.post(f"{BASE_URL}/api/pos/tables", json={"name": "TEST_M1", "room": "Sala"}, timeout=15)
        assert r.status_code == 200
        tid = r.json()["id"]
        r = s.get(f"{BASE_URL}/api/pos/tables", timeout=15)
        assert r.status_code == 200
        t = next((x for x in r.json() if x["id"] == tid), None)
        assert t is not None
        assert "open_ticket_id" in t
        r = s.put(f"{BASE_URL}/api/pos/tables/{tid}", json={"name": "TEST_M1b"}, timeout=15)
        assert r.status_code == 200
        r = s.delete(f"{BASE_URL}/api/pos/tables/{tid}", timeout=15)
        assert r.status_code == 200


# ---------- Session ----------
class TestSession:
    def test_session_state_and_movement(self, admin):
        s, _ = admin
        r = s.get(f"{BASE_URL}/api/pos/session/current", timeout=15)
        assert r.status_code == 200
        # According to context, admin already has an open session from manual test
        # If none, open one
        current = r.json()
        if current is None:
            r = s.post(f"{BASE_URL}/api/pos/session/open", json={"opening_cash": 100}, timeout=15)
            assert r.status_code == 200
        # Try to open again -> 400
        r = s.post(f"{BASE_URL}/api/pos/session/open", json={"opening_cash": 50}, timeout=15)
        assert r.status_code == 400

        # Add withdrawal
        r = s.post(f"{BASE_URL}/api/pos/session/movement",
                   json={"type": "withdrawal", "amount": 5, "reason": "TEST"}, timeout=15)
        assert r.status_code == 200
        # invalid movement
        r = s.post(f"{BASE_URL}/api/pos/session/movement",
                   json={"type": "foo", "amount": 5}, timeout=15)
        assert r.status_code == 400
        r = s.post(f"{BASE_URL}/api/pos/session/movement",
                   json={"type": "deposit", "amount": 0}, timeout=15)
        assert r.status_code == 400

        # summary present
        r = s.get(f"{BASE_URL}/api/pos/session/current", timeout=15)
        d = r.json()
        assert "expected_cash" in d
        assert "movements" in d


# ---------- Retail sale flow ----------
class TestRetailSale:
    def test_sale_mixto_and_tarjeta_and_refund(self, admin):
        s, _ = admin
        # ensure retail mode
        s.put(f"{BASE_URL}/api/pos/settings", json={"pos_type": "retail", "ticket_width": "80"}, timeout=15)
        # create test product with stock 10
        r = s.post(f"{BASE_URL}/api/pos/products",
                   json={"name": "TEST_SaleProd", "price": 10.00, "tax_rate": 21,
                         "track_stock": True, "stock": 10}, timeout=15)
        assert r.status_code == 200
        prod = r.json()
        pid = prod["id"]

        # --- MIXTO sale: 2 units * 10 = 20 + tip 1 = 21 total; cash=5, card=16
        payload = {
            "status": "paid",
            "items": [{"product_id": pid, "name": "TEST_SaleProd", "qty": 2,
                       "unit_price": 10.00, "tax_rate": 21}],
            "tip": 1,
            "payment_method": "mixto",
            "payment_cash": 5,
        }
        r = s.post(f"{BASE_URL}/api/pos/tickets", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["number"].startswith("T-")
        assert t["total"] == 21.00
        assert t["tip"] == 1.00
        # base+iva check: base = 20/1.21 = 16.53, iva=3.47
        assert abs(t["base_total"] - 16.53) < 0.02
        assert abs(t["tax_total"] - 3.47) < 0.02
        assert t["payment_method"] == "mixto"
        assert t["payment_cash"] == 5
        assert t["payment_card"] == 16.00

        # verify stock decremented 10 -> 8
        r = s.get(f"{BASE_URL}/api/pos/products", timeout=15)
        cur = next(x for x in r.json() if x["id"] == pid)
        assert cur["stock"] == 8, f"stock should be 8, got {cur['stock']}"

        # refund → stock back to 10
        tid = t["id"]
        r = s.post(f"{BASE_URL}/api/pos/tickets/{tid}/refund", timeout=15)
        assert r.status_code == 200
        r = s.get(f"{BASE_URL}/api/pos/products", timeout=15)
        cur = next(x for x in r.json() if x["id"] == pid)
        assert cur["stock"] == 10

        # cannot refund again
        r = s.post(f"{BASE_URL}/api/pos/tickets/{tid}/refund", timeout=15)
        assert r.status_code == 400

        # --- TARJETA sale: verify payment_cash=0, payment_card=total
        payload = {
            "status": "paid",
            "items": [{"product_id": pid, "name": "TEST_SaleProd", "qty": 1,
                       "unit_price": 10.00, "tax_rate": 21}],
            "payment_method": "tarjeta",
        }
        r = s.post(f"{BASE_URL}/api/pos/tickets", json=payload, timeout=20)
        assert r.status_code == 200
        t2 = r.json()
        assert t2["payment_method"] == "tarjeta"
        assert t2["payment_cash"] == 0
        assert t2["payment_card"] == 10.00

        # receipt endpoints
        for w in ("80", "58"):
            r = s.get(f"{BASE_URL}/api/pos/tickets/{t2['id']}/receipt?width={w}", timeout=15)
            assert r.status_code == 200
            assert "TOTAL" in r.text
            assert "Tarjeta" in r.text

        # invalid ticket: no items
        r = s.post(f"{BASE_URL}/api/pos/tickets",
                   json={"status": "paid", "items": [], "payment_method": "efectivo"}, timeout=15)
        assert r.status_code == 400

        # cleanup product
        s.delete(f"{BASE_URL}/api/pos/products/{pid}", timeout=15)


# ---------- Hostelería flow ----------
class TestHosteleria:
    def test_open_ticket_update_pay_and_delete(self, admin):
        s, _ = admin
        # switch to hostelería
        s.put(f"{BASE_URL}/api/pos/settings", json={"pos_type": "hosteleria", "ticket_width": "80"}, timeout=15)
        # create table
        r = s.post(f"{BASE_URL}/api/pos/tables", json={"name": "TEST_M99"}, timeout=15)
        assert r.status_code == 200
        table = r.json()

        # create product with stock
        r = s.post(f"{BASE_URL}/api/pos/products",
                   json={"name": "TEST_Beer", "price": 3.00, "tax_rate": 10,
                         "track_stock": True, "stock": 20}, timeout=15)
        pid = r.json()["id"]

        # open comanda
        payload = {
            "status": "open",
            "table_id": table["id"], "table_name": table["name"],
            "items": [{"product_id": pid, "name": "TEST_Beer", "qty": 1,
                       "unit_price": 3.00, "tax_rate": 10}],
        }
        r = s.post(f"{BASE_URL}/api/pos/tickets", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        tk = r.json()
        assert tk["status"] == "open"
        assert tk["number"] is None
        tid = tk["id"]

        # tables should now show open_ticket_id
        r = s.get(f"{BASE_URL}/api/pos/tables", timeout=15)
        row = next(x for x in r.json() if x["id"] == table["id"])
        assert row["open_ticket_id"] == tid

        # update ticket - add another beer
        r = s.put(f"{BASE_URL}/api/pos/tickets/{tid}",
                  json={"items": [{"product_id": pid, "name": "TEST_Beer", "qty": 2,
                                   "unit_price": 3.00, "tax_rate": 10}]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["total"] == 6.00

        # stock should not be decremented yet
        r = s.get(f"{BASE_URL}/api/pos/products", timeout=15)
        cur = next(x for x in r.json() if x["id"] == pid)
        assert cur["stock"] == 20

        # pay it
        r = s.post(f"{BASE_URL}/api/pos/tickets/{tid}/pay",
                   json={"payment_method": "efectivo"}, timeout=15)
        assert r.status_code == 200
        paid = r.json()
        assert paid["status"] == "paid"
        assert paid["number"] is not None
        assert paid["payment_cash"] == 6.00

        # stock now decremented
        r = s.get(f"{BASE_URL}/api/pos/products", timeout=15)
        cur = next(x for x in r.json() if x["id"] == pid)
        assert cur["stock"] == 18

        # cannot delete paid ticket
        r = s.delete(f"{BASE_URL}/api/pos/tickets/{tid}", timeout=15)
        assert r.status_code == 400

        # New open comanda that we DELETE
        r = s.post(f"{BASE_URL}/api/pos/tickets",
                   json={"status": "open", "table_id": table["id"], "table_name": table["name"],
                         "items": [{"product_id": pid, "name": "TEST_Beer", "qty": 1,
                                    "unit_price": 3.00, "tax_rate": 10}]}, timeout=15)
        assert r.status_code == 200
        r = s.delete(f"{BASE_URL}/api/pos/tickets/{r.json()['id']}", timeout=15)
        assert r.status_code == 200

        # cleanup
        s.delete(f"{BASE_URL}/api/pos/tables/{table['id']}", timeout=15)
        s.delete(f"{BASE_URL}/api/pos/products/{pid}", timeout=15)
        # revert settings to retail
        s.put(f"{BASE_URL}/api/pos/settings", json={"pos_type": "retail", "ticket_width": "80"}, timeout=15)
