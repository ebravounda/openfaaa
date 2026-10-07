"""Iter 22 — Remesas SEPA (gestoría) + Contabilidad (admin). Tests end-to-end sobre el backend
público. Deja limpio tras el run: borra remesas/deudores TEST, bank_transactions TEST_,
journal_entries de prueba, activos TEST_, restaura nombre/NIF empresa gestoría y pgc_plan admin."""
import os
import io
import time
import uuid
import pytest
import requests
from pymongo import MongoClient
from bson import ObjectId

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/") or "https://sistema-impuestos.preview.emergentagent.com"
CSV_PATH = "/tmp/julio.csv"

MONGO = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
DB = MONGO[os.environ.get("DB_NAME", "test_database")]


def _login(email, password):
    s = requests.Session()
    s.headers.update({"X-OF-Client": "web"})
    r = s.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def gest():
    return _login("demo_gestoria@openfactura.es", "DemoGest123")


@pytest.fixture(scope="module")
def admin():
    return _login("admin@fiscalhub.es", "admin123")


@pytest.fixture(scope="module")
def gest_ids(gest):
    me = gest.get(f"{BASE}/api/auth/me", timeout=15).json()
    comp = gest.get(f"{BASE}/api/company", timeout=15).json()
    return {"user_id": me.get("id"), "email": me.get("email"), "company_id": comp.get("id"),
            "company_name": comp.get("name", ""), "company_nif": comp.get("nif", "")}


# ======================= REMESAS =======================

