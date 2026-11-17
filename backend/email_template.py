"""Plantilla moderna de email para facturas y presupuestos (logo inline por CID)."""
import base64
import re
from html import escape

LOGO_CID = "company-logo"


def _eur(v):
    return f"{float(v or 0):,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_date(d):
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", d or "")
    return f"{m.group(3)}/{m.group(2)}/{m.group(1)}" if m else (d or "")


def logo_attachment(company: dict):
    """Adjunto inline con el logo de la empresa/gestoría (o None)."""
    logo = (company or {}).get("logo") or ""
    if not logo:
        return None
    m = re.match(r"^data:image/(png|jpe?g|gif|webp);base64,(.+)$", logo, re.S)
    if not m:
        return None
    try:
        base64.b64decode(m.group(2)[:64] + "==")
    except Exception:
        return None
    ext = "jpg" if m.group(1).startswith("jp") else m.group(1)
    return {"filename": f"logo.{ext}", "content": m.group(2), "content_id": LOGO_CID}


def _accent(company):
    c = (company or {}).get("accent_color") or ""
    return c if re.match(r"^#[0-9A-Fa-f]{6}$", c) else "#0052FF"


def _totals_rows(doc):
    rows = []
    bd = doc.get("iva_breakdown") or []
    multi = len(bd) > 1
    if doc.get("discount_total"):
        rows.append(("Subtotal", _eur(doc.get("subtotal"))))
        rows.append(("Descuento", "-" + _eur(doc.get("discount_total"))))
    if multi:
        for b in bd:
            rows.append((f"Base al {b['rate']:g}%", _eur(b.get("base"))))
            rows.append((f"IVA {b['rate']:g}%", _eur(b.get("cuota"))))
        if doc.get("base_exenta"):
            rows.append(("Base exenta", _eur(doc.get("base_exenta"))))
        if doc.get("base_no_sujeta"):
            rows.append(("Base no sujeta", _eur(doc.get("base_no_sujeta"))))
        rows.append(("Total base imponible", _eur(doc.get("base"))))
        rows.append(("Total IVA", _eur(doc.get("iva_amount"))))
    else:
        rows.append(("Base imponible", _eur(doc.get("base"))))
        if bd:
            rows.append((f"IVA ({bd[0]['rate']:g}%)", _eur(bd[0].get("cuota"))))
        elif doc.get("foreign_client"):
            rows.append(("IVA", "No sujeto"))
    if doc.get("re_amount"):
        rows.append(("Recargo de equivalencia", _eur(doc.get("re_amount"))))
    if doc.get("suplidos_total"):
        rows.append(("Suplidos", _eur(doc.get("suplidos_total"))))
    if doc.get("irpf_rate"):
        rows.append((f"Retención IRPF (-{doc['irpf_rate']:g}%)", "-" + _eur(doc.get("irpf_amount"))))
    return rows


