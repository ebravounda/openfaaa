"""Iter 24 – Remesas SEPA: IVA (incluido en recibo), exentos, facturación por cliente,
recibos PDF, SEPA XML pain.008, lock tras factura, importación con IVA/Exento,
check-payments detecta remesas emitidas, resumen pending."""
import os
import io
import re
import csv
import pytest
import requests

def _load_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    v = line.split("=", 1)[1].strip()
                    break
    assert v, "REACT_APP_BACKEND_URL not set"
    return v.rstrip("/")

BASE = _load_url()
HDR = {"X-OF-Client": "web"}
EMAIL = "demo_gestoria@openfactura.es"
PWD = "DemoGest123"


@pytest.fixture(scope="module")
def ses():
    s = requests.Session()
    s.headers.update(HDR)
    r = s.post(f"{BASE}/api/auth/login", json={"email": EMAIL, "password": PWD})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def issuer_ok(ses):
    """Asegura datos fiscales + SEPA iban/creditor completos."""
    payload = {
        "name": "TEST Asesoría",
        "legal_name": "TEST Asesoría SL",
        "nif": "B12345674",
        "address": "Calle Mayor 1, 28001 Madrid",
        "email": "",
        "phone": "",
        "tax_type": "sociedad",
        "legal_notice": "",
        "invoice_footer": "",
        "sepa_creditor_id": "",
        "sepa_iban": "ES9121000418450200051332",
        "sepa_bic": "CAIXESBBXXX",
    }
    r = ses.put(f"{BASE}/api/gestoria/remesas/ajustes/emisor", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["nif"] == "B12345674"
    assert d["sepa_iban"] == "ES9121000418450200051332"
    assert d["sepa_missing"] == []
    return d


# ---------- Emisor / SEPA fields ----------
class TestIssuer:
    def test_get_issuer_has_sepa_fields(self, ses, issuer_ok):
        r = ses.get(f"{BASE}/api/gestoria/remesas/ajustes/emisor")
        assert r.status_code == 200
        d = r.json()
        for k in ("sepa_iban", "sepa_bic", "sepa_creditor_id", "suggested_creditor_id"):
            assert k in d
        assert d["suggested_creditor_id"].startswith("ES") and "B12345674" in d["suggested_creditor_id"]

    def test_invalid_sepa_iban_400(self, ses, issuer_ok):
        bad = {**issuer_ok, "sepa_iban": "ES00INVALID"}
        bad = {k: bad.get(k, "") for k in ("name", "legal_name", "nif", "address", "email", "phone",
                                           "tax_type", "legal_notice", "invoice_footer",
                                           "sepa_creditor_id", "sepa_iban", "sepa_bic")}
        r = ses.put(f"{BASE}/api/gestoria/remesas/ajustes/emisor", json=bad)
        assert r.status_code == 400
        # restaurar
        good = {**bad, "sepa_iban": "ES9121000418450200051332"}
        assert ses.put(f"{BASE}/api/gestoria/remesas/ajustes/emisor", json=good).status_code == 200


# ---------- Deudores con IVA / exento ----------
@pytest.fixture(scope="module")
def debtor_normal(ses, issuer_ok):
    r = ses.post(f"{BASE}/api/gestoria/remesas/deudores", json={
        "name": "TEST Cliente IVA 21",
        "nif": "12345678Z",
        "iban": "ES9121000418450200051332",
        "mandate": "TEST-M-21",
        "mandate_date": "2026-01-10",
        "email": "cli21@test.com",
        "amount": 121.0,
        "iva_rate": 21,
        "vat_exempt": False,
        "concept": "Asesoría enero",
    })
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def debtor_exento(ses, issuer_ok):
    r = ses.post(f"{BASE}/api/gestoria/remesas/deudores", json={
        "name": "TEST Cliente Exento",
        "nif": "B12345674",
        "iban": "ES9121000418450200051332",
        "mandate": "TEST-M-EX",
        "mandate_date": "2026-01-10",
        "amount": 100.0,
        "iva_rate": 0,
        "vat_exempt": True,
        "exempt_reason": "Exento art. 20.Uno.9 LIVA (enseñanza)",
        "concept": "Formación enero",
    })
    assert r.status_code == 200, r.text
    return r.json()


class TestDebtorTax:
    def test_debtor_persists_iva_fields(self, ses, debtor_normal, debtor_exento):
        rows = ses.get(f"{BASE}/api/gestoria/remesas/deudores").json()
        by_id = {d["id"]: d for d in rows}
        assert by_id[debtor_normal["id"]]["iva_rate"] == 21
        assert by_id[debtor_normal["id"]]["vat_exempt"] is False
        ex = by_id[debtor_exento["id"]]
        assert ex["vat_exempt"] is True
        assert "art. 20" in ex["exempt_reason"]


# ---------- Remesa + líneas + IVA desglose ----------
RID = {}


class TestRemesaEditor:
    def test_create_remesa_from_debtors_computes_tax(self, ses, debtor_normal, debtor_exento):
        r = ses.post(f"{BASE}/api/gestoria/remesas", json={
            "name": "TEST_Iter24_Remesa", "charge_date": "2026-02-05",
            "reference": "ITER24", "from_debtors": True})
        assert r.status_code == 200, r.text
        rem = r.json()
        RID["id"] = rem["id"]
        # debe tener al menos los 2 deudores creados
        names = {ln["name"] for ln in ses.get(f"{BASE}/api/gestoria/remesas/{rem['id']}").json()["lines"]}
        assert "TEST Cliente IVA 21" in names
        assert "TEST Cliente Exento" in names
        rem = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}").json()
        # línea 121€ con 21% -> base 100, iva 21
        ln21 = next(l for l in rem["lines"] if l["name"] == "TEST Cliente IVA 21")
        assert abs(ln21["base"] - 100.0) < 0.01
        assert abs(ln21["iva"] - 21.0) < 0.01
        assert abs(ln21["amount"] - 121.0) < 0.01
        # línea exento -> iva 0
        lx = next(l for l in rem["lines"] if l["name"] == "TEST Cliente Exento")
        assert lx["iva"] == 0.0
        assert lx["base"] == 100.0
        assert lx["vat_exempt"] is True
        # resumen base + iva + total
        assert abs(rem["base_total"] + rem["iva_total"] - rem["total"]) < 0.01
        assert rem["iva_total"] >= 21.0

    def test_add_extra_line_with_10_percent(self, ses):
        rem = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}").json()
        rem["lines"].append({
            "id": "", "debtor_id": "", "name": "TEST Línea 10%",
            "nif": "12345678Z", "iban": "ES9121000418450200051332",
            "mandate": "TEST-M-10", "mandate_date": "2026-01-01", "email": "",
            "amount": 110.0, "iva_rate": 10, "vat_exempt": False,
            "exempt_reason": "", "reference": "", "concept": "Libro",
            "invoice_id": "", "invoice_number": "", "paid": False, "paid_date": "",
        })
        r = ses.put(f"{BASE}/api/gestoria/remesas/{RID['id']}", json={
            "name": rem["name"], "charge_date": rem["charge_date"],
            "reference": rem["reference"], "lines": rem["lines"]})
        assert r.status_code == 200, r.text
        rem = r.json()
        ln10 = next(l for l in rem["lines"] if l["name"] == "TEST Línea 10%")
        assert abs(ln10["base"] - 100.0) < 0.01
        assert abs(ln10["iva"] - 10.0) < 0.01


