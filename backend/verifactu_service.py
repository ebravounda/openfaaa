import io
import hashlib
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

try:
    from zoneinfo import ZoneInfo
    _MADRID = ZoneInfo("Europe/Madrid")
except Exception:
    _MADRID = timezone(timedelta(hours=1))

# Producción AEAT (el QR es un enlace a la sede; NO se llama en tiempo de ejecución)
QR_BASE = "https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR"
LEGEND = "Factura verificable en la sede electrónica de la AEAT · VERI*FACTU"


def _fmt_num(x) -> str:
    return f"{float(x):.2f}"


def to_ddmmyyyy(iso_date: str) -> str:
    y, m, d = iso_date[:10].split("-")
    return f"{d}-{m}-{y}"


def now_ts() -> str:
    return datetime.now(_MADRID).replace(microsecond=0).isoformat()


def compute_fingerprint(nif, numserie, fecha, tipo, cuota, importe, prev, ts) -> str:
    """Huella SHA-256 encadenada según especificación VeriFactu (RegistroAlta)."""
    chain = (
        f"IDEmisorFactura={nif}"
        f"&NumSerieFactura={numserie}"
        f"&FechaExpedicionFactura={fecha}"
        f"&TipoFactura={tipo}"
        f"&CuotaTotal={_fmt_num(cuota)}"
        f"&ImporteTotal={_fmt_num(importe)}"
        f"&Huella={prev}"
        f"&FechaHoraHusoGenRegistro={ts}"
    )
    return hashlib.sha256(chain.encode("utf-8")).hexdigest().upper()


def compute_fingerprint_anulacion(nif, numserie, fecha, prev, ts) -> str:
    """Huella SHA-256 encadenada para RegistroAnulacion (VeriFactu)."""
    chain = (
        f"IDEmisorFacturaAnulada={nif}"
        f"&NumSerieFacturaAnulada={numserie}"
        f"&FechaExpedicionFacturaAnulada={fecha}"
        f"&Huella={prev}"
        f"&FechaHoraHusoGenRegistro={ts}"
    )
    return hashlib.sha256(chain.encode("utf-8")).hexdigest().upper()


def build_qr_url(nif, numserie, fecha, importe) -> str:
    return QR_BASE + "?" + urlencode({
        "nif": nif, "numserie": numserie, "fecha": fecha, "importe": _fmt_num(importe),
    })


def generate_qr_png(url: str) -> bytes:
    import qrcode
    qr = qrcode.QRCode(border=1, box_size=6)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()


def _xesc(v) -> str:
    s = str(v)
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            .replace('"', "&quot;"))