class TestRemesasImport:
    def test_import_csv_julio(self, gest):
        with open(CSV_PATH, "rb") as f:
            raw = f.read()
        files = {"file": ("julio.csv", raw, "text/csv")}
        r = gest.post(f"{BASE}/api/gestoria/remesas/importar?name=TEST_Julio_iter22", files=files, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()["remesa"]
        pytest.rid = data["id"]
        assert data["count"] == 25
        assert abs(data["total"] - 8215.79) < 0.05, f"total={data['total']}"

    def test_remesa_in_list(self, gest):
        r = gest.get(f"{BASE}/api/gestoria/remesas", timeout=15)
        assert r.status_code == 200
        assert any(x["id"] == pytest.rid for x in r.json())


class TestRemesaExport:
    def test_export_csv_columns(self, gest):
        r = gest.get(f"{BASE}/api/gestoria/remesas/{pytest.rid}/exportar?formato=csv", timeout=30)
        assert r.status_code == 200
        text = r.content.decode("utf-8-sig")
        head = text.splitlines()[0].split(";")
        assert head == ["Nº", "Importe", "Fecha cobro", "Nombre deudor", "Identificador deudor",
                        "IBAN", "Mandato", "Fecha mandato", "Referencia operación", "Concepto"], head
        # 25 líneas + header
        assert len(text.strip().splitlines()) == 26

    def test_export_xlsx(self, gest):
        r = gest.get(f"{BASE}/api/gestoria/remesas/{pytest.rid}/exportar?formato=xlsx", timeout=30)
        assert r.status_code == 200
        assert r.content[:2] == b"PK"


class TestRemesaEdit:
    def test_edit_line_name_and_nif(self, gest):
        r = gest.get(f"{BASE}/api/gestoria/remesas/{pytest.rid}", timeout=15).json()
        lines = r["lines"]
        lines[0]["name"] = "TEST Cliente Uno SL"
        lines[0]["nif"] = "B12345674"
        lines[1]["name"] = "TEST Cliente Dos SL"
        lines[1]["nif"] = "B12345674"
        payload = {"name": r["name"], "charge_date": r.get("charge_date", ""), "reference": r.get("reference", ""),
                   "lines": [{k: v for k, v in ln.items() if k != "warnings"} for ln in lines]}
        rr = gest.put(f"{BASE}/api/gestoria/remesas/{pytest.rid}", json=payload, timeout=30)
        assert rr.status_code == 200, rr.text
        data = rr.json()
        names = {ln["name"] for ln in data["lines"][:2]}
        assert "TEST Cliente Uno SL" in names and "TEST Cliente Dos SL" in names


class TestRemesaFacturasRequiresCompany:
    def test_fail_without_company_name(self, gest, gest_ids):
        # Set empty name/nif
        DB.companies.update_one({"id": gest_ids["company_id"]}, {"$set": {"name": "", "nif": ""}})
        r = gest.post(f"{BASE}/api/gestoria/remesas/{pytest.rid}/facturas", timeout=30)
        assert r.status_code == 400
        assert "nombre" in r.text.lower() or "nif" in r.text.lower()

    def test_set_company_and_emit(self, gest, gest_ids):
        # Set via /api/company
        rr = gest.put(f"{BASE}/api/company", json={"name": "TEST Gestoria SL", "nif": "B12345674"}, timeout=15)
        assert rr.status_code == 200, rr.text
        r = gest.post(f"{BASE}/api/gestoria/remesas/{pytest.rid}/facturas", timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        # First 2 lines had name assigned, 23 remain without name -> errors
        assert data["created"] >= 2
        # Must report errors for lines without name
        assert len(data["errors"]) >= 20

    def test_invoice_base_iva_exact_242(self, gest):
        r = gest.get(f"{BASE}/api/gestoria/remesas/{pytest.rid}", timeout=15).json()
        inv_ids = [ln["invoice_id"] for ln in r["lines"] if ln.get("invoice_id")]
        assert inv_ids
        for iid in inv_ids:
            inv = DB.invoices.find_one({"id": iid}, {"_id": 0, "total": 1, "base": 1, "iva_amount": 1})
            assert abs(round(inv["base"] + inv["iva_amount"], 2) - round(inv["total"], 2)) < 0.005
            # Fetch line to compare with original importe
        # Specific check for the 242 line (line #4 in csv) and 145.2 if present
        # Find invoice whose total == 242.00
        inv_242 = next((DB.invoices.find_one({"id": iid}) for iid in inv_ids
                        if DB.invoices.find_one({"id": iid, "total": 242.0})), None)
        if inv_242:
            assert round(inv_242["base"], 2) == 200.00
            assert round(inv_242["iva_amount"], 2) == 42.00

    def test_cannot_change_invoiced_amount(self, gest):
        r = gest.get(f"{BASE}/api/gestoria/remesas/{pytest.rid}", timeout=15).json()
        lines = r["lines"]
        # First line has invoice; try to change amount
        inv_line_idx = next(i for i, ln in enumerate(lines) if ln.get("invoice_id"))
        lines[inv_line_idx]["amount"] = lines[inv_line_idx]["amount"] + 10
        payload = {"name": r["name"], "charge_date": r.get("charge_date", ""), "reference": r.get("reference", ""),
                   "lines": [{k: v for k, v in ln.items() if k != "warnings"} for ln in lines]}
        rr = gest.put(f"{BASE}/api/gestoria/remesas/{pytest.rid}", json=payload, timeout=30)
        assert rr.status_code == 400
        assert "importe" in rr.text.lower() or "rectificativa" in rr.text.lower()


class TestCobroManualYAuto:
    def test_mark_line_paid(self, gest):
        r = gest.get(f"{BASE}/api/gestoria/remesas/{pytest.rid}", timeout=15).json()
        ln = next(x for x in r["lines"] if x.get("invoice_id"))
        rr = gest.post(f"{BASE}/api/gestoria/remesas/{pytest.rid}/lineas/{ln['id']}/cobro",
                       json={"paid": True, "date": "2026-01-15"}, timeout=15)
        assert rr.status_code == 200
        data = rr.json()
        assert data["status"] in ("parcial", "cobrada")
        inv = DB.invoices.find_one({"id": ln["invoice_id"]})
        assert inv["status"] == "paid"

    def test_detect_automatic(self, gest, gest_ids):
        # Insert bank_transaction equal to a specific pending line amount with mandate in label
        r = gest.get(f"{BASE}/api/gestoria/remesas/{pytest.rid}", timeout=15).json()
        pend = [ln for ln in r["lines"] if not ln.get("paid") and ln.get("invoice_id")]
        assert pend, "need at least one pending invoiced line"
        target = pend[0]
        tx = {"id": "TEST_tx_rem_line", "company_id": gest_ids["company_id"],
              "value": round(float(target["amount"]), 2), "date": "2026-01-20",
              "label": f"COBRO SEPA {target.get('mandate', '')} {target.get('name', '')}",
              "matched": False, "deleted": False}
        DB.bank_transactions.insert_one(tx)
        rr = gest.post(f"{BASE}/api/gestoria/remesas/comprobar-cobros", timeout=30)
        assert rr.status_code == 200, rr.text
        found = rr.json().get("found", [])
        assert found, f"no detection, resp={rr.json()}"
        tx2 = DB.bank_transactions.find_one({"id": "TEST_tx_rem_line"})
        assert tx2.get("matched") is True
        assert tx2.get("matched_type") == "remesa"
        notif = DB.notifications.find_one({"type": "conciliacion", "user_id": gest_ids["user_id"]},
                                          sort=[("created_at", -1)])
        assert notif is not None


class TestDeudoresCRUD:
    def test_create_update_delete(self, gest):
        r = gest.post(f"{BASE}/api/gestoria/remesas/deudores",
                      json={"name": "TEST Deudor X", "nif": "B12345674",
                            "iban": "ES9121000418450200051332", "mandate": "MND-TEST",
                            "mandate_date": "2026-01-01", "amount": 100.0, "concept": "TEST"},
                      timeout=15)
        assert r.status_code == 200, r.text
        did = r.json()["id"]
        rr = gest.put(f"{BASE}/api/gestoria/remesas/deudores/{did}",
                      json={"name": "TEST Deudor X2", "nif": "B12345674",
                            "iban": "ES9121000418450200051332", "mandate": "MND-TEST",
                            "mandate_date": "2026-01-01", "amount": 150.0, "concept": "TEST"},
                      timeout=15)
        assert rr.status_code == 200
        rrr = gest.delete(f"{BASE}/api/gestoria/remesas/deudores/{did}", timeout=15)
        assert rrr.status_code == 200

    def test_from_clients(self, gest):
        r = gest.post(f"{BASE}/api/gestoria/remesas/deudores/desde-clientes", timeout=30)
        assert r.status_code == 200
        assert "created" in r.json()


class TestDuplicateDelete:
    def test_duplicate(self, gest):
        r = gest.post(f"{BASE}/api/gestoria/remesas/{pytest.rid}/duplicar",
                      json={"name": "TEST_Julio_iter22_dup", "charge_date": ""}, timeout=15)
        assert r.status_code == 200, r.text
        pytest.rid_dup = r.json()["id"]

    def test_delete_with_invoices_blocked(self, gest):
        r = gest.delete(f"{BASE}/api/gestoria/remesas/{pytest.rid}", timeout=15)
        assert r.status_code == 400

    def test_delete_dup_ok(self, gest):
        r = gest.delete(f"{BASE}/api/gestoria/remesas/{pytest.rid_dup}", timeout=15)
        assert r.status_code == 200


# ======================= CONTABILIDAD (admin) =======================

class TestAdminQuarterAccounting:
    def test_quarter(self, admin):
        r = admin.get(f"{BASE}/api/contabilidad/trimestre", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["year"] == 2026
        # progress 0-100
        assert 0 <= d["progress"] <= 100

    def test_balance_cuadra(self, admin):
        r = admin.get(f"{BASE}/api/contabilidad/balance?year=2026", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["cuadra"] is True, f"activo={d['activo']['total']} pasivo={d['pasivo']['total']}"

    def test_diario_cuadra(self, admin):
        r = admin.get(f"{BASE}/api/contabilidad/diario?year=2026", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert abs(d["debe"] - d["haber"]) < 0.02

    def test_change_plan_normal_and_back(self, admin):
        r = admin.put(f"{BASE}/api/contabilidad/config", json={"plan": "normal"}, timeout=15)
        assert r.status_code == 200
        b = admin.get(f"{BASE}/api/contabilidad/balance?year=2026", timeout=15).json()
        assert "normal" in b["modelo"].lower()
        # restore
        admin.put(f"{BASE}/api/contabilidad/config", json={"plan": "pymes"}, timeout=15)

    def test_sumas_mayor_pyg(self, admin):
        for ep in ("sumas-saldos", "pyg", "volumen"):
            r = admin.get(f"{BASE}/api/contabilidad/{ep}?year=2026", timeout=20)
            assert r.status_code == 200, f"{ep}: {r.status_code}"

    def test_asset_create(self, admin):
        r = admin.post(f"{BASE}/api/contabilidad/activos",
                       json={"name": "TEST portátil", "asset_type": "informatica", "cost": 1200,
                             "start_date": "2026-01-15"}, timeout=15)
        assert r.status_code == 200, r.text
        pytest.asset_id = r.json()["id"]
        assert r.json()["rate"] == 25
        # Amortización año desde ene a mes actual: 1200*0.25/12 * n_meses
        # Just assert valor > 0 after reading list
        rr = admin.get(f"{BASE}/api/contabilidad/activos", timeout=15)
        assert rr.status_code == 200
        a = next(x for x in rr.json() if x["id"] == pytest.asset_id)
        assert a["amort_year"] > 0

    def test_asset_rate_too_high(self, admin):
        r = admin.post(f"{BASE}/api/contabilidad/activos",
                       json={"name": "TEST sobrepasada", "asset_type": "informatica", "cost": 100,
                             "start_date": "2026-01-15", "rate": 99}, timeout=15)
        assert r.status_code == 400

    def test_journal_balanced(self, admin):
        r = admin.post(f"{BASE}/api/contabilidad/asientos",
                       json={"date": "2026-01-10", "concept": "TEST manual",
                             "lines": [{"account": "572", "debe": 100, "haber": 0},
                                       {"account": "100", "debe": 0, "haber": 100}]}, timeout=15)
        assert r.status_code == 200
        pytest.journal_id = r.json()["id"]

    def test_journal_unbalanced_blocked(self, admin):
        r = admin.post(f"{BASE}/api/contabilidad/asientos",
                       json={"date": "2026-01-10", "concept": "TEST descuadrado",
                             "lines": [{"account": "572", "debe": 100, "haber": 0},
                                       {"account": "100", "debe": 0, "haber": 50}]}, timeout=15)
        assert r.status_code == 400
        assert "cuadra" in r.text.lower()

    def test_balance_still_cuadra_after_mods(self, admin):
        r = admin.get(f"{BASE}/api/contabilidad/balance?year=2026", timeout=20)
        assert r.status_code == 200
        assert r.json()["cuadra"] is True

    def test_export_all_books(self, admin):
        for libro in ("diario", "mayor", "sumas", "balance", "pyg"):
            r = admin.get(f"{BASE}/api/contabilidad/exportar?libro={libro}&year=2026", timeout=30)
            assert r.status_code == 200, f"{libro}: {r.status_code}"
            assert r.content[:2] == b"PK"

    def test_categorias_contain_new(self, admin):
        r = admin.get(f"{BASE}/api/contabilidad/categorias?year=2026", timeout=20)
        assert r.status_code == 200
        names = {c["name"] for c in r.json()["expense_categories"]}
        assert "Restauración y dietas" in names
        assert "Telefonía e internet" in names


# ======================= CLEANUP =======================

def test_zzz_cleanup(gest, admin, gest_ids):
    # Delete journal_entries created
    if hasattr(pytest, "journal_id"):
        DB.journal_entries.delete_many({"id": pytest.journal_id})
    # Delete fixed_assets TEST
    DB.fixed_assets.delete_many({"name": {"$regex": "^TEST"}})
    # Delete remesa (dup already deleted) — borrar invoices creadas por la remesa, luego la remesa
    DB.invoices.delete_many({"remesa_id": pytest.rid})
    DB.remesas.delete_many({"gestoria_id": gest_ids["user_id"]})  # pytest.rid plus any TEST_Julio
    # Also delete remesa by main agent "TEST_Julio" if any
    DB.remesas.delete_many({"name": {"$regex": "^TEST_"}})
    DB.remesa_debtors.delete_many({"gestoria_id": gest_ids["user_id"]})
    # bank_transactions TEST_
    DB.bank_transactions.delete_many({"id": {"$regex": "^TEST_"}})
    # notifications test
    DB.notifications.delete_many({"type": "conciliacion", "title": "Cobro de remesa detectado"})
    # restore gestoria company name/nif (was empty originally)
    DB.companies.update_one({"id": gest_ids["company_id"]},
                            {"$set": {"name": gest_ids["company_name"], "nif": gest_ids["company_nif"]}})
    # Restore admin pgc_plan to pymes
    admin.put(f"{BASE}/api/contabilidad/config", json={"plan": "pymes"}, timeout=15)
    print("cleanup ok")
