"""Modo mantenimiento: interruptor global del super admin (guardado en BD)."""
import time
from datetime import datetime, timezone

import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from database import db
from auth import require_admin, get_jwt_secret, JWT_ALGORITHM

admin_maint = APIRouter(prefix="/api/admin/maintenance", tags=["maintenance-admin"])
public_maint = APIRouter(prefix="/api/maintenance", tags=["maintenance"])

ALLOWED_PREFIXES = ("/api/maintenance", "/api/auth/", "/api/admin/", "/api/stripe/webhook",
                    "/api/powens/webhook", "/api/cron/", "/api/health")
_cache = {"t": 0.0, "doc": None}


class MaintenanceInput(BaseModel):
    enabled: bool
    message: str = ""
    until: str = ""


async def get_state(fresh: bool = False) -> dict:
    if fresh or time.time() - _cache["t"] > 5:
        doc = await db.app_settings.find_one({"key": "maintenance"}, {"_id": 0}) or {}
        _cache.update(t=time.time(), doc={"enabled": bool(doc.get("enabled")), "message": doc.get("message", ""),
                                          "until": doc.get("until", ""), "updated_at": doc.get("updated_at", "")})
    return _cache["doc"]


@public_maint.get("")
async def maintenance_status():
    s = await get_state()
    return {"enabled": s["enabled"], "message": s["message"], "until": s["until"]}


@admin_maint.get("")
async def admin_get(_=Depends(require_admin)):
    return await get_state(fresh=True)


@admin_maint.put("")
async def admin_set(data: MaintenanceInput, _=Depends(require_admin)):
    doc = {"key": "maintenance", "enabled": data.enabled, "message": data.message.strip()[:500],
           "until": data.until.strip()[:40], "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.app_settings.update_one({"key": "maintenance"}, {"$set": doc}, upsert=True)
    return await get_state(fresh=True)


async def _is_admin(request: Request) -> bool:
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        token = h[7:] if h.startswith("Bearer ") else None
    if not token:
        return False
    try:
        p = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if p.get("type") != "access" or p.get("imp"):
            return False
        u = await db.users.find_one({"_id": ObjectId(p["sub"])}, {"role": 1})
        return bool(u and u.get("role") == "admin")
    except Exception:
        return False


async def maintenance_middleware(request: Request, call_next):
    path = request.url.path
    blocked = path.startswith("/api/auth/register") or not path.startswith(ALLOWED_PREFIXES)
    if (path.startswith("/api/") and request.method != "OPTIONS" and blocked
            and (await get_state())["enabled"] and not await _is_admin(request)):
        return JSONResponse({"detail": "Estamos en mantenimiento. Volvemos pronto.", "maintenance": True}, status_code=503)
    return await call_next(request)