# ---------- Lista + resumen pending ----------
class TestList:
    def test_list_returns_summary_fields(self, ses):
        rows = ses.get(f"{BASE}/api/gestoria/remesas").json()
        r = next(x for x in rows if x["id"] == RID["id"])
        for k in ("base_total", "iva_total", "total", "pending_total", "pending_count", "count"):
            assert k in r
        assert r["pending_count"] >= 1


# ---------- Emisión de facturas 1-por-cliente ----------
class TestInvoicing:
    def test_create_invoices_one_per_line(self, ses):
        r = ses.post(f"{BASE}/api/gestoria/remesas/{RID['id']}/facturas")
        assert r.status_code == 200, r.text
        data = r.json()
        # 3 líneas válidas → 3 facturas
        assert data["created"] >= 3, data
        rem = data["remesa"]
        assert rem["status"] == "emitida"
        # cada línea tiene invoice_number y es diferente
        nums = [l["invoice_number"] for l in rem["lines"] if l["invoice_number"]]
        assert len(nums) == len(set(nums)) >= 3

    def test_cannot_modify_amount_or_iva_after_invoiced(self, ses):
        rem = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}").json()
        new_lines = []
        for ln in rem["lines"]:
            x = {k: ln.get(k, "") for k in ("id", "debtor_id", "name", "nif", "iban", "mandate",
                                            "mandate_date", "email", "iva_rate", "vat_exempt",
                                            "exempt_reason", "reference", "concept",
                                            "invoice_id", "invoice_number", "paid", "paid_date")}
            x["amount"] = ln["amount"]
            new_lines.append(x)
        # cambiar amount en la 1ª línea que tiene factura
        for ln in new_lines:
            if ln.get("invoice_id"):
                ln["amount"] = float(ln["amount"]) + 10.0
                break
        r = ses.put(f"{BASE}/api/gestoria/remesas/{RID['id']}", json={
            "name": rem["name"], "charge_date": rem["charge_date"],
            "reference": rem["reference"], "lines": new_lines})
        assert r.status_code == 400
        assert "factura" in r.json()["detail"].lower()

    def test_cannot_modify_iva_after_invoiced(self, ses):
        rem = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}").json()
        new_lines = []
        changed = False
        for ln in rem["lines"]:
            x = {k: ln.get(k) for k in ("id", "debtor_id", "name", "nif", "iban", "mandate",
                                        "mandate_date", "email", "amount", "iva_rate", "vat_exempt",
                                        "exempt_reason", "reference", "concept",
                                        "invoice_id", "invoice_number", "paid", "paid_date")}
            if x.get("invoice_id") and not changed and not x.get("vat_exempt"):
                x["iva_rate"] = (float(x.get("iva_rate") or 21)) + 1  # cambia tipo
                changed = True
            new_lines.append(x)
        assert changed
        r = ses.put(f"{BASE}/api/gestoria/remesas/{RID['id']}", json={
            "name": rem["name"], "charge_date": rem["charge_date"],
            "reference": rem["reference"], "lines": new_lines})
        assert r.status_code == 400


