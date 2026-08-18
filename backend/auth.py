import os
import jwt
import bcrypt
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from bson import ObjectId

from database import db
from templates import TEMPLATE_MAP

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
    email: EmailStr
    password: str
    tax_type: str = "autonomo"
    activity: str = ""


class LoginInput(BaseModel):
    email: EmailStr
    password: str


def _public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user["email"],
        "role": user.get("role", "user"),
        "tax_type": user.get("tax_type", "autonomo"),
        "plan": user.get("plan", "basico"),
        "is_blocked": bool(user.get("is_blocked", False)),
        "activity": user.get("activity", ""),
        "trial_ends_at": user.get("trial_ends_at", ""),
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
