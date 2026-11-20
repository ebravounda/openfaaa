"""API REST pública v1 de OpenFactura: claves por empresa, registro de uso, límites por plan y webhooks."""
import asyncio
import hashlib
import hmac
import ipaddress
import json
import socket
import secrets
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from urllib.parse import urlparse

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from database import db
from auth import get_current_user, _public_user
from plans import plan_for_user

RATE_LIMITS = {"platino": 60, "multiempresas": 120}
EVENTS = ["invoice.created", "invoice.verifactu.accepted", "invoice.verifactu.rejected", "invoice.verifactu.error",
          "client.created", "expense.created"]
_rate_index_ready = False


def _now():
    return datetime.now(timezone.utc).isoformat()


def _hash(k: str) -> str:
    return hashlib.sha256(k.encode()).hexdigest()


async def api_access(user: dict) -> dict:
    """Plan que permite la API (Platino o Multiempresas) y su límite por minuto."""
    if user.get("role") in ("admin", "gestoria"):
        return {"allowed": True, "rate": 120, "plan": "multiempresas"}
    plan = await plan_for_user(user)
    pid = str(plan.get("id") or "")
    base = "multiempresas" if pid.startswith("multiempresas") else pid
    return {"allowed": base in RATE_LIMITS, "rate": RATE_LIMITS.get(base, 0), "plan": plan.get("name", pid)}


async def require_api_plan(user=Depends(get_current_user)) -> dict:
    if not (await api_access(user))["allowed"]:
        raise HTTPException(status_code=403, detail="La API est\u00e1 disponible en los planes Platino y Multiempresas.")
    return user


# ---------- Webhooks ----------
async def _check_webhook_url(url: str):
    p = urlparse(url)
    if p.scheme != "https" or not p.hostname or p.username or p.password:
        raise ValueError("La URL del webhook debe empezar por https:// y no llevar usuario/contrase\u00f1a")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(p.hostname, p.port or 443, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError):
        raise ValueError("No se encuentra el dominio de la URL del webhook")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global or ip.is_multicast:
            raise ValueError("La URL del webhook debe ser una direcci\u00f3n p\u00fablica de internet (no se permiten direcciones internas)")


async def _deliver(hook: dict, event: str, data: dict):
    body = json.dumps({"id": str(uuid.uuid4()), "event": event, "created_at": _now(), "data": data},
                      ensure_ascii=False, default=str).encode()
    sig = hmac.new(hook["secret"].encode(), body, hashlib.sha256).hexdigest()
    status, err = 0, ""
    try:
        await _check_webhook_url(hook["url"])
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as c:
            r = await c.post(hook["url"], content=body, headers={
                "Content-Type": "application/json", "User-Agent": "OpenFactura-Webhooks/1.0",
                "X-OpenFactura-Event": event, "X-OpenFactura-Signature": f"sha256={sig}"})
            status = r.status_code
    except ValueError as e:
        err = str(e)
    except Exception as e:
        err = type(e).__name__
    await db.api_webhook_deliveries.insert_one({
        "id": str(uuid.uuid4()), "webhook_id": hook["id"], "user_id": hook["user_id"], "company_id": hook["company_id"],
        "event": event, "status": status, "error": err, "ok": 200 <= status < 300, "at": _now()})


async def emit(user_id: str, company_id: str, event: str, data: dict):
    hooks = await db.api_webhooks.find({"user_id": user_id, "company_id": company_id, "active": True,
                                        "events": event}, {"_id": 0}).to_list(20)
    for h in hooks:
        asyncio.create_task(_deliver(h, event, data))


# ---------- Panel del propietario (sesión normal) ----------
dev = APIRouter(prefix="/api/developer", tags=["developer"])


