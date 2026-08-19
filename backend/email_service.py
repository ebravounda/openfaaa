import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "OpenFactura")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")


async def _send_via_resend(rc: dict, to: str, subject: str, html: str, reply_to: str | None):
    from fastapi import HTTPException
    if not rc.get("from_email"):
        raise HTTPException(status_code=400, detail="Configura el email remitente (dominio verificado) en Integraciones.")
    payload = {"from": f'{rc.get("from_name") or "OpenFactura"} <{rc["from_email"]}>',
               "to": [to], "subject": subject, "html": html}
    rt = reply_to or rc.get("reply_to")
    if rt:
        payload["reply_to"] = rt
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post("https://api.resend.com/emails",
                                     headers={"Authorization": f"Bearer {rc['api_key']}"},
                                     json=payload)
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Resend send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail=f"Resend rechazó el envío: {e.response.text[:200]}")
    except Exception as e:
        logger.error(f"Resend send error: {e}")
        raise HTTPException(status_code=500, detail="No se pudo enviar el email con Resend")


async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None):
    _assert_safe_email(subject, html)
    # 1) Resend propio del usuario (self-hosted) si está configurado en Integraciones
    from integrations_config import get_resend
    rc = await get_resend()
    if rc.get("api_key"):
        return await _send_via_resend(rc, to, subject, html, reply_to)
    # 2) Fallback: servicio de email gestionado por Emergent
    from fastapi import HTTPException
    if not EMAIL_KEY:
        raise HTTPException(status_code=400, detail="El email no está configurado. Añade tu API key de Resend en Integraciones.")
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="No se pudo enviar el email")
    except Exception as e:
        logger.error(f"Email send error: {str(e)}")
        raise HTTPException(status_code=500, detail="No se pudo enviar el email")


def _eur(v):
    return f"{v:,.2f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def build_invoice_email_html(invoice: dict, company: dict) -> str:
    comp = company or {}
    rows = ""
    for it in invoice.get("line_items", []):
        amount = it["quantity"] * it["unit_price"]
        rows += (
            f'<tr><td style="padding:8px;border-bottom:1px solid #E5E5E5;font-size:14px">{escape(it["description"])}</td>'
            f'<td style="padding:8px;border-bottom:1px solid #E5E5E5;text-align:right;font-size:14px">{it["quantity"]}</td>'
            f'<td style="padding:8px;border-bottom:1px solid #E5E5E5;text-align:right;font-size:14px">{escape(_eur(it["unit_price"]))}</td>'
            f'<td style="padding:8px;border-bottom:1px solid #E5E5E5;text-align:right;font-size:14px">{escape(_eur(amount))}</td></tr>'
        )
    irpf_row = ""
    if invoice.get("irpf_rate"):
        irpf_row = (f'<tr><td colspan="3" style="padding:4px 8px;text-align:right;color:#666">'
                    f'Retención IRPF (-{invoice["irpf_rate"]}%)</td>'
                    f'<td style="padding:4px 8px;text-align:right">-{escape(_eur(invoice["irpf_amount"]))}</td></tr>')
    return (
        f'<table role="presentation" width="100%" style="max-width:640px;margin:0 auto;'
        f'font-family:Arial,Helvetica,sans-serif;background:#ffffff">'
        f'<tr><td style="padding:24px 24px 8px 24px">'
        f'<div style="font-size:22px;font-weight:bold;color:#0A0A0A">FACTURA {escape(invoice["number"])}</div>'
        f'<div style="font-size:13px;color:#666;margin-top:4px">Emitida por {escape(comp.get("name","Mi Empresa"))} '
        f'· {escape(comp.get("nif",""))}</div>'
        f'<div style="font-size:13px;color:#666">Fecha: {escape(invoice["issue_date"])}</div>'
        f'</td></tr>'
        f'<tr><td style="padding:8px 24px">'
        f'<div style="font-size:11px;font-weight:bold;color:#666;text-transform:uppercase;letter-spacing:1px">Facturar a</div>'
        f'<div style="font-size:15px;color:#111;font-weight:bold;margin-top:4px">{escape(invoice.get("client",{}).get("name",""))}</div>'
        f'<div style="font-size:13px;color:#666">{escape(invoice.get("client",{}).get("nif",""))}</div>'
        f'</td></tr>'
        f'<tr><td style="padding:16px 24px">'
        f'<table role="presentation" width="100%" style="border-collapse:collapse">'
        f'<tr style="background:#0A0A0A;color:#fff">'
        f'<td style="padding:8px;font-size:12px">Descripción</td>'
        f'<td style="padding:8px;font-size:12px;text-align:right">Cant.</td>'
        f'<td style="padding:8px;font-size:12px;text-align:right">Precio</td>'
        f'<td style="padding:8px;font-size:12px;text-align:right">Importe</td></tr>'
        f'{rows}'
        f'<tr><td colspan="3" style="padding:8px;text-align:right;color:#666">Base imponible</td>'
        f'<td style="padding:8px;text-align:right">{escape(_eur(invoice["base"]))}</td></tr>'
        f'<tr><td colspan="3" style="padding:4px 8px;text-align:right;color:#666">IVA ({invoice["iva_rate"]}%)</td>'
        f'<td style="padding:4px 8px;text-align:right">{escape(_eur(invoice["iva_amount"]))}</td></tr>'
        f'{irpf_row}'
        f'<tr><td colspan="3" style="padding:10px 8px;text-align:right;font-weight:bold;font-size:16px;border-top:2px solid #0A0A0A">TOTAL</td>'
        f'<td style="padding:10px 8px;text-align:right;font-weight:bold;font-size:16px;border-top:2px solid #0A0A0A">{escape(_eur(invoice["total"]))}</td></tr>'
        f'</table></td></tr>'
        f'<tr><td style="padding:16px 24px;border-top:1px solid #E5E5E5">'
        f'<p style="font-size:12px;color:#888;margin:0">Este email ha sido enviado por {escape(EMAIL_FROM_NAME)}. '
        f'Nunca le pediremos su contraseña ni datos bancarios por email.</p>'
        f'</td></tr></table>'
    )
