import os
from datetime import datetime, timezone
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding

_fernet = Fernet(os.environ["CERT_ENCRYPTION_KEY"].encode())


def encrypt(data: bytes) -> bytes:
    return _fernet.encrypt(data)


def decrypt(token: bytes) -> bytes:
    return _fernet.decrypt(token)


def parse_pfx(data: bytes, password: str):
    pwd = password.encode() if password else None
    key, cert, chain = pkcs12.load_key_and_certificates(data, pwd)
    if cert is None or key is None:
        raise ValueError("El archivo no contiene un certificado y clave válidos")
    return key, cert, chain


def _attr(name, cert_name):
    from cryptography.x509.oid import NameOID
    try:
        vals = cert_name.get_attributes_for_oid(getattr(NameOID, name))
        return vals[0].value if vals else ""
    except Exception:
        return ""


def cert_metadata(cert) -> dict:
    subject = cert.subject
    return {
        "subject_cn": _attr("COMMON_NAME", subject),
        "organization": _attr("ORGANIZATION_NAME", subject),
        "nif": _attr("SERIAL_NUMBER", subject) or _attr("ORGANIZATIONAL_UNIT_NAME", subject),
        "issuer_cn": _attr("COMMON_NAME", cert.issuer),
        "valid_from": cert.not_valid_before_utc.isoformat(),
        "valid_to": cert.not_valid_after_utc.isoformat(),
        "serial": format(cert.serial_number, "x"),
        "expired": cert.not_valid_after_utc < datetime.now(timezone.utc),
    }


def sign_data(private_key, data: bytes) -> str:
    """Firma RSA PKCS1v15 SHA-256 (base64) del contenido del registro."""
    import base64
    sig = private_key.sign(data, padding.PKCS1v15(), hashes.SHA256())
    return base64.b64encode(sig).decode()
