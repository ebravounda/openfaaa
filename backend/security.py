import os
from urllib.parse import urlparse

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Cabeceras de seguridad HTTP aplicadas a todas las respuestas.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-XSS-Protection": "1; mode=block",
    "Cross-Origin-Opener-Policy": "same-origin",
}

STATE_CHANGING = {"POST", "PUT", "PATCH", "DELETE"}
# Rutas exentas de la comprobación anti-CSRF (autenticadas por firma/secreto, no por cookie).
CSRF_EXEMPT_PREFIXES = ("/api/stripe/webhook", "/api/cron/")

# Límite de tamaño del cuerpo de la petición (protección DoS): 12 MB.
MAX_BODY_BYTES = 12 * 1024 * 1024


def _allowed_origins() -> set:
    origins = set()
    for key in ("FRONTEND_URL", "CORS_ORIGINS"):
        val = os.environ.get(key, "")
        for part in val.split(","):
            part = part.strip().rstrip("/")
            if part:
                origins.add(part)
    return origins


class SecurityMiddleware(BaseHTTPMiddleware):
    """Cabeceras de seguridad + límite de tamaño + defensa CSRF por origen."""

    def __init__(self, app):
        super().__init__(app)
        self.allowed = _allowed_origins()

    async def dispatch(self, request, call_next):
        path = request.url.path

        # 1) Límite de tamaño del cuerpo
        cl = request.headers.get("content-length")
        if cl:
            try:
                if int(cl) > MAX_BODY_BYTES:
                    return JSONResponse(status_code=413, content={"detail": "Archivo demasiado grande (máx. 12 MB)"})
            except ValueError:
                pass

        # 2) Defensa CSRF: en peticiones que cambian estado y llegan con cookie de sesión,
        #    exigimos una cabecera personalizada que solo puede fijar nuestro frontend
        #    (un formulario/imagen cross-site no puede añadir cabeceras custom; fetch con
        #    cabecera custom dispara preflight CORS que ya restringimos por origen).
        #    Además validamos el origen cuando está disponible (defensa en profundidad).
        if (
            request.method in STATE_CHANGING
            and request.cookies.get("access_token")
            and not any(path.startswith(p) for p in CSRF_EXEMPT_PREFIXES)
        ):
            if request.headers.get("x-of-client") != "web":
                return JSONResponse(status_code=403, content={"detail": "Petición no autorizada (CSRF)"})
            origin = request.headers.get("origin")
            if origin:
                origin_host = urlparse(origin).netloc
                req_host = request.headers.get("host", "")
                same_origin = origin_host and origin_host == req_host
                if not same_origin and origin.rstrip("/") not in self.allowed:
                    return JSONResponse(status_code=403, content={"detail": "Origen no permitido"})
            # Sin Origin ni Referer no bloqueamos (clientes no-navegador usan Bearer, no cookie).

        response = await call_next(request)

        for k, v in SECURITY_HEADERS.items():
            response.headers[k] = v
        # Ocultar cabecera Server (fingerprinting)
        if "server" in response.headers:
            del response.headers["server"]
        return response
