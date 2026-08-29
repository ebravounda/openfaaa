import io
import hashlib
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

try:
    from zoneinfo import ZoneInfo
    _MADRID = ZoneInfo("Europe/Madrid")
except Exception:
    _MADRID = timezone(timedelta(hours=1))

# URLs oficiales del servicio de cotejo QR (Orden HAC/1177/2024)
QR_BASE_TEST = "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR"
QR_BASE_PROD = "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR"
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


def build_qr_url(nif, numserie, fecha, importe, produccion: bool = False) -> str:
    base = QR_BASE_PROD if produccion else QR_BASE_TEST
    f = fecha
    if len(f) >= 10 and f[4] == "-":  # ISO YYYY-MM-DD -> DD-MM-YYYY
        f = to_ddmmyyyy(f)
    return base + "?" + urlencode({
        "nif": nif, "numserie": numserie, "fecha": f, "importe": _fmt_num(importe),
    })


def _build_desglose(invoice: dict) -> str:
    """Desglose por cada tipo impositivo (multi-IVA), operaciones exentas y recargo."""
    bd = invoice.get("iva_breakdown") or []
    parts = []
    for b in bd:
        re_xml = (f"<sum1:TipoRecargoEquivalencia>{_fmt_num(b.get('re_rate', 0))}</sum1:TipoRecargoEquivalencia>"
                  f"<sum1:CuotaRecargoEquivalencia>{_fmt_num(b.get('re_cuota', 0))}</sum1:CuotaRecargoEquivalencia>"
                  if b.get("re_cuota") else "")
        parts.append(
            "<sum1:DetalleDesglose>"
            "<sum1:Impuesto>01</sum1:Impuesto>"
            "<sum1:ClaveRegimen>01</sum1:ClaveRegimen>"
            "<sum1:CalificacionOperacion>S1</sum1:CalificacionOperacion>"
            f"<sum1:TipoImpositivo>{_fmt_num(b.get('rate', 0))}</sum1:TipoImpositivo>"
            f"<sum1:BaseImponibleOimporteNoSujeto>{_fmt_num(b.get('base', 0))}</sum1:BaseImponibleOimporteNoSujeto>"
            f"<sum1:CuotaRepercutida>{_fmt_num(b.get('cuota', 0))}</sum1:CuotaRepercutida>"
            f"{re_xml}</sum1:DetalleDesglose>")
    if invoice.get("base_exenta"):
        parts.append(
            "<sum1:DetalleDesglose>"
            "<sum1:Impuesto>01</sum1:Impuesto>"
            "<sum1:ClaveRegimen>01</sum1:ClaveRegimen>"
            "<sum1:OperacionExenta>E1</sum1:OperacionExenta>"
            f"<sum1:BaseImponibleOimporteNoSujeto>{_fmt_num(invoice.get('base_exenta', 0))}</sum1:BaseImponibleOimporteNoSujeto>"
            "</sum1:DetalleDesglose>")
    if not parts:  # compatibilidad con facturas antiguas (un solo tipo)
        parts.append(
            "<sum1:DetalleDesglose>"
            "<sum1:Impuesto>01</sum1:Impuesto><sum1:ClaveRegimen>01</sum1:ClaveRegimen>"
            "<sum1:CalificacionOperacion>S1</sum1:CalificacionOperacion>"
            f"<sum1:TipoImpositivo>{_fmt_num(invoice.get('iva_rate', 0))}</sum1:TipoImpositivo>"
            f"<sum1:BaseImponibleOimporteNoSujeto>{_fmt_num(invoice.get('base', 0))}</sum1:BaseImponibleOimporteNoSujeto>"
            f"<sum1:CuotaRepercutida>{_fmt_num(invoice.get('iva_amount', 0))}</sum1:CuotaRepercutida>"
            "</sum1:DetalleDesglose>")
    return "".join(parts)


def _sistema_informatico(nif: str, nombre_razon: str = "") -> str:
    # El productor del SIF debe estar censado en la AEAT. Para software de uso
    # propio, el productor es el propio obligado (su NombreRazon + NIF del censo).
    razon = (nombre_razon or "").strip() or "OpenFactura"
    return (
        "<sum1:SistemaInformatico>"
        f"<sum1:NombreRazon>{_xesc(razon)}</sum1:NombreRazon>"
        f"<sum1:NIF>{_xesc(nif)}</sum1:NIF>"
        "<sum1:NombreSistemaInformatico>OpenFactura</sum1:NombreSistemaInformatico>"
        "<sum1:IdSistemaInformatico>OF</sum1:IdSistemaInformatico>"
        "<sum1:Version>1.0</sum1:Version>"
        "<sum1:NumeroInstalacion>1</sum1:NumeroInstalacion>"
        "<sum1:TipoUsoPosibleSoloVerifactu>S</sum1:TipoUsoPosibleSoloVerifactu>"
        "<sum1:TipoUsoPosibleMultiOT>N</sum1:TipoUsoPosibleMultiOT>"
        "<sum1:IndicadorMultiplesOT>N</sum1:IndicadorMultiplesOT>"
        "</sum1:SistemaInformatico>")


