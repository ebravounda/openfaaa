import os
import jwt
import bcrypt
import secrets
import hashlib
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from bson import ObjectId

from database import db
from templates import TEMPLATE_MAP

logger = logging.getLogger("auth")
JWT_ALGORITHM = "HS256"
router = APIRouter(prefix="/api/auth", tags=["auth"])


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def validate_password_strength(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 8 caracteres.")
    if len(password) > 128:
        raise HTTPException(status_code=422, detail="La contraseña es demasiado larga.")
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        raise HTTPException(status_code=422, detail="La contraseña debe incluir letras y números.")


def create_access_token(user_id: str, email: str, imp: str = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        "type": "access",
    }
    if imp:
        payload["imp"] = imp
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, imp: str = None) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    if imp:
        payload["imp"] = imp
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def _set_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=900, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


class RegisterInput(BaseModel):
    name: str
    last_name: str = ""
    email: EmailStr
    password: str
    phone: str = ""
    address: str = ""
    tax_id: str = ""
    tax_type: str = "autonomo"
    activity: str = ""


class LoginInput(BaseModel):
    email: EmailStr
    password: str


def _public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "last_name": user.get("last_name", ""),
        "phone": user.get("phone", ""),
        "address": user.get("address", ""),
        "tax_id": user.get("tax_id", ""),
        "email": user["email"],
        "role": user.get("role", "user"),
        "tax_type": user.get("tax_type", "autonomo"),
        "plan": user.get("plan", "basico"),
        "is_blocked": bool(user.get("is_blocked", False)),
        "activity": user.get("activity", ""),
        "trial_ends_at": user.get("trial_ends_at", ""),
        "active_company_id": user.get("active_company_id", ""),
        "multi_company_enabled": bool(user.get("multi_company_enabled", False)),
        "pos_enabled": bool(user.get("pos_enabled", False)),
        "gestoria_id": user.get("gestoria_id", ""),
        "firm_name": user.get("firm_name", ""),
        "max_clients": int(user.get("max_clients", 0) or 0),
    }


BLOCKED_MSG = "Tu cuenta ha sido bloqueada, contacta a soporte"


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo de token inválido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        imp = payload.get("imp")
        if user.get("is_blocked") and not imp:
            raise HTTPException(status_code=403, detail=BLOCKED_MSG)
        pu = _public_user(user)
        if imp:
            pu["is_impersonating"] = True
            pu["impersonator_id"] = imp
        return pu
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


async def require_admin(user=Depends(get_current_user)) -> dict:
    if user.get("role") != "admin" or user.get("is_impersonating"):
        raise HTTPException(status_code=403, detail="Acceso restringido al administrador")
    return user


async def _check_lockout(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if rec and rec.get("count", 0) >= 5:
        locked_until = rec.get("locked_until")
        if locked_until and datetime.now(timezone.utc) < datetime.fromisoformat(locked_until):
            raise HTTPException(status_code=429, detail="Demasiados intentos. Inténtalo en 15 minutos.")


async def _register_failed(identifier: str):
    rec = await db.login_attempts.find_one({"identifier": identifier})
    count = (rec.get("count", 0) if rec else 0) + 1
    update = {"count": count}
    if count >= 5:
        update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)


async def _check_register_throttle(ip: str):
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    rec = await db.register_attempts.find_one({"ip": ip})
    if rec:
        window_start = rec.get("window_start")
        count = rec.get("count", 0)
        if window_start and (now - datetime.fromisoformat(window_start)) < timedelta(hours=1):
            if count >= 5:
                raise HTTPException(status_code=429, detail="Demasiados registros desde esta conexión. Inténtalo más tarde.")


async def _register_count_inc(ip: str):
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    rec = await db.register_attempts.find_one({"ip": ip})
    if rec and rec.get("window_start") and (now - datetime.fromisoformat(rec["window_start"])) < timedelta(hours=1):
        await db.register_attempts.update_one({"ip": ip}, {"$inc": {"count": 1}})
    else:
        await db.register_attempts.update_one(
            {"ip": ip}, {"$set": {"count": 1, "window_start": now.isoformat()}}, upsert=True)