# ---------- Recibos PDF + SEPA XML ----------
class TestDocs:
    def test_receipts_pdf_all(self, ses):
        r = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}/recibos")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content.startswith(b"%PDF-")
        assert len(r.content) > 2000

    def test_receipts_pdf_single_line(self, ses):
        rem = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}").json()
        lid = rem["lines"][0]["id"]
        r = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}/recibos", params={"line_id": lid})
        assert r.status_code == 200
        assert r.content.startswith(b"%PDF-")

    def test_sepa_xml_pain008(self, ses):
        # debe haber al menos un recibo pendiente (no todas pagadas)
        r = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}/sepa-xml")
        assert r.status_code == 200, r.text
        xml = r.content.decode("utf-8")
        assert "pain.008.001.02" in xml
        assert "<CstmrDrctDbtInitn>" in xml
        assert "<DrctDbtTxInf>" in xml
        assert "ES9121000418450200051332" in xml
        # creditor id ES + 2d + sufijo + NIF
        assert re.search(r"<Id>ES\d{2}\w{3,}B12345674</Id>", xml)
        # Suma de recibos pendientes aparece en CtrlSum
        assert "<CtrlSum>" in xml


# ---------- Comprobar cobros / detección (remesa emitida) ----------
class TestCheck:
    def test_check_payments_includes_emitted(self, ses):
        """La remesa está en estado 'emitida' → debe entrar en la detección."""
        r = ses.post(f"{BASE}/api/gestoria/remesas/comprobar-cobros")
        assert r.status_code == 200
        # no implica match, pero no debe reventar; la remesa debe seguir siendo 'emitida'
        rem = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}").json()
        assert rem["status"] in ("emitida", "parcial", "cobrada")


# ---------- Exportar incluye columnas IVA ----------
class TestExport:
    def test_csv_columns(self, ses):
        r = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}/exportar", params={"formato": "csv"})
        assert r.status_code == 200
        text = r.content.decode("utf-8-sig")
        head = text.splitlines()[0].split(";")
        for col in ("Base imponible", "IVA %", "Cuota IVA", "Exento", "Factura"):
            assert col in head, (col, head)
        # alguna fila "Sí" en Exento
        rows = list(csv.reader(io.StringIO(text), delimiter=";"))
        ex_col = head.index("Exento")
        assert any(row[ex_col] == "Sí" for row in rows[1:])


# ---------- Importación CSV con IVA + Exento ----------
class TestImport:
    def test_import_csv_assigns_iva_and_exempt(self, ses):
        csv_bytes = (
            "Importe;Fecha cobro;Nombre deudor;Identificador deudor;IBAN;Mandato;Fecha mandato;"
            "Referencia operación;Concepto;Email;IVA %;Exento\n"
            "121,00;2026-03-01;TEST ImpA;12345678Z;ES9121000418450200051332;IMP-A;2026-01-01;;Asesoría;;21;No\n"
            "100,00;2026-03-01;TEST ImpB;B12345674;ES9121000418450200051332;IMP-B;2026-01-01;;Formación;;0;Sí\n"
        ).encode("utf-8")
        files = {"file": ("TEST_import.csv", csv_bytes, "text/csv")}
        r = ses.post(f"{BASE}/api/gestoria/remesas/importar", files=files, params={"name": "TEST_Iter24_Import"})
        assert r.status_code == 200, r.text
        rem = r.json()["remesa"]
        lines = rem["lines"]
        a = next(l for l in lines if l["name"] == "TEST ImpA")
        b = next(l for l in lines if l["name"] == "TEST ImpB")
        assert a["iva_rate"] == 21 and not a["vat_exempt"]
        assert b["vat_exempt"] is True
        # cleanup
        ses.delete(f"{BASE}/api/gestoria/remesas/{rem['id']}")


# ---------- Teardown ----------
def test_cleanup(ses):
    # borrar remesa principal (tiene facturas → PUT returnará 400; forzamos delete bypass creando otra rama)
    # el endpoint delete bloquea si tiene facturas; eso lo validamos:
    r = ses.delete(f"{BASE}/api/gestoria/remesas/{RID['id']}")
    assert r.status_code == 400
    assert "factura" in r.json()["detail"].lower()
    # borrar deudores TEST
    for d in ses.get(f"{BASE}/api/gestoria/remesas/deudores").json():
        if d["name"].startswith("TEST "):
            ses.delete(f"{BASE}/api/gestoria/remesas/deudores/{d['id']}")