def _encadenamiento(nif, prev_number, prev_huella, prev_fecha) -> str:
    if not prev_huella:
        return "<sum1:Encadenamiento><sum1:PrimerRegistro>S</sum1:PrimerRegistro></sum1:Encadenamiento>"
    return (
        "<sum1:Encadenamiento><sum1:RegistroAnterior>"
        f"<sum1:IDEmisorFactura>{_xesc(nif)}</sum1:IDEmisorFactura>"
        f"<sum1:NumSerieFactura>{_xesc(prev_number)}</sum1:NumSerieFactura>"
        f"<sum1:FechaExpedicionFactura>{_xesc(prev_fecha or '')}</sum1:FechaExpedicionFactura>"
        f"<sum1:Huella>{_xesc(prev_huella)}</sum1:Huella>"
        "</sum1:RegistroAnterior></sum1:Encadenamiento>")


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
                            ts: str, huella: str, prev_fecha: str = "", rectified: dict = None) -> str:
    """RegistroAlta VeriFactu (namespace sum1, sin envelope)."""
    is_rect = invoice.get("invoice_type") == "rectificativa"
    tipo = "R1" if is_rect else "F1"
    nif = company.get("nif", "")
    fecha = to_ddmmyyyy(invoice["issue_date"])
    cl = invoice.get("client", {})
    # Bloque rectificativa (obligatorio para R1-R5). La app rectifica "por diferencias" (I).
    rect_xml = ""
    if is_rect:
        rect_xml = "<sum1:TipoRectificativa>I</sum1:TipoRectificativa>"
        rn = (rectified or {}).get("number") or invoice.get("rectifies_number") or ""
        rf = (rectified or {}).get("fecha") or ""
        if rn:
            rect_xml += (
                "<sum1:FacturasRectificadas><sum1:IDFacturaRectificada>"
                f"<sum1:IDEmisorFactura>{_xesc(nif)}</sum1:IDEmisorFactura>"
                f"<sum1:NumSerieFactura>{_xesc(rn)}</sum1:NumSerieFactura>"
                f"<sum1:FechaExpedicionFactura>{_xesc(rf)}</sum1:FechaExpedicionFactura>"
                "</sum1:IDFacturaRectificada></sum1:FacturasRectificadas>")
    return (
        "<sum1:RegistroAlta>"
        "<sum1:IDVersion>1.0</sum1:IDVersion>"
        "<sum1:IDFactura>"
        f"<sum1:IDEmisorFactura>{_xesc(nif)}</sum1:IDEmisorFactura>"
        f"<sum1:NumSerieFactura>{_xesc(invoice['number'])}</sum1:NumSerieFactura>"
        f"<sum1:FechaExpedicionFactura>{fecha}</sum1:FechaExpedicionFactura>"
        "</sum1:IDFactura>"
        f"<sum1:NombreRazonEmisor>{_xesc(company.get('name',''))}</sum1:NombreRazonEmisor>"
        f"<sum1:TipoFactura>{tipo}</sum1:TipoFactura>"
        f"{rect_xml}"
        f"<sum1:DescripcionOperacion>{_xesc((invoice.get('line_items') or [{}])[0].get('description','Prestacion de servicios'))}</sum1:DescripcionOperacion>"
        f"<sum1:Destinatarios><sum1:IDDestinatario>"
        f"<sum1:NombreRazon>{_xesc(cl.get('name',''))}</sum1:NombreRazon>"
        f"<sum1:NIF>{_xesc(cl.get('nif',''))}</sum1:NIF>"
        f"</sum1:IDDestinatario></sum1:Destinatarios>"
        f"<sum1:Desglose>{_build_desglose(invoice)}</sum1:Desglose>"
        f"<sum1:CuotaTotal>{_fmt_num(invoice.get('iva_amount',0))}</sum1:CuotaTotal>"
        f"<sum1:ImporteTotal>{_fmt_num(invoice.get('total',0))}</sum1:ImporteTotal>"
        f"{_encadenamiento(nif, prev_number, prev_huella, prev_fecha)}"
        f"{_sistema_informatico(nif, company.get('name',''))}"
        f"<sum1:FechaHoraHusoGenRegistro>{ts}</sum1:FechaHoraHusoGenRegistro>"
        f"<sum1:TipoHuella>01</sum1:TipoHuella>"
        f"<sum1:Huella>{huella}</sum1:Huella>"
        "</sum1:RegistroAlta>"
    )