def build_registro_alta_xml(company: dict, invoice: dict, prev_number: str, prev_huella: str,
                            ts: str, huella: str) -> str:
    """RegistroAlta según SuministroLR de VeriFactu (representativo del XSD de la AEAT)."""
    tipo = "R1" if invoice.get("invoice_type") == "rectificativa" else "F1"
    nif = company.get("nif", "")
    fecha = to_ddmmyyyy(invoice["issue_date"])
    cl = invoice.get("client", {})
    encad = (f"<sf:RegistroAnterior><sf:IDEmisorFactura>{_xesc(nif)}</sf:IDEmisorFactura>"
             f"<sf:NumSerieFactura>{_xesc(prev_number)}</sf:NumSerieFactura>"
             f"<sf:Huella>{_xesc(prev_huella)}</sf:Huella></sf:RegistroAnterior>"
             if prev_huella else "<sf:PrimerRegistro>S</sf:PrimerRegistro>")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<sf:RegistroAlta xmlns:sf="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/SistemaFacturacion.xsd">'
        f"<sf:IDVersion>1.0</sf:IDVersion>"
        f"<sf:IDFactura>"
        f"<sf:IDEmisorFactura>{_xesc(nif)}</sf:IDEmisorFactura>"
        f"<sf:NumSerieFactura>{_xesc(invoice['number'])}</sf:NumSerieFactura>"
        f"<sf:FechaExpedicionFactura>{fecha}</sf:FechaExpedicionFactura>"
        f"</sf:IDFactura>"
        f"<sf:NombreRazonEmisor>{_xesc(company.get('name',''))}</sf:NombreRazonEmisor>"
        f"<sf:TipoFactura>{tipo}</sf:TipoFactura>"
        f"<sf:DescripcionOperacion>{_xesc((invoice.get('line_items') or [{}])[0].get('description','Prestacion de servicios'))}</sf:DescripcionOperacion>"
        f"<sf:Destinatario><sf:NombreRazon>{_xesc(cl.get('name',''))}</sf:NombreRazon>"
        f"<sf:NIF>{_xesc(cl.get('nif',''))}</sf:NIF></sf:Destinatario>"
        f"<sf:Desglose><sf:DetalleDesglose>"
        f"<sf:TipoImpositivo>{_fmt_num(invoice.get('iva_rate',0))}</sf:TipoImpositivo>"
        f"<sf:BaseImponibleOimporteNoSujeto>{_fmt_num(invoice.get('base',0))}</sf:BaseImponibleOimporteNoSujeto>"
        f"<sf:CuotaRepercutida>{_fmt_num(invoice.get('iva_amount',0))}</sf:CuotaRepercutida>"
        f"</sf:DetalleDesglose></sf:Desglose>"
        f"<sf:CuotaTotal>{_fmt_num(invoice.get('iva_amount',0))}</sf:CuotaTotal>"
        f"<sf:ImporteTotal>{_fmt_num(invoice.get('total',0))}</sf:ImporteTotal>"
        f"<sf:Encadenamiento>{encad}</sf:Encadenamiento>"
        f"<sf:SistemaInformatico><sf:NombreSistemaInformatico>FiscalHub</sf:NombreSistemaInformatico>"
        f"<sf:IdSistemaInformatico>FH</sf:IdSistemaInformatico><sf:Version>1.0</sf:Version></sf:SistemaInformatico>"
        f"<sf:FechaHoraHusoGenRegistro>{ts}</sf:FechaHoraHusoGenRegistro>"
        f"<sf:TipoHuella>01</sf:TipoHuella>"
        f"<sf:Huella>{huella}</sf:Huella>"
        f"</sf:RegistroAlta>"
    )


def build_registro_anulacion_xml(company: dict, invoice: dict, prev_number: str, prev_huella: str,
                                 ts: str, huella: str) -> str:
    """RegistroAnulacion según SuministroLR de VeriFactu (representativo del XSD de la AEAT)."""
    nif = company.get("nif", "")
    fecha = to_ddmmyyyy(invoice["issue_date"])
    encad = (f"<sf:RegistroAnterior><sf:IDEmisorFactura>{_xesc(nif)}</sf:IDEmisorFactura>"
             f"<sf:NumSerieFactura>{_xesc(prev_number)}</sf:NumSerieFactura>"
             f"<sf:Huella>{_xesc(prev_huella)}</sf:Huella></sf:RegistroAnterior>"
             if prev_huella else "<sf:PrimerRegistro>S</sf:PrimerRegistro>")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<sf:RegistroAnulacion xmlns:sf="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/SistemaFacturacion.xsd">'
        f"<sf:IDVersion>1.0</sf:IDVersion>"
        f"<sf:IDFactura>"
        f"<sf:IDEmisorFacturaAnulada>{_xesc(nif)}</sf:IDEmisorFacturaAnulada>"
        f"<sf:NumSerieFacturaAnulada>{_xesc(invoice['number'])}</sf:NumSerieFacturaAnulada>"
        f"<sf:FechaExpedicionFacturaAnulada>{fecha}</sf:FechaExpedicionFacturaAnulada>"
        f"</sf:IDFactura>"
        f"<sf:Encadenamiento>{encad}</sf:Encadenamiento>"
        f"<sf:SistemaInformatico><sf:NombreSistemaInformatico>FiscalHub</sf:NombreSistemaInformatico>"
        f"<sf:IdSistemaInformatico>FH</sf:IdSistemaInformatico><sf:Version>1.0</sf:Version></sf:SistemaInformatico>"
        f"<sf:FechaHoraHusoGenRegistro>{ts}</sf:FechaHoraHusoGenRegistro>"
        f"<sf:TipoHuella>01</sf:TipoHuella>"
        f"<sf:Huella>{huella}</sf:Huella>"
        f"</sf:RegistroAnulacion>"
    )


