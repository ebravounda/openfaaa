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