class KeyInput(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    company_id: str
    scope: str = "write"  # "read" o "write"


class HookInput(BaseModel):
    url: str = Field(min_length=10, max_length=500)
    company_id: str
    events: List[str] = Field(default_factory=lambda: list(EVENTS))


async def _own_company(user: dict, cid: str) -> dict:
    import server
    comps = await server._list_companies(user)
    c = next((c for c in comps if c.get("id") == cid), None)
    if not c and user.get("role") == "gestoria":
        for cu in await _gestoria_clients(user):
            c = next((x for x in await server._list_companies(cu) if x.get("id") == cid), None)
            if c:
                c = {**c, "_data_user_id": cu["id"]}
                break
    if not c:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return c


async def _gestoria_clients(user: dict) -> list:
    return [_public_user(u) async for u in db.users.find({"gestoria_id": user["id"]}).limit(1000)]


@dev.get("/companies")
async def dev_companies(user=Depends(get_current_user)):
    import server
    out = [{"id": c["id"], "name": c.get("name") or c.get("nif") or "Mi empresa"} for c in await server._list_companies(user)]
    if user.get("role") == "gestoria":
        for cu in await _gestoria_clients(user):
            for c in await server._list_companies(cu):
                out.append({"id": c["id"], "name": f"{c.get('name') or c.get('nif') or cu.get('email')} (cliente)"})
    return out


@dev.get("/status")
async def dev_status(user=Depends(get_current_user)):
    acc = await api_access(user)
    since = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    q = {"user_id": user["id"]}
    return {**acc, "keys": await db.api_keys.count_documents({**q, "revoked": False}),
            "requests_24h": await db.api_logs.count_documents({**q, "at": {"$gte": since}}),
            "errors_24h": await db.api_logs.count_documents({**q, "at": {"$gte": since}, "status": {"$gte": 400}}),
            "webhooks": await db.api_webhooks.count_documents({**q, "active": True}),
            "last_request": (await db.api_logs.find_one(q, {"_id": 0, "at": 1}, sort=[("at", -1)]) or {}).get("at"),
            "events": EVENTS}


@dev.get("/keys")
async def list_keys(user=Depends(require_api_plan)):
    return await db.api_keys.find({"user_id": user["id"]}, {"_id": 0, "key_hash": 0}).sort("created_at", -1).to_list(200)


@dev.post("/keys")
async def create_key(data: KeyInput, user=Depends(require_api_plan)):
    comp = await _own_company(user, data.company_id)
    raw = "of_live_" + secrets.token_urlsafe(32)
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "company_id": comp["id"], "company_name": comp.get("name", ""),
           "data_user_id": comp.get("_data_user_id") or user["id"],
           "name": data.name.strip(), "scope": "read" if data.scope == "read" else "write", "prefix": raw[:14],
           "key_hash": _hash(raw), "revoked": False, "created_at": _now(), "last_used_at": None}
    await db.api_keys.insert_one(doc)
    doc.pop("_id", None)
    doc.pop("key_hash", None)
    return {**doc, "key": raw}


@dev.delete("/keys/{key_id}")
async def revoke_key(key_id: str, user=Depends(get_current_user)):
    r = await db.api_keys.update_one({"id": key_id, "user_id": user["id"]}, {"$set": {"revoked": True, "revoked_at": _now()}})
    if not r.matched_count:
        raise HTTPException(status_code=404, detail="Clave no encontrada")
    return {"ok": True}


