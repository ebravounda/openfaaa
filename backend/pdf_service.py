from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable, Image
)
from io import BytesIO as _BytesIO
from templates import TEMPLATE_MAP

DARK = colors.HexColor("#0A0A0A")
MUTED = colors.HexColor("#666666")
BORDER = colors.HexColor("#E5E5E5")
LIGHT = colors.HexColor("#FAFAFA")


def _eur(v):
    return f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def build_invoice_pdf(invoice: dict, company: dict, qr_png: bytes = None, verifactu: dict = None) -> bytes:
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
                                 fontSize=16 if is_rect else 22, textColor=DARK, alignment=2, leading=19)),
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
    data = [["Descripción", "Cant.", "Precio", "Importe"]]
    for it in invoice.get("line_items", []):
        amount = it["quantity"] * it["unit_price"]
        data.append([
            Paragraph(it["description"], normal),
            str(it["quantity"]),
            _eur(it["unit_price"]),
            _eur(amount),
        ])
    tbl = Table(data, colWidths=[95 * mm, 20 * mm, 30 * mm, 29 * mm])
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
    totals = [["Base imponible", _eur(invoice["base"])]]
    if invoice.get("iva_rate") is not None:
        totals.append([f"IVA ({invoice['iva_rate']}%)", _eur(invoice["iva_amount"])])
    if invoice.get("irpf_rate"):
        totals.append([f"Retención IRPF (-{invoice['irpf_rate']}%)", f"-{_eur(invoice['irpf_amount'])}"])
    totals.append(["TOTAL", _eur(invoice["total"])])

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

    doc.build(story)
    buf.seek(0)
    return buf.read()