def build_registro_anulacion_xml(company: dict, invoice: dict, prev_number: str, prev_huella: str,
                                 ts: str, huella: str, prev_fecha: str = "") -> str:
    """RegistroAnulacion VeriFactu (namespace sum1, sin envelope)."""
    nif = company.get("nif", "")
    fecha = to_ddmmyyyy(invoice["issue_date"])
    return (
        "<sum1:RegistroAnulacion>"
        "<sum1:IDVersion>1.0</sum1:IDVersion>"
        "<sum1:IDFactura>"
        f"<sum1:IDEmisorFacturaAnulada>{_xesc(nif)}</sum1:IDEmisorFacturaAnulada>"
        f"<sum1:NumSerieFacturaAnulada>{_xesc(invoice['number'])}</sum1:NumSerieFacturaAnulada>"
        f"<sum1:FechaExpedicionFacturaAnulada>{fecha}</sum1:FechaExpedicionFacturaAnulada>"
        "</sum1:IDFactura>"
        f"{_encadenamiento(nif, prev_number, prev_huella, prev_fecha)}"
        f"{_sistema_informatico(nif, company.get('name',''))}"
        f"<sum1:FechaHoraHusoGenRegistro>{ts}</sum1:FechaHoraHusoGenRegistro>"
        f"<sum1:TipoHuella>01</sum1:TipoHuella>"
        f"<sum1:Huella>{huella}</sum1:Huella>"
        "</sum1:RegistroAnulacion>"
    )


NS_SUM = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd"
NS_SUM1 = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd"


def build_soap_request(registro_xml: str, nif: str, nombre_razon: str = "", signature: str = None) -> str:
    body = registro_xml.split("?>", 1)[-1].strip()
    return (
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" '
        f'xmlns:sum="{NS_SUM}" xmlns:sum1="{NS_SUM1}">'
        '<soapenv:Header/><soapenv:Body>'
        '<sum:RegFactuSistemaFacturacion>'
        '<sum:Cabecera><sum1:ObligadoEmision>'
        f'<sum1:NombreRazon>{_xesc(nombre_razon)}</sum1:NombreRazon>'
        f'<sum1:NIF>{_xesc(nif)}</sum1:NIF>'
        '</sum1:ObligadoEmision></sum:Cabecera>'
        f'<sum:RegistroFactura>{body}</sum:RegistroFactura>'
        '</sum:RegFactuSistemaFacturacion>'
        '</soapenv:Body></soapenv:Envelope>'
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
AEAT_PROD_URL = "https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP"
AEAT_PROD_SEAL_URL = "https://www10.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP"


def aeat_url(produccion: bool = False, seal: bool = False) -> str:
    """URL del servicio SOAP según entorno y tipo de certificado.
    - produccion=False → preproducción (sandbox). produccion=True → AEAT real.
    - seal=False → certificado personal/representante (www1/prewww1).
    - seal=True  → certificado de sello de entidad (www10/prewww10)."""
    if produccion:
        return AEAT_PROD_SEAL_URL if seal else AEAT_PROD_URL
    return AEAT_PREPROD_SEAL_URL if seal else AEAT_PREPROD_URL


def pfx_to_pem(pfx_bytes: bytes, password: str):
    from cryptography.hazmat.primitives.serialization import (
        pkcs12, Encoding, PrivateFormat, NoEncryption)
    key, cert, _chain = pkcs12.load_key_and_certificates(
        pfx_bytes, password.encode() if password else None)
    cert_pem = cert.public_bytes(Encoding.PEM)
    key_pem = key.private_bytes(Encoding.PEM, PrivateFormat.TraditionalOpenSSL, NoEncryption())
    return cert_pem, key_pem


async def send_to_aeat(pfx_bytes: bytes, password: str, soap_xml: str,
                       produccion: bool = False, seal: bool = False, timeout: int = 20) -> dict:
    """Envío real (mTLS) a la AEAT (preproducción o PRODUCCIÓN) con el certificado del usuario."""
    import httpx, tempfile, os
    url = aeat_url(produccion, seal)
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