def build_soap_request(registro_xml: str, nif: str, signature_b64: str = None) -> str:
    firma = f'\n    <!-- Firma XAdES (RSA-SHA256): {signature_b64[:64]}... -->' if signature_b64 else ''
    body = registro_xml.split("?>", 1)[-1].strip()
    return (
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">\n'
        '  <soapenv:Header/>\n'
        '  <soapenv:Body>\n'
        '    <sf:RegFactuSistemaFacturacion>\n'
        f'      <sf:Cabecera><sf:ObligadoEmision><sf:NIF>{_xesc(nif)}</sf:NIF></sf:ObligadoEmision></sf:Cabecera>\n'
        f'      {body}{firma}\n'
        '    </sf:RegFactuSistemaFacturacion>\n'
        '  </soapenv:Body>\n'
        '</soapenv:Envelope>'
    )


def simulate_aeat_response(nif: str, numserie: str, csv: str, ts: str) -> str:
    """Respuesta SIMULADA del servicio web de la AEAT (estructura representativa)."""
    return (
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">\n'
        '  <soapenv:Body>\n'
        '    <tikR:RespuestaRegFactuSistemaFacturacion xmlns:tikR="https://www2.agenciatributaria.gob.es/.../RespuestaSuministro.xsd">\n'
        f'      <tikR:CSV>{csv}</tikR:CSV>\n'
        f'      <tikR:DatosPresentacion><tikR:NIFPresentador>{_xesc(nif)}</tikR:NIFPresentador>'
        f'<tikR:TimestampPresentacion>{ts}</tikR:TimestampPresentacion></tikR:DatosPresentacion>\n'
        '      <tikR:EstadoEnvio>Correcto</tikR:EstadoEnvio>\n'
        '      <tikR:RespuestaLinea>\n'
        f'        <tikR:IDFactura><tikR:NumSerieFactura>{_xesc(numserie)}</tikR:NumSerieFactura></tikR:IDFactura>\n'
        '        <tikR:EstadoRegistro>Correcto</tikR:EstadoRegistro>\n'
        '        <tikR:CodigoErrorRegistro/>\n'
        '        <tikR:DescripcionErrorRegistro/>\n'
        '      </tikR:RespuestaLinea>\n'
        '    </tikR:RespuestaRegFactuSistemaFacturacion>\n'
        '  </soapenv:Body>\n'
        '</soapenv:Envelope>'
    )


AEAT_PREPROD_URL = "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP"
AEAT_PREPROD_SEAL_URL = "https://prewww10.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP"


def pfx_to_pem(pfx_bytes: bytes, password: str):
    from cryptography.hazmat.primitives.serialization import (
        pkcs12, Encoding, PrivateFormat, NoEncryption)
    key, cert, _chain = pkcs12.load_key_and_certificates(
        pfx_bytes, password.encode() if password else None)
    cert_pem = cert.public_bytes(Encoding.PEM)
    key_pem = key.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption())
    return cert_pem, key_pem


async def send_to_aeat(pfx_bytes: bytes, password: str, soap_xml: str, seal: bool = False, timeout: int = 20) -> dict:
    """Envío real (mTLS) al entorno de PREPRODUCCIÓN de la AEAT usando el certificado del usuario."""
    import httpx, tempfile, os
    url = AEAT_PREPROD_SEAL_URL if seal else AEAT_PREPROD_URL
    try:
        cert_pem, key_pem = pfx_to_pem(pfx_bytes, password)
    except Exception as e:
        return {"ok": False, "status": None, "response": None, "url": url, "error": f"Certificado inválido: {e}"}
    cf = tempfile.NamedTemporaryFile(delete=False, suffix=".pem"); cf.write(cert_pem); cf.close()
    kf = tempfile.NamedTemporaryFile(delete=False, suffix=".pem"); kf.write(key_pem); kf.close()
    try:
        async with httpx.AsyncClient(cert=(cf.name, kf.name), timeout=timeout, verify=True) as client:
            r = await client.post(url, content=soap_xml.encode("utf-8"),
                                  headers={"Content-Type": "text/xml; charset=utf-8", "SOAPAction": ""})
        return {"ok": r.status_code == 200, "status": r.status_code, "response": r.text[:8000], "url": url, "error": None}
    except Exception as e:
        return {"ok": False, "status": None, "response": None, "url": url, "error": f"{type(e).__name__}: {e}"}
    finally:
        for f in (cf.name, kf.name):
            try:
                os.unlink(f)
            except Exception:
                pass