def build_document_email(doc: dict, company: dict, doc_label: str = "FACTURA", has_logo: bool = False,
                         pdf_name: str = "", extra_html: str = "") -> str:
    comp = company or {}
    acc = _accent(comp)
    is_quote = doc_label.upper().startswith("PRESUP")
    noun = "el presupuesto" if is_quote else "la factura"
    name = escape(comp.get("trade_name") or comp.get("name") or "Mi Empresa")
    client = doc.get("client") or {}
    hello = escape((client.get("name") or "").strip()) or "cliente"
    head = (f'<img src="cid:{LOGO_CID}" alt="{name}" height="52" style="display:block;max-height:52px;max-width:220px;height:52px;width:auto;border:0">'
            if has_logo else f'<div style="font-size:20px;font-weight:700;color:{acc};letter-spacing:-0.3px">{name}</div>')
    lines = ""
    for it in doc.get("line_items", []):
        amount = float(it.get("quantity") or 0) * float(it.get("unit_price") or 0)
        lines += (f'<tr><td style="padding:10px 0;border-bottom:1px solid #EEF0F4;font-size:14px;color:#1F2937">'
                  f'{escape(it.get("description") or "")}<div style="font-size:12px;color:#94A3B8">{it.get("quantity")} × {escape(_eur(it.get("unit_price")))}</div></td>'
                  f'<td style="padding:10px 0;border-bottom:1px solid #EEF0F4;font-size:14px;color:#1F2937;text-align:right;white-space:nowrap">{escape(_eur(amount))}</td></tr>')
    totals = "".join(f'<tr><td style="padding:4px 0;font-size:13px;color:#64748B">{escape(k)}</td>'
                     f'<td style="padding:4px 0;font-size:13px;color:#334155;text-align:right">{escape(v)}</td></tr>' for k, v in _totals_rows(doc))
    meta = f'<td style="padding-right:24px"><div style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px">Fecha</div><div style="font-size:14px;color:#0F172A;font-weight:600">{escape(_fmt_date(doc.get("issue_date")))}</div></td>'
    if doc.get("due_date"):
        meta += f'<td><div style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px">{"Válido hasta" if is_quote else "Vencimiento"}</div><div style="font-size:14px;color:#0F172A;font-weight:600">{escape(_fmt_date(doc.get("due_date")))}</div></td>'
    pdf_chip = (f'<table role="presentation" style="margin-top:18px;border-collapse:separate"><tr><td style="background:#F1F5F9;border-radius:10px;padding:10px 14px;font-size:13px;color:#334155">'
                f'<span style="display:inline-block;background:#DC2626;color:#fff;font-size:10px;font-weight:700;border-radius:4px;padding:2px 5px;margin-right:8px">PDF</span>'
                f'{escape(pdf_name)} <span style="color:#94A3B8">· adjunto</span></td></tr></table>') if pdf_name else ""
    contact = " · ".join(escape(x) for x in [comp.get("nif"), comp.get("address"), comp.get("email"), comp.get("phone")] if x)
    return (
        f'<div style="background:#F4F6FB;padding:32px 12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">'
        f'<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;border-collapse:separate">'
        f'<tr><td style="background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.06)">'
        f'<div style="height:6px;background:{acc}"></div>'
        f'<div style="padding:28px 32px 8px 32px">{head}</div>'
        f'<div style="padding:12px 32px 0 32px">'
        f'<div style="font-size:12px;font-weight:700;color:{acc};text-transform:uppercase;letter-spacing:1.5px">{escape(doc_label.title())} {escape(doc.get("number") or "")}</div>'
        f'<div style="font-size:24px;font-weight:700;color:#0F172A;margin-top:6px;letter-spacing:-0.4px">Hola, {hello}</div>'
        f'<p style="font-size:15px;line-height:1.6;color:#475569;margin:10px 0 0 0">Te enviamos {noun} de <b>{name}</b>. Encontrarás el documento completo en PDF adjunto a este correo.</p>'
        f'{pdf_chip}</div>'
        f'{extra_html}'
        f'<div style="margin:24px 32px 0 32px;background:#F8FAFC;border:1px solid #EEF0F4;border-radius:14px;padding:20px">'
        f'<div style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px">Importe total</div>'
        f'<div style="font-size:32px;font-weight:800;color:#0F172A;letter-spacing:-0.8px;margin-top:2px">{escape(_eur(doc.get("total")))}</div>'
        f'<table role="presentation" style="margin-top:14px;border-collapse:collapse"><tr>{meta}</tr></table></div>'
        f'<div style="padding:20px 32px 0 32px"><table role="presentation" width="100%" style="border-collapse:collapse">{lines}</table>'
        f'<table role="presentation" width="100%" style="border-collapse:collapse;margin-top:10px">{totals}'
        f'<tr><td style="padding:10px 0 0 0;font-size:15px;font-weight:700;color:#0F172A;border-top:2px solid #0F172A">Total</td>'
        f'<td style="padding:10px 0 0 0;font-size:15px;font-weight:700;color:#0F172A;text-align:right;border-top:2px solid #0F172A">{escape(_eur(doc.get("total")))}</td></tr></table></div>'
        f'<div style="padding:28px 32px 28px 32px;margin-top:24px;border-top:1px solid #EEF0F4">'
        f'<div style="font-size:13px;font-weight:600;color:#0F172A">{name}</div>'
        f'<div style="font-size:12px;color:#64748B;margin-top:4px;line-height:1.5">{contact}</div>'
        f'<div style="font-size:11px;color:#94A3B8;margin-top:14px">Si tienes cualquier duda, responde a este correo. Nunca te pediremos contraseñas ni datos bancarios por email.</div>'
        f'</div></td></tr>'
        f'<tr><td style="text-align:center;padding:16px 0;font-size:11px;color:#94A3B8">Documento emitido con <a href="https://openfactura.es" style="color:#64748B;text-decoration:none;font-weight:600">OpenFactura.es</a></td></tr>'
        f'</table></div>'
    )