@router.post("/register")
async def register(data: RegisterInput, request: Request, response: Response):
    ip = request.client.host if request.client else "unknown"
    await _check_register_throttle(ip)
    validate_password_strength(data.password)
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Este email ya está registrado")
    doc = {
        "name": data.name,
        "last_name": data.last_name,
        "phone": data.phone,
        "address": data.address,
        "tax_id": data.tax_id,
        "email": email,
        "password_hash": hash_password(data.password),
        "role": "user",
        "plan": "basico",
        "is_blocked": False,
        "trial_ends_at": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
        "tax_type": data.tax_type if data.tax_type in ("autonomo", "empresa") else "autonomo",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if data.activity in TEMPLATE_MAP:
        doc["activity"] = data.activity
    result = await db.users.insert_one(doc)
    uid = str(result.inserted_id)
    import uuid as _uuid
    cid = str(_uuid.uuid4())
    await db.companies.insert_one({
        "id": cid, "user_id": uid, "name": data.name, "tax_type": doc["tax_type"],
        "nif": data.tax_id, "address": data.address, "phone": data.phone, "email": email,
        "template_id": (data.activity if data.activity in TEMPLATE_MAP else "clasico"),
        "created_at": datetime.now(timezone.utc).isoformat()})
    await db.users.update_one({"_id": result.inserted_id}, {"$set": {"active_company_id": cid}})
    doc["active_company_id"] = cid
    await _register_count_inc(ip)
    _set_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    doc["_id"] = result.inserted_id
    return _public_user(doc)


@router.post("/login")
async def login(data: LoginInput, request: Request, response: Response):
    email = data.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    await _check_lockout(identifier)
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        await _register_failed(identifier)
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    if user.get("is_blocked"):
        raise HTTPException(status_code=403, detail=BLOCKED_MSG)
    await db.login_attempts.delete_one({"identifier": identifier})
    uid = str(user["_id"])
    _set_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return _public_user(user)


@router.post("/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"status": "ok"}


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return user


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No hay token de refresco")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        imp = payload.get("imp")
        if user.get("is_blocked") and not imp:
            raise HTTPException(status_code=403, detail=BLOCKED_MSG)
        access = create_access_token(str(user["_id"]), user["email"], imp=imp)
        response.set_cookie("access_token", access, httponly=True, secure=True,
                            samesite="none", max_age=900, path="/")
        return {"status": "ok"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


class ForgotPasswordInput(BaseModel):
    email: EmailStr


class ResetPasswordInput(BaseModel):
    token: str
    password: str


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _reset_email_html(name: str, link: str) -> str:
    saludo = f"Hola {name}," if name else "Hola,"
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
      <div style="text-align:center;padding:8px 0 20px">
        <span style="font-size:22px;font-weight:700;color:#0052FF">openfactura</span>
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
        <h1 style="font-size:20px;margin:0 0 12px">Restablece tu contraseña</h1>
        <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 8px">{saludo}</p>
        <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 24px">
          Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en OpenFactura.
          Pulsa el botón para crear una nueva contraseña. Este enlace caduca en 1 hora.
        </p>
        <div style="text-align:center;margin:0 0 24px">
          <a href="{link}" style="display:inline-block;background:#0052FF;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:12px;font-size:15px">Restablecer contraseña</a>
        </div>
        <p style="font-size:13px;line-height:1.6;color:#94a3b8;margin:0">
          Si no has solicitado este cambio, puedes ignorar este email; tu contraseña seguirá siendo la misma.
        </p>
        <p style="font-size:12px;color:#cbd5e1;margin:16px 0 0;word-break:break-all">O copia este enlace: {link}</p>
      </div>
      <p style="text-align:center;font-size:12px;color:#94a3b8;margin:16px 0 0">© OpenFactura · Facturación para autónomos y empresas en España</p>
    </div>
    """


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordInput, request: Request):
    email = data.email.lower()
    generic = {"status": "ok",
               "message": "Si el email existe en nuestro sistema, te hemos enviado instrucciones para restablecer tu contraseña."}
    user = await db.users.find_one({"email": email})
    if not user:
        return generic
    now = datetime.now(timezone.utc)
    recent = await db.password_reset_tokens.count_documents({
        "user_id": str(user["_id"]),
        "created_at": {"$gt": (now - timedelta(minutes=15)).isoformat()},
    })
    if recent >= 3:
        return generic
    token = secrets.token_urlsafe(32)
    await db.password_reset_tokens.insert_one({
        "token_hash": _hash_token(token),
        "user_id": str(user["_id"]),
        "email": email,
        "used": False,
        "expires_at": (now + timedelta(hours=1)).isoformat(),
        "created_at": now.isoformat(),
    })
    origin = request.headers.get("origin") or os.environ.get("APP_BASE_URL", "https://openfactura.es")
    reset_link = f"{origin.rstrip('/')}/restablecer-contrasena?token={token}"
    try:
        from email_service import send_email
        await send_email(
            to=email,
            subject="Restablece tu contraseña · OpenFactura",
            html=_reset_email_html(user.get("name", ""), reset_link),
        )
    except Exception as e:
        logger.error(f"forgot-password email failed: {e}")
    return generic


@router.post("/reset-password")
async def reset_password(data: ResetPasswordInput):
    validate_password_strength(data.password)
    rec = await db.password_reset_tokens.find_one({"token_hash": _hash_token(data.token), "used": False})
    if not rec:
        raise HTTPException(status_code=400, detail="El enlace no es válido o ya se ha utilizado.")
    try:
        expired = datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc)
    except Exception:
        expired = True
    if expired:
        raise HTTPException(status_code=400, detail="El enlace ha caducado. Solicita uno nuevo.")
    await db.users.update_one({"_id": ObjectId(rec["user_id"])},
                              {"$set": {"password_hash": hash_password(data.password)}})
    await db.password_reset_tokens.update_many({"user_id": rec["user_id"], "used": False},
                                               {"$set": {"used": True, "used_at": datetime.now(timezone.utc).isoformat()}})
    return {"status": "ok", "message": "Tu contraseña se ha actualizado. Ya puedes iniciar sesión."}


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@fiscalhub.es").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "name": "Admin",
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
