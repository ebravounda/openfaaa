import os
import re as _re
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Image, PageBreak
)
from reportlab.lib.utils import ImageReader
from io import BytesIO as _BytesIO
from templates import TEMPLATE_MAP, GOROKY_DEFAULT_LEGAL, GOROKY_DEFAULT_FOOTER

DARK = colors.HexColor("#0A0A0A")
MUTED = colors.HexColor("#666666")
BORDER = colors.HexColor("#E5E5E5")
LIGHT = colors.HexColor("#FAFAFA")


def _eur(v):
    return f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def _iva_label(it):
    t = (it.get("iva_type", "general") or "general")
    if t == "exento":
        return "Exento"
    if t == "no_sujeto":
        return "No sujeto"
    if t == "suplido":
        return "Suplido"
    return f"{it.get('iva_rate', 21):g}%"


def _totals_rows(invoice):
    """Filas de totales con desglose de IVA por tipo, recargo y suplidos."""
    rows = [("Base imponible", _eur(invoice.get("base", 0)), False)]
    bd = invoice.get("iva_breakdown") or []
    if bd:
        for b in bd:
            rows.append((f"IVA ({b['rate']:g}%)", _eur(b.get("cuota", 0)), False))
        for b in bd:
            if b.get("re_cuota"):
                rows.append((f"Recargo equiv. ({b['re_rate']:g}%)", _eur(b.get("re_cuota", 0)), False))
    else:
        rows.append((f"IVA ({invoice.get('iva_rate', 0):g}%)", _eur(invoice.get("iva_amount", 0)), False))
    if invoice.get("suplidos_total"):
        rows.append(("Suplidos", _eur(invoice.get("suplidos_total", 0)), False))
    if invoice.get("irpf_rate"):
        rows.append((f"Retención IRPF (-{invoice['irpf_rate']}%)", f"-{_eur(invoice.get('irpf_amount', 0))}", False))
    rows.append(("TOTAL", _eur(invoice.get("total", 0)), True))
    return rows


def _stamp_anulada(canvas, doc, anulada: bool):
    if not anulada:
        return
    canvas.saveState()
    w, h = A4
    canvas.translate(w / 2, h / 2)
    canvas.rotate(30)
    canvas.setFont("Helvetica-Bold", 80)
    canvas.setFillColorRGB(0.86, 0.15, 0.15, alpha=0.22)
    canvas.drawCentredString(0, 0, "ANULADA")
    canvas.restoreState()


