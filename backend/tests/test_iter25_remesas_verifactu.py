"""Iter 25 – Remesas: VeriFactu por línea + anulación con rectificativa automática.

Gestoría demo. VeriFactu en modo *simulado* (no se contacta con la AEAT).

Endpoints:
  - PUT  /api/gestoria/remesas/ajustes/emisor         (verifactu_enabled/_mode/_cert_type)
  - GET  /api/gestoria/remesas/ajustes/emisor         (devuelve esos tres campos)
  - POST /api/gestoria/remesas/{rid}/lineas/{lid}/verifactu
  - POST /api/gestoria/remesas/{rid}/lineas/{lid}/anular  {reason, detail}
"""
import os
import re
import pytest
import requests


def _url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if not v:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    v = ln.split("=", 1)[1].strip()
                    break
    return v.rstrip("/")


BASE = _url()
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


# ----- 1) Issuer VeriFactu fields -----
class TestIssuerVF:
    def test_put_accepts_vf_fields_and_persists(self, ses):
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
            "verifactu_enabled": True,
            "verifactu_mode": "simulado",
            "verifactu_cert_type": "personal",
        }
        r = ses.put(f"{BASE}/api/gestoria/remesas/ajustes/emisor", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["verifactu_enabled"] is True
        assert d["verifactu_mode"] == "simulado"
        assert d["verifactu_cert_type"] == "personal"

        # GET también los devuelve
        g = ses.get(f"{BASE}/api/gestoria/remesas/ajustes/emisor").json()
        assert g["verifactu_enabled"] is True
        assert g["verifactu_mode"] == "simulado"

    def test_invalid_mode_falls_back_to_simulado(self, ses):
        payload = {
            "name": "TEST Asesoría", "legal_name": "TEST Asesoría SL",
            "nif": "B12345674", "address": "Calle Mayor 1, 28001 Madrid",
            "email": "", "phone": "", "tax_type": "sociedad",
            "legal_notice": "", "invoice_footer": "",
            "sepa_creditor_id": "", "sepa_iban": "ES9121000418450200051332", "sepa_bic": "CAIXESBBXXX",
            "verifactu_enabled": True,
            "verifactu_mode": "foobar",
            "verifactu_cert_type": "weird",
        }
        r = ses.put(f"{BASE}/api/gestoria/remesas/ajustes/emisor", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["verifactu_mode"] == "simulado"
        assert d["verifactu_cert_type"] == "personal"


# ----- 2) Crear remesa con 2 líneas y emitir -----
RID = {}


@pytest.fixture(scope="module")
def remesa_emitida(ses):
    """Crea remesa con 2 líneas válidas y emite las facturas."""
    # garantizar que issuer tiene VF activo simulado
    issuer_payload = {
        "name": "TEST Asesoría", "legal_name": "TEST Asesoría SL",
        "nif": "B12345674", "address": "Calle Mayor 1, 28001 Madrid",
        "email": "", "phone": "", "tax_type": "sociedad",
        "legal_notice": "", "invoice_footer": "",
        "sepa_creditor_id": "", "sepa_iban": "ES9121000418450200051332", "sepa_bic": "CAIXESBBXXX",
        "verifactu_enabled": True, "verifactu_mode": "simulado", "verifactu_cert_type": "personal",
    }
    ses.put(f"{BASE}/api/gestoria/remesas/ajustes/emisor", json=issuer_payload)

    r = ses.post(f"{BASE}/api/gestoria/remesas", json={
        "name": "TEST_Iter25_VF", "charge_date": "2026-02-20",
        "reference": "ITER25", "from_debtors": False})
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    RID["id"] = rid

    lines = [
        {"id": "", "debtor_id": "", "name": "TEST VF Cliente A",
         "nif": "12345678Z", "iban": "ES9121000418450200051332",
         "mandate": "TEST-M-VFA", "mandate_date": "2026-01-10", "email": "",
         "amount": 121.0, "iva_rate": 21, "vat_exempt": False, "exempt_reason": "",
         "reference": "", "concept": "Asesoría A",
         "invoice_id": "", "invoice_number": "", "paid": False, "paid_date": ""},
        {"id": "", "debtor_id": "", "name": "TEST VF Cliente B",
         "nif": "B12345674", "iban": "ES9121000418450200051332",
         "mandate": "TEST-M-VFB", "mandate_date": "2026-01-10", "email": "",
         "amount": 121.0, "iva_rate": 21, "vat_exempt": False, "exempt_reason": "",
         "reference": "", "concept": "Asesoría B",
         "invoice_id": "", "invoice_number": "", "paid": False, "paid_date": ""},
    ]
    r = ses.put(f"{BASE}/api/gestoria/remesas/{rid}", json={
        "name": "TEST_Iter25_VF", "charge_date": "2026-02-20",
        "reference": "ITER25", "lines": lines})
    assert r.status_code == 200, r.text

    # Emitir facturas
    r = ses.post(f"{BASE}/api/gestoria/remesas/{rid}/facturas")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["created"] >= 2, data
    rem = data["remesa"]
    assert rem["status"] == "emitida"
    return rem


class TestEmit:
    def test_lines_have_vf_pending(self, ses, remesa_emitida):
        rem = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}").json()
        # tras emitir, las líneas deben tener invoice_id y campo vf
        for ln in rem["lines"]:
            assert ln.get("invoice_id")
            assert "vf" in ln, ln
            # modo simulado activo pero aún no enviado => submitted False (o True si auto-submit)
            assert ln["vf"]["mode"] in ("", "simulado")


# ----- 3) VeriFactu por línea -----
class TestLineVerifactu:
    def test_line_verifactu_submits(self, ses, remesa_emitida):
        rem = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}").json()
        ln0 = rem["lines"][0]
        r = ses.post(f"{BASE}/api/gestoria/remesas/{RID['id']}/lineas/{ln0['id']}/verifactu")
        assert r.status_code == 200, r.text
        res = r.json()
        assert "result" in res and "remesa" in res
        rem2 = res["remesa"]
        new_ln = next(l for l in rem2["lines"] if l["id"] == ln0["id"])
        assert new_ln["vf"]["submitted"] is True
        assert new_ln["vf"]["mode"] == "simulado"
        # status típico 'aceptada' / 'Aceptada (simulado)' etc.
        assert re.search(r"acept", new_ln["vf"]["status"], re.I), new_ln["vf"]


