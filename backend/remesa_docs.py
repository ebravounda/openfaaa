"""Recibos PDF y fichero SEPA XML (pain.008.001.02, adeudos directos CORE) para remesas."""
import re
import unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

from pdf_service import _eur, _logo_flowable

BLUE = colors.HexColor("#0052FF")
MUTED = colors.HexColor("#64748B")
BORDER = colors.HexColor("#E2E8F0")


def creditor_id_from_nif(nif: str, suffix: str = "000", country: str = "ES") -> str:
    """Identificador de acreedor SEPA (AT-02): ES + dígitos de control + sufijo + NIF."""
    nid = re.sub(r"[^A-Z0-9]", "", (nif or "").upper())
    if not nid:
        return ""
    num = "".join(str(int(c, 36)) for c in nid + country + "00")
    return f"{country}{98 - int(num) % 97:02d}{suffix}{nid}"


def _fmt_date(s: str) -> str:
    try:
        return datetime.fromisoformat((s or "")[:10]).strftime("%d/%m/%Y")
    except ValueError:
        return s or ""


def _mask(iban: str) -> str:
    s = (iban or "").replace(" ", "")
    return f"{s[:4]} **** **** {s[-4:]}" if len(s) > 8 else s


def build_receipts_pdf(remesa: dict, lines: list, company: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"Recibos {remesa.get('name', '')}")
    h = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=16, textColor=BLUE, spaceAfter=2)
    sm = ParagraphStyle("s", fontName="Helvetica", fontSize=8.5, leading=11, textColor=MUTED)
    nb = ParagraphStyle("n", fontName="Helvetica", fontSize=9.5, leading=13)
    bold = ParagraphStyle("b", parent=nb, fontName="Helvetica-Bold")
    issuer = company.get("legal_name") or company.get("name", "")
    cred = company.get("sepa_creditor_id") or creditor_id_from_nif(company.get("nif", ""))
    story = []
    for i, ln in enumerate(lines):
        if i:
            story.append(PageBreak())
        logo = _logo_flowable(company)
        if logo:
            story += [logo, Spacer(1, 4 * mm)]
        num = ln.get("invoice_number") or f"{remesa.get('reference') or 'REC'}-{ln.get('_idx', i + 1):03d}"
        head = Table([[Paragraph("RECIBO DE ADEUDO DIRECTO SEPA", h), Paragraph(f"<b>Nº recibo:</b> {num}<br/><b>Fecha de emisión:</b> {_fmt_date(ln.get('issue_date') or datetime.now(timezone.utc).date().isoformat())}<br/><b>Fecha de cargo:</b> {_fmt_date(remesa.get('charge_date', ''))}", nb)]],
                     colWidths=[100 * mm, 74 * mm])
        head.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story += [head, Spacer(1, 6 * mm)]
        parties = Table([
            [Paragraph("<b>ACREEDOR</b>", sm), Paragraph("<b>DEUDOR</b>", sm)],
            [Paragraph(f"<b>{issuer}</b><br/>NIF {company.get('nif', '')}<br/>{company.get('address', '')}<br/>Id. acreedor SEPA: {cred}", nb),
             Paragraph(f"<b>{ln.get('name', '')}</b><br/>NIF {ln.get('nif', '') or '—'}<br/>IBAN {_mask(ln.get('iban', ''))}<br/>Mandato {ln.get('mandate', '')} · firmado {_fmt_date(ln.get('mandate_date', ''))}", nb)],
        ], colWidths=[87 * mm, 87 * mm])
        parties.setStyle(TableStyle([("BOX", (0, 0), (0, -1), 0.6, BORDER), ("BOX", (1, 0), (1, -1), 0.6, BORDER),
                                     ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
        story += [parties, Spacer(1, 7 * mm)]
        iva_lbl = f"Exento de IVA — {ln.get('exempt_reason') or 'art. 20 Ley 37/1992'}" if ln.get("vat_exempt") else f"IVA ({float(ln.get('iva_rate') or 0):g}%)"
        concept = ln.get("concept") or ln.get("reference") or remesa.get("name", "")
        tbl = Table([
            ["Concepto", "Importe"],
            [Paragraph(concept, nb), _eur(ln.get("base", 0))],
            ["Base imponible", _eur(ln.get("base", 0))],
            [Paragraph(iva_lbl, nb), _eur(ln.get("iva", 0))],
            [Paragraph("<b>IMPORTE TOTAL DEL RECIBO</b>", bold), _eur(ln.get("amount", 0))],
        ], colWidths=[134 * mm, 40 * mm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EFF6FF")), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9.5), ("ALIGN", (1, 0), (1, -1), "RIGHT"), ("LINEBELOW", (0, 0), (-1, -2), 0.4, BORDER),
            ("LINEABOVE", (0, -1), (-1, -1), 1, BLUE), ("FONTNAME", (1, -1), (1, -1), "Helvetica-Bold"),
            ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
        story += [tbl, Spacer(1, 6 * mm)]
        extra = f"Factura asociada: <b>{ln['invoice_number']}</b>. " if ln.get("invoice_number") else ""
        status = f"<b>COBRADO</b> el {_fmt_date(ln.get('paid_date', ''))}." if ln.get("paid") else "Pendiente de cargo."
        story.append(Paragraph(f"{extra}Este importe se cargará en la cuenta indicada en la fecha de cargo, conforme al mandato SEPA firmado. Remesa «{remesa.get('name', '')}». Estado: {status}", sm))
        story += [Spacer(1, 3 * mm), Paragraph("Como deudor, tiene derecho a solicitar a su entidad la devolución del adeudo en las 8 semanas siguientes a la fecha del cargo.", sm)]
    doc.build(story)
    return buf.getvalue()


def _clean(s: str, n: int) -> str:
    s = "".join(c for c in unicodedata.normalize("NFD", str(s or "")) if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^A-Za-z0-9/\-?:().,'+ ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()[:n] or "NOTPROVIDED"


def _sub(parent, tag, text=None, **attrs):
    el = ET.SubElement(parent, tag, attrs)
    if text is not None:
        el.text = str(text)
    return el


def _agent(parent, tag, bic):
    fin = _sub(_sub(parent, tag), "FinInstnId")
    if bic:
        _sub(fin, "BIC", bic.replace(" ", "").upper())
    else:
        _sub(_sub(fin, "Othr"), "Id", "NOTPROVIDED")


def build_sepa_xml(remesa: dict, lines: list, company: dict) -> bytes:
    now = datetime.now(timezone.utc)
    msg_id = _clean(f"{remesa.get('reference') or 'REM'}-{now:%Y%m%d%H%M%S}", 35).replace(" ", "")
    total = f"{sum(round(float(ln['amount']), 2) for ln in lines):.2f}"
    cred = company.get("sepa_creditor_id") or creditor_id_from_nif(company.get("nif", ""))
    name = _clean(company.get("legal_name") or company.get("name"), 70)
    root = ET.Element("Document", {"xmlns": "urn:iso:std:iso:20022:tech:xsd:pain.008.001.02", "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance"})
    cd = _sub(root, "CstmrDrctDbtInitn")
    gh = _sub(cd, "GrpHdr")
    _sub(gh, "MsgId", msg_id); _sub(gh, "CreDtTm", now.strftime("%Y-%m-%dT%H:%M:%S")); _sub(gh, "NbOfTxs", len(lines)); _sub(gh, "CtrlSum", total)
    ip = _sub(gh, "InitgPty"); _sub(ip, "Nm", name)
    _sub(_sub(_sub(_sub(ip, "Id"), "OrgId"), "Othr"), "Id", cred)
    pi = _sub(cd, "PmtInf")
    _sub(pi, "PmtInfId", f"{msg_id}-1"[:35]); _sub(pi, "PmtMtd", "DD"); _sub(pi, "BtchBookg", "true")
    _sub(pi, "NbOfTxs", len(lines)); _sub(pi, "CtrlSum", total)
    pt = _sub(pi, "PmtTpInf")
    _sub(_sub(pt, "SvcLvl"), "Cd", "SEPA"); _sub(_sub(pt, "LclInstrm"), "Cd", "CORE"); _sub(pt, "SeqTp", "RCUR")
    _sub(pi, "ReqdColltnDt", (remesa.get("charge_date") or now.date().isoformat())[:10])
    _sub(_sub(pi, "Cdtr"), "Nm", name)
    _sub(_sub(_sub(pi, "CdtrAcct"), "Id"), "IBAN", company.get("sepa_iban", "").replace(" ", "").upper())
    _agent(pi, "CdtrAgt", company.get("sepa_bic", ""))
    _sub(pi, "ChrgBr", "SLEV")
    oth = _sub(_sub(_sub(_sub(pi, "CdtrSchmeId"), "Id"), "PrvtId"), "Othr")
    _sub(oth, "Id", cred); _sub(_sub(oth, "SchmeNm"), "Prtry", "SEPA")
    for i, ln in enumerate(lines, 1):
        tx = _sub(pi, "DrctDbtTxInf")
        _sub(_sub(tx, "PmtId"), "EndToEndId", _clean(ln.get("invoice_number") or f"{msg_id}-{i}", 35).replace(" ", ""))
        _sub(tx, "InstdAmt", f"{round(float(ln['amount']), 2):.2f}", Ccy="EUR")
        mr = _sub(_sub(tx, "DrctDbtTx"), "MndtRltdInf")
        _sub(mr, "MndtId", _clean(ln.get("mandate"), 35)); _sub(mr, "DtOfSgntr", (ln.get("mandate_date") or "")[:10])
        _agent(tx, "DbtrAgt", "")
        _sub(_sub(tx, "Dbtr"), "Nm", _clean(ln.get("name"), 70))
        _sub(_sub(_sub(tx, "DbtrAcct"), "Id"), "IBAN", ln.get("iban", ""))
        concept = " ".join(x for x in [ln.get("concept") or remesa.get("name", ""), f"Fra {ln['invoice_number']}" if ln.get("invoice_number") else ""] if x)
        _sub(_sub(tx, "RmtInf"), "Ustrd", _clean(concept, 140))
    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(root, encoding="utf-8")