def build_invoice_pdf(invoice: dict, company: dict, qr_png: bytes = None, verifactu: dict = None) -> bytes:
    comp0 = company or {}
    if TEMPLATE_MAP.get(comp0.get("template_id", ""), {}).get("layout") == "goroky":
        return build_goroky_invoice_pdf(invoice, comp0, qr_png=qr_png, verifactu=verifactu)
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm,
                            bottomMargin=20 * mm, leftMargin=18 * mm, rightMargin=18 * mm)
    styles = getSampleStyleSheet()
    story = []

    h_name = ParagraphStyle("hname", parent=styles["Normal"], fontName="Helvetica-Bold",
                            fontSize=18, textColor=DARK, leading=22)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=MUTED, leading=13)
    label = ParagraphStyle("label", parent=styles["Normal"], fontName="Helvetica-Bold",
                           fontSize=8, textColor=MUTED, leading=12)
    normal = ParagraphStyle("normal", parent=styles["Normal"], fontSize=9, textColor=DARK, leading=13)

    # Header
    comp = company or {}
    try:
        accent = colors.HexColor(comp.get("accent_color") or
                                 TEMPLATE_MAP.get(comp.get("template_id", "clasico"), {}).get("accent", "#0A0A0A"))
    except Exception:
        accent = DARK
    header_left = [
        Paragraph(comp.get("name", "Mi Empresa"), h_name),
        Paragraph(f"{comp.get('nif','')}", small),
        Paragraph(f"{comp.get('address','')}", small),
        Paragraph(f"{comp.get('email','')} {comp.get('phone','')}", small),
    ]
    is_rect = invoice.get("invoice_type") == "rectificativa"
    header_right = [
        Paragraph("FACTURA RECTIFICATIVA" if is_rect else "FACTURA",
                  ParagraphStyle("t", parent=styles["Normal"], fontName="Helvetica-Bold",
                                 fontSize=16 if is_rect else 22, textColor=DARK, alignment=2,
                                 leading=20 if is_rect else 27, spaceAfter=4)),
        Paragraph(f"Nº {invoice['number']}", ParagraphStyle("n", parent=styles["Normal"],
                  fontSize=11, textColor=DARK, alignment=2, leading=16)),
        Paragraph(f"Fecha: {invoice['issue_date']}", ParagraphStyle("d", parent=styles["Normal"],
                  fontSize=9, textColor=MUTED, alignment=2, leading=14)),
    ]
    if is_rect and invoice.get("rectifies_number"):
        header_right.append(Paragraph(f"Rectifica a: {invoice['rectifies_number']}",
                            ParagraphStyle("r", parent=styles["Normal"], fontSize=9,
                                           textColor=MUTED, alignment=2, leading=13)))
    ht = Table([[header_left, header_right]], colWidths=[100 * mm, 74 * mm])
    ht.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(ht)
    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    story.append(Spacer(1, 6 * mm))

    # Client
    cl = invoice.get("client", {})
    story.append(Paragraph("FACTURAR A", label))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(cl.get("name", ""), ParagraphStyle("cn", parent=normal,
                 fontName="Helvetica-Bold", fontSize=11)))
    if cl.get("nif"):
        story.append(Paragraph(f"NIF/CIF: {cl.get('nif')}", normal))
    if cl.get("address"):
        story.append(Paragraph(cl.get("address"), normal))
    if cl.get("email"):
        story.append(Paragraph(cl.get("email"), normal))
    story.append(Spacer(1, 8 * mm))

    # Line items
    data = [["Descripción", "Cant.", "Precio", "IVA", "Importe"]]
    for it in invoice.get("line_items", []):
        amount = it["quantity"] * it["unit_price"]
        data.append([
            Paragraph(it["description"], normal),
            str(it["quantity"]),
            _eur(it["unit_price"]),
            _iva_label(it),
            _eur(amount),
        ])
    tbl = Table(data, colWidths=[78 * mm, 16 * mm, 28 * mm, 20 * mm, 32 * mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), accent),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, BORDER),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 6 * mm))

    # Totals
    totals = [[lbl, val] for (lbl, val, _bold) in _totals_rows(invoice)]

    tt = Table(totals, colWidths=[54 * mm, 40 * mm], hAlign="RIGHT")
    tt.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (-1, -2), MUTED),
        ("LINEABOVE", (0, -1), (-1, -1), 1, accent),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
        ("TEXTCOLOR", (0, -1), (-1, -1), accent),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(tt)

    if invoice.get("notes"):
        story.append(Spacer(1, 10 * mm))
        story.append(Paragraph("NOTAS", label))
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(invoice["notes"], small))

    if comp.get("invoice_footer"):
        story.append(Spacer(1, 6 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        story.append(Spacer(1, 2 * mm))
        story.append(Paragraph(comp["invoice_footer"], small))

    # VeriFactu: QR + leyenda
    if qr_png and verifactu:
        story.append(Spacer(1, 12 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        story.append(Spacer(1, 4 * mm))
        qr_img = Image(_BytesIO(qr_png), width=26 * mm, height=26 * mm)
        vf_style = ParagraphStyle("vf", parent=small, fontSize=8, leading=11)
        vf_text = [
            Paragraph("<b>Factura verificable en la sede electrónica de la AEAT</b>", vf_style),
            Paragraph("VERI*FACTU", ParagraphStyle("vfb", parent=vf_style, fontName="Helvetica-Bold", fontSize=10)),
            Paragraph(f"Huella: {verifactu.get('huella','')[:32]}…", vf_style),
        ]
        if verifactu.get("csv"):
            vf_text.append(Paragraph(f"CSV AEAT: {verifactu.get('csv')}", vf_style))
        vt = Table([[qr_img, vf_text]], colWidths=[30 * mm, 144 * mm])
        vt.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
        story.append(vt)

    _anulada = str(invoice.get("status", "")).lower() == "anulada"
    doc.build(story, onFirstPage=lambda c, d: _stamp_anulada(c, d, _anulada),
              onLaterPages=lambda c, d: _stamp_anulada(c, d, _anulada))
    buf.seek(0)
    return buf.read()


# ==========================================================================
# Plantilla GoRoky (factura de telecomunicaciones + aviso legal)
# ==========================================================================
GRK_NAVY = colors.HexColor("#0B1E3B")
GRK_BLUE = colors.HexColor("#1F6FEB")
GRK_GREEN = colors.HexColor("#16A34A")
GRK_AMBER = colors.HexColor("#D97706")
GRK_RED = colors.HexColor("#DC2626")
GRK_LINE = colors.HexColor("#C7CED8")
GRK_TEXT = colors.HexColor("#1A1A1A")
GRK_MUTED = colors.HexColor("#6B7280")
GRK_BODY = colors.HexColor("#374151")

LOGO_PATH = os.path.join(os.path.dirname(__file__), "assets", "goroky_logo.png")

GRK_STATUS = {
    "paid": ("PAGADA", GRK_GREEN),
    "pending": ("PENDIENTE", GRK_AMBER),
    "overdue": ("VENCIDA", GRK_RED),
}


def _grk_date(s):
    try:
        y, m, d = s[:10].split("-")
        return f"{d}/{m}/{y}"
    except Exception:
        return s or ""


def _grk_md(s):
    return _re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)


def _grk_footer_left(comp):
    parts = [
        comp.get("legal_name") or comp.get("name", ""),
        f"CIF {comp['nif']}" if comp.get("nif") else "",
        comp.get("address", ""),
    ]
    return " · ".join([p for p in parts if p])


def _grk_header_footer(canvas, doc, comp, footer_msg):
    canvas.saveState()
    w, h = A4
    lm, rm = 18 * mm, 18 * mm
    right = w - rm
    top = h - 12 * mm
    # Logo
    try:
        img = ImageReader(LOGO_PATH)
        iw, ih = img.getSize()
        logo_w = 44 * mm
        logo_h = logo_w * ih / iw
        canvas.drawImage(img, lm, top - logo_h, width=logo_w, height=logo_h,
                         mask="auto", preserveAspectRatio=True)
    except Exception:
        pass
    # Emisor (derecha)
    canvas.setFillColor(GRK_TEXT)
    canvas.setFont("Helvetica-Bold", 11)
    y = top
    canvas.drawRightString(right, y, (comp.get("name") or "GOROKY"))
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(GRK_MUTED)
    y -= 12
    for ln in [comp.get("legal_name", ""), f"CIF {comp['nif']}" if comp.get("nif") else "", comp.get("address", "")]:
        if ln:
            canvas.drawRightString(right, y, ln)
            y -= 11
    # Separador cabecera
    sep_y = top - 20 * mm
    canvas.setStrokeColor(GRK_LINE)
    canvas.setLineWidth(0.6)
    canvas.line(lm, sep_y, right, sep_y)
    # Pie
    fy = 15 * mm
    canvas.line(lm, fy + 6 * mm, right, fy + 6 * mm)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(GRK_MUTED)
    canvas.drawString(lm, fy + 2 * mm, _grk_footer_left(comp))
    canvas.drawString(lm, fy - 1.5 * mm, footer_msg)
    canvas.drawRightString(right, fy - 1.5 * mm, f"Página {doc.page}")
    canvas.restoreState()


def _grk_parse_legal(text, styles):
    heading = ParagraphStyle("grkh", parent=styles["Normal"], fontName="Helvetica-Bold",
                             fontSize=11, textColor=GRK_BLUE, leading=15, spaceBefore=11, spaceAfter=4)
    body = ParagraphStyle("grkb", parent=styles["Normal"], fontSize=9, textColor=GRK_BODY,
                          leading=13, spaceAfter=3)
    bullet = ParagraphStyle("grkbul", parent=body, leftIndent=11, spaceAfter=3)
    flow = []
    for raw in (text or "").split("\n"):
        line = raw.rstrip()
        if not line.strip():
            continue
        if line.startswith("## "):
            flow.append(Paragraph(_grk_md(line[3:].strip()), heading))
        elif line.startswith("- "):
            flow.append(Paragraph("•&nbsp;&nbsp;" + _grk_md(line[2:].strip()), bullet))
        else:
            flow.append(Paragraph(_grk_md(line.strip()), body))
    return flow


def build_goroky_invoice_pdf(invoice: dict, company: dict, qr_png: bytes = None, verifactu: dict = None) -> bytes:
    comp = company or {}
    footer_msg = (comp.get("footer_message") or "").strip() or GOROKY_DEFAULT_FOOTER
    legal_text = comp.get("legal_notice") if (comp.get("legal_notice") or "").strip() else GOROKY_DEFAULT_LEGAL

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=42 * mm, bottomMargin=26 * mm,
                            leftMargin=18 * mm, rightMargin=18 * mm)
    styles = getSampleStyleSheet()
    story = []

    label = ParagraphStyle("grklabel", parent=styles["Normal"], fontName="Helvetica-Bold",
                           fontSize=8, textColor=GRK_BLUE, leading=12)
    cname = ParagraphStyle("grkcn", parent=styles["Normal"], fontName="Helvetica-Bold",
                           fontSize=13, textColor=GRK_TEXT, leading=17)
    normal = ParagraphStyle("grkn", parent=styles["Normal"], fontSize=9, textColor=GRK_BODY, leading=13)
    r_title = ParagraphStyle("grkrt", parent=styles["Normal"], fontName="Helvetica-Bold",
                             fontSize=16, textColor=GRK_TEXT, alignment=2, leading=20)
    r_line = ParagraphStyle("grkrl", parent=styles["Normal"], fontSize=9, textColor=GRK_BODY,
                            alignment=2, leading=14)

    cl = invoice.get("client", {})
    left = [
        Paragraph("FACTURAR A", label),
        Spacer(1, 2 * mm),
        Paragraph(cl.get("name", ""), cname),
    ]
    if cl.get("nif"):
        left.append(Paragraph(f"NIF/CIF: {cl.get('nif')}", normal))
    if cl.get("address"):
        left.append(Paragraph(cl.get("address"), normal))
    if cl.get("email"):
        left.append(Paragraph(cl.get("email"), normal))

    status_key = invoice.get("status", "pending")
    status_txt, status_col = GRK_STATUS.get(status_key, (str(status_key).upper(), GRK_MUTED))
    right = [Paragraph(f"Factura {invoice.get('number','')}", r_title), Spacer(1, 1.5 * mm),
             Paragraph(f"Emisión: <b>{_grk_date(invoice.get('issue_date',''))}</b>", r_line)]
    if invoice.get("due_date"):
        right.append(Paragraph(f"Vencimiento: <b>{_grk_date(invoice.get('due_date'))}</b>", r_line))
    if invoice.get("period"):
        right.append(Paragraph(f"Periodo: <b>{invoice.get('period')}</b>", r_line))
    right.append(Paragraph(status_txt, ParagraphStyle("grkst", parent=r_line,
                 fontName="Helvetica-Bold", fontSize=10, textColor=status_col, spaceBefore=2)))

    top_tbl = Table([[left, right]], colWidths=[100 * mm, 74 * mm])
    top_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(top_tbl)
    story.append(Spacer(1, 9 * mm))

    # Cabecera de tabla (barra navy)
    hstyle = ParagraphStyle("grkth", parent=styles["Normal"], fontName="Helvetica-Bold",
                            fontSize=9, textColor=colors.white, leading=12)
    hstyle_r = ParagraphStyle("grkthr", parent=hstyle, alignment=2)
    head = Table([[Paragraph("Concepto", hstyle), Paragraph("Detalle", hstyle),
                   Paragraph("Precio (€)", hstyle_r)]], colWidths=[40 * mm, 74 * mm, 60 * mm])
    head.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRK_NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(head)
    story.append(Spacer(1, 5 * mm))

    # Bloque concepto (izquierda)
    concept = invoice.get("concept_label") or "PAGO"
    left_block = [Paragraph(concept, ParagraphStyle("grkcon", parent=styles["Normal"],
                  fontName="Helvetica-Bold", fontSize=10, textColor=GRK_BLUE, leading=14))]
    if invoice.get("payment_method"):
        left_block.append(Paragraph(f"Método: <b>{invoice.get('payment_method')}</b>", normal))
    if invoice.get("iban"):
        left_block.append(Paragraph(f"IBAN: <b>{invoice.get('iban')}</b>", normal))
    for it in invoice.get("line_items", []):
        if it.get("description"):
            left_block.append(Paragraph(f"{it['description']} · {_iva_label(it)}", normal))

    # Importes (derecha)
    amt_l = ParagraphStyle("grkal", parent=styles["Normal"], fontSize=9.5, textColor=GRK_BODY, leading=14)
    amt_r = ParagraphStyle("grkar", parent=amt_l, alignment=2)
    rows = []
    for lbl, val, is_total in _totals_rows(invoice):
        if is_total:
            rows.append([Paragraph("TOTAL", ParagraphStyle("grktl", parent=amt_l, fontName="Helvetica-Bold",
                         fontSize=13, textColor=GRK_BLUE)),
                         Paragraph(val, ParagraphStyle("grktr", parent=amt_r,
                         fontName="Helvetica-Bold", fontSize=13, textColor=GRK_BLUE))])
        else:
            rows.append([Paragraph(lbl, amt_l), Paragraph(val, amt_r)])
    amt_tbl = Table(rows, colWidths=[50 * mm, 34 * mm])
    amt_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.6, GRK_LINE),
    ]))

    body_tbl = Table([[left_block, amt_tbl]], colWidths=[90 * mm, 84 * mm])
    body_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                                  ("LEFTPADDING", (0, 0), (0, 0), 8)]))
    story.append(body_tbl)

    if invoice.get("notes"):
        story.append(Spacer(1, 8 * mm))
        story.append(Paragraph("NOTAS", label))
        story.append(Spacer(1, 1.5 * mm))
        story.append(Paragraph(invoice["notes"], normal))

    # VeriFactu (si aplica)
    if qr_png and verifactu:
        story.append(Spacer(1, 8 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=GRK_LINE))
        story.append(Spacer(1, 3 * mm))
        vf_style = ParagraphStyle("grkvf", parent=normal, fontSize=8, leading=11)
        vt = Table([[Image(_BytesIO(qr_png), width=24 * mm, height=24 * mm), [
            Paragraph("<b>Factura verificable en la sede electrónica de la AEAT</b>", vf_style),
            Paragraph("VERI*FACTU", ParagraphStyle("grkvfb", parent=vf_style, fontName="Helvetica-Bold", fontSize=10)),
            Paragraph(f"Huella: {verifactu.get('huella','')[:32]}…", vf_style),
        ]]], colWidths=[28 * mm, 146 * mm])
        vt.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
        story.append(vt)

    # Página 2: Aviso Legal
    story.append(PageBreak())
    story.append(Paragraph("Aviso Legal", ParagraphStyle("grkbig", parent=styles["Normal"],
                 fontName="Helvetica-Bold", fontSize=15, textColor=GRK_TEXT, leading=19)))
    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width="100%", thickness=0.6, color=GRK_LINE))
    story.extend(_grk_parse_legal(legal_text, styles))

    def _on_page(canvas, d):
        _grk_header_footer(canvas, d, comp, footer_msg)
        _stamp_anulada(canvas, d, str(invoice.get("status", "")).lower() == "anulada")

    doc.build(story, onFirstPage=_on_page, onLaterPages=_on_page)
    buf.seek(0)
    return buf.read()