# ----- 4) Anulación → rectificativa automática -----
class TestLineCancel:
    def test_cancel_line_creates_rectificativa(self, ses, remesa_emitida):
        rem = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}").json()
        # Elegimos la línea NO enviada aún a VeriFactu para probar el "auto-submit before cancel"
        ln = next((l for l in rem["lines"] if not l["vf"]["submitted"]), None)
        if ln is None:
            ln = rem["lines"][1]
        pending_before = rem["pending_total"]
        amount = ln["amount"]

        r = ses.post(
            f"{BASE}/api/gestoria/remesas/{RID['id']}/lineas/{ln['id']}/anular",
            json={"reason": "error_datos", "detail": "TEST anulación línea remesa"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "rectificativa" in data, data
        rect_number = data["rectificativa"].get("number", "")
        assert rect_number.startswith("R-"), rect_number
        # remesa viene incluida
        rem_after = data["remesa"]
        new_ln = next(l for l in rem_after["lines"] if l["id"] == ln["id"])
        assert new_ln.get("cancelled") is True
        assert new_ln.get("rect_number") == rect_number
        # original debe estar submitted en VF (auto-submit si no lo estaba)
        assert new_ln["vf"]["submitted"] is True
        # pending_total excluye la línea anulada
        assert abs(rem_after["pending_total"] - (pending_before - amount)) < 0.01, (rem_after["pending_total"], pending_before, amount)

    def test_cancel_second_time_returns_400(self, ses):
        rem = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}").json()
        ln = next(l for l in rem["lines"] if l.get("cancelled"))
        r = ses.post(
            f"{BASE}/api/gestoria/remesas/{RID['id']}/lineas/{ln['id']}/anular",
            json={"reason": "error_datos", "detail": "repeat"},
        )
        assert r.status_code == 400
        assert "anulada" in r.json()["detail"].lower()

    def test_sepa_xml_excludes_cancelled(self, ses):
        r = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}/sepa-xml")
        assert r.status_code == 200, r.text
        xml = r.content.decode("utf-8")
        # buscar línea anulada por rect number — no debe aparecer su mandato
        rem = ses.get(f"{BASE}/api/gestoria/remesas/{RID['id']}").json()
        cancelled = [l for l in rem["lines"] if l.get("cancelled")]
        assert cancelled
        for ln in cancelled:
            assert ln["mandate"] not in xml, f"Mandato de línea anulada aparece en SEPA XML: {ln['mandate']}"


# ----- 5) Cleanup -----
def test_cleanup(ses):
    # No se puede borrar remesa con facturas; limpiamos deudores TEST creados por el fixture (no se usaron) y la remesa queda marcada
    rid = RID.get("id")
    if rid:
        r = ses.delete(f"{BASE}/api/gestoria/remesas/{rid}")
        # con facturas emitidas debe fallar 400
        assert r.status_code in (200, 400)