@dev.get("/logs")
async def list_logs(limit: int = 100, key_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if key_id:
        q["key_id"] = key_id
    return await db.api_logs.find(q, {"_id": 0}).sort("at", -1).to_list(min(max(limit, 1), 500))


@dev.get("/webhooks")
async def list_hooks(user=Depends(require_api_plan)):
    hooks = await db.api_webhooks.find({"user_id": user["id"], "deleted": {"$ne": True}}, {"_id": 0}).sort("created_at", -1).to_list(50)
    deliveries = await db.api_webhook_deliveries.find({"user_id": user["id"]}, {"_id": 0}).sort("at", -1).to_list(50)
    return {"webhooks": hooks, "deliveries": deliveries}


@dev.post("/webhooks")
async def create_hook(data: HookInput, user=Depends(require_api_plan)):
    comp = await _own_company(user, data.company_id)
    try:
        await _check_webhook_url(data.url.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    events = [e for e in data.events if e in EVENTS] or list(EVENTS)
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "company_id": comp["id"], "company_name": comp.get("name", ""),
           "url": data.url.strip(), "events": events, "secret": "whsec_" + secrets.token_hex(24), "active": True, "created_at": _now()}
    await db.api_webhooks.insert_one(doc)
    doc.pop("_id", None)
    return doc


@dev.delete("/webhooks/{hook_id}")
async def delete_hook(hook_id: str, user=Depends(get_current_user)):
    await db.api_webhooks.update_one({"id": hook_id, "user_id": user["id"]},
                                     {"$set": {"active": False, "deleted": True, "deleted_at": _now()}})
    return {"ok": True}


@dev.post("/webhooks/{hook_id}/test")
async def test_hook(hook_id: str, user=Depends(require_api_plan)):
    h = await db.api_webhooks.find_one({"id": hook_id, "user_id": user["id"], "deleted": {"$ne": True}}, {"_id": 0})
    if not h:
        raise HTTPException(status_code=404, detail="Webhook no encontrado")
    await _deliver(h, "ping", {"message": "Prueba de webhook de OpenFactura"})
    return await db.api_webhook_deliveries.find_one({"webhook_id": hook_id}, {"_id": 0}, sort=[("at", -1)])


# ---------- API pública v1 (clave de API) ----------
v1 = APIRouter(prefix="/api/v1", tags=["OpenFactura API v1"])


async def api_ctx(request: Request) -> dict:
    h = request.headers.get("Authorization", "")
    raw = h[7:].strip() if h.startswith("Bearer ") else request.headers.get("X-API-Key", "").strip()
    if not raw.startswith("of_live_"):
        raise HTTPException(status_code=401, detail="Falta la clave de API (Authorization: Bearer of_live_...)")
    key = await db.api_keys.find_one({"key_hash": _hash(raw), "revoked": False}, {"_id": 0})
    if not key:
        raise HTTPException(status_code=401, detail="Clave de API no v\u00e1lida o revocada")
    request.state.api_key = key
    u = await db.users.find_one({"_id": ObjectId(key["user_id"])})
    if not u or u.get("is_blocked"):
        raise HTTPException(status_code=403, detail="Cuenta bloqueada")
    owner = _public_user(u)
    acc = await api_access(owner)
    if not acc["allowed"]:
        raise HTTPException(status_code=403, detail="Tu plan ya no incluye la API. Cambia a Platino o Multiempresas.")
    global _rate_index_ready
    if not _rate_index_ready:
        await db.api_rate.create_index("exp", expireAfterSeconds=0)
        _rate_index_ready = True
    now = time.time()
    minute = int(now // 60)
    hit = await db.api_rate.find_one_and_update(
        {"_id": f"{key['id']}:{minute}"},
        {"$inc": {"n": 1}, "$setOnInsert": {"exp": datetime.now(timezone.utc) + timedelta(minutes=2)}},
        upsert=True, return_document=ReturnDocument.AFTER)
    if hit["n"] > acc["rate"]:
        raise HTTPException(status_code=429, detail=f"L\u00edmite de {acc['rate']} peticiones por minuto superado",
                            headers={"Retry-After": str(60 - int(now % 60))})
    if request.method != "GET" and key.get("scope") == "read":
        raise HTTPException(status_code=403, detail="Esta clave es de solo lectura")
    await _own_company(owner, key["company_id"])
    du = key.get("data_user_id") or key["user_id"]
    user = owner if du == key["user_id"] else _public_user(await db.users.find_one({"_id": ObjectId(du)}) or {})
    if not user.get("id"):
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    user["active_company_id"] = key["company_id"]
    user["_api_key"] = key
    await db.api_keys.update_one({"id": key["id"]}, {"$set": {"last_used_at": _now()}})
    return user


async def api_log_middleware(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/v1/") or path.startswith(("/api/v1/docs", "/api/v1/openapi.json")):
        return await call_next(request)
    t0 = time.time()
    try:
        resp = await call_next(request)
        status = resp.status_code
    except Exception:
        status = 500
        resp = JSONResponse({"detail": "Error interno"}, status_code=500)
    key = getattr(request.state, "api_key", None)
    if key:
        await db.api_logs.insert_one({
            "id": str(uuid.uuid4()), "user_id": key["user_id"], "company_id": key["company_id"], "key_id": key["id"],
            "key_name": key.get("name", ""), "method": request.method, "path": path, "status": status,
            "ms": int((time.time() - t0) * 1000), "ip": request.headers.get("cf-connecting-ip") or
            (request.client.host if request.client else ""), "at": _now()})
    resp.headers["X-OpenFactura-Api-Version"] = "1"
    return resp


def setup(app, s):
    async def _same_company(invoice_id: str, user: dict):
        inv = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0, "company_id": 1})
        if not inv or (inv.get("company_id") or "") != user["active_company_id"]:
            raise HTTPException(status_code=404, detail="Factura no encontrada")

    def _owner(user):
        return user["_api_key"]["user_id"]
    """Registra las rutas v1 reutilizando la l\u00f3gica interna del m\u00f3dulo server (s)."""

    @v1.get("/me", summary="Cuenta y empresa de la clave")
    async def me(user=Depends(api_ctx)):
        comp = await s.active_company(user)
        return {"company": {"id": comp["id"], "name": comp.get("name"), "nif": comp.get("nif")},
                "plan": (await api_access(user))["plan"], "scope": user["_api_key"]["scope"]}

    @v1.get("/clients", summary="Listar clientes")
    async def clients(user=Depends(api_ctx)):
        return await s.list_contacts(kind="client", user=user)

    @v1.post("/clients", status_code=201, summary="Crear cliente")
    async def client_create(data: s.ContactInput, user=Depends(api_ctx)):
        data.kind = "client"
        doc = await s.create_contact(data, user=user)
        await emit(_owner(user), user["active_company_id"], "client.created", doc)
        return doc

    @v1.get("/invoices", summary="Listar facturas")
    async def invoices(user=Depends(api_ctx)):
        return await s.list_invoices(user=user)

    @v1.post("/invoices", status_code=201, summary="Emitir factura")
    async def invoice_create(data: s.InvoiceInput, user=Depends(api_ctx)):
        doc = await s.create_invoice(data, user=user)
        await emit(_owner(user), user["active_company_id"], "invoice.created", doc)
        return doc

    @v1.get("/invoices/{invoice_id}", summary="Ver factura")
    async def invoice_get(invoice_id: str, user=Depends(api_ctx)):
        await _same_company(invoice_id, user)
        return await s.get_invoice(invoice_id, user=user)

    @v1.get("/invoices/{invoice_id}/pdf", summary="Descargar PDF de la factura")
    async def invoice_pdf(invoice_id: str, user=Depends(api_ctx)):
        await _same_company(invoice_id, user)
        return await s.invoice_pdf(invoice_id, user=user)

    @v1.post("/invoices/{invoice_id}/verifactu", summary="Enviar factura a VeriFactu (AEAT)")
    async def invoice_vf(invoice_id: str, user=Depends(api_ctx)):
        await _same_company(invoice_id, user)
        try:
            res = await s.verifactu_submit(invoice_id, user=user)
        except HTTPException as e:
            await emit(_owner(user), user["active_company_id"], "invoice.verifactu.error",
                       {"invoice_id": invoice_id, "detail": e.detail})
            raise
        ok = bool((res or {}).get("csv")) and not (res or {}).get("error")
        ev = "invoice.verifactu.accepted" if ok else "invoice.verifactu.rejected"
        await emit(_owner(user), user["active_company_id"], ev, {"invoice_id": invoice_id, "result": res})
        return res

    @v1.get("/expenses", summary="Listar gastos")
    async def expenses(user=Depends(api_ctx)):
        return await s.list_expenses(user=user)

    @v1.post("/expenses", status_code=201, summary="Registrar gasto")
    async def expense_create(data: s.ExpenseInput, user=Depends(api_ctx)):
        doc = await s.create_expense(data, user=user)
        await emit(_owner(user), user["active_company_id"], "expense.created", doc)
        return doc

    app.include_router(dev)
    app.include_router(v1)

    @app.get("/api/v1/openapi.json", include_in_schema=False)
    async def v1_openapi():
        spec = get_openapi(title="OpenFactura API", version="1.0.0", routes=v1.routes,
                           description="API REST de OpenFactura. Autenticaci\u00f3n: `Authorization: Bearer of_live_...`. "
                                       "Cada clave pertenece a una empresa. Webhooks firmados con HMAC-SHA256 en "
                                       "`X-OpenFactura-Signature`.")
        spec["components"] = {**spec.get("components", {}),
                              "securitySchemes": {"ApiKey": {"type": "http", "scheme": "bearer"}}}
        spec["security"] = [{"ApiKey": []}]
        spec["servers"] = [{"url": "https://openfactura.es"}]
        return spec

    @app.get("/api/v1/docs", include_in_schema=False)
    async def v1_docs():
        return get_swagger_ui_html(openapi_url="/api/v1/openapi.json", title="OpenFactura API \u00b7 Documentaci\u00f3n")
