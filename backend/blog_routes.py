"""Blog SEO: conexión a un motor de contenidos externo (configuración en BD) y proxy público."""
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs

import httpx
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel

from database import db
from auth import require_admin

admin_blog = APIRouter(prefix="/api/admin/blog", tags=["blog-admin"])
blog = APIRouter(prefix="/api", tags=["blog"])

TIMEOUT = 15
CACHE_TTL = 120
_cache: dict = {}


class ConnectInput(BaseModel):
    url: str


class TrackInput(BaseModel):
    type: str
    article_id: str = ""


class LeadInput(BaseModel):
    email: str
    name: str = ""
    message: str = ""
    article_id: str = ""


def _mask(k: str) -> str:
    return f"{k[:4]}••••••{k[-4:]}" if len(k) > 10 else "••••••"


async def _probe(url: str) -> dict:
    url = (url or "").strip()
    p = urlparse(url)
    if p.scheme not in ("https", "http") or not p.netloc or "/connect" not in p.path:
        raise HTTPException(status_code=400, detail="El enlace debe tener el formato https://.../api/public/{id}/connect?key={clave}")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.get(url)
        data = r.json()
    except (httpx.HTTPError, ValueError) as e:
        raise HTTPException(status_code=502, detail=f"No se pudo conectar con el motor de contenidos ({type(e).__name__}).")
    if not isinstance(data, dict) or data.get("ok") is not True:
        msg = (data.get("error") or data.get("detail") or "") if isinstance(data, dict) else ""
        raise HTTPException(status_code=400, detail=f"El motor ha rechazado la conexión (HTTP {r.status_code}){': ' + str(msg) if msg else ''}.")
    api_base = (data.get("api_base") or url.split("/connect")[0]).rstrip("/")
    key = data.get("key") or (parse_qs(p.query).get("key") or [""])[0]
    if not key:
        raise HTTPException(status_code=400, detail="El enlace no contiene la clave (key).")
    return {"api_base": api_base, "key": key, "brand": data.get("brand", ""), "published": data.get("published", 0)}


async def _settings():
    s = await db.blog_settings.find_one({"enabled": True}, {"_id": 0})
    return s if s and s.get("api_base") and s.get("key") else None


def _public(s):
    if not s:
        return {"connected": False}
    return {"connected": True, "api_base": s["api_base"], "key_masked": _mask(s["key"]), "brand": s.get("brand", ""),
            "published": s.get("published", 0), "updated_at": s.get("updated_at", "")}


@admin_blog.get("")
async def get_blog_settings(_=Depends(require_admin)):
    return _public(await _settings())


@admin_blog.post("/test")
async def test_blog(data: ConnectInput, _=Depends(require_admin)):
    info = await _probe(data.url)
    return {"ok": True, "brand": info["brand"], "published": info["published"]}


@admin_blog.post("")
async def save_blog(data: ConnectInput, _=Depends(require_admin)):
    info = await _probe(data.url)
    doc = {**info, "enabled": True, "updated_at": datetime.now(timezone.utc).isoformat()}
    await db.blog_settings.delete_many({})
    await db.blog_settings.insert_one(dict(doc))
    _cache.clear()
    return _public(doc)


@admin_blog.delete("")
async def delete_blog(_=Depends(require_admin)):
    await db.blog_settings.delete_many({})
    _cache.clear()
    return {"connected": False}


async def _get(path: str, params: dict | None = None, cache: bool = True):
    s = await _settings()
    if not s:
        return None, None
    ck = (s["api_base"], path, tuple(sorted((params or {}).items())))
    hit = _cache.get(ck)
    if cache and hit and time.time() - hit[0] < CACHE_TTL:
        return hit[1], s
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.get(f"{s['api_base']}{path}", params=params)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="El motor de contenidos no responde.")
    if cache and r.status_code == 200:
        _cache[ck] = (time.time(), r)
    return r, s


@blog.get("/blog/articles")
async def list_articles():
    s = await _settings()
    if not s:
        return []
    r, _ = await _get("/articles", {"key": s["key"]})
    if r.status_code != 200:
        return []
    data = r.json()
    items = data.get("articles", data.get("items", [])) if isinstance(data, dict) else data
    return items if isinstance(items, list) else []


@blog.get("/blog/articles/{slug}")
async def get_article(slug: str):
    s = await _settings()
    if not s or not re.fullmatch(r"[A-Za-z0-9\-_]{1,200}", slug):
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    r, _ = await _get(f"/articles/{slug}", {"key": s["key"]})
    if r.status_code != 200:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    return r.json()


async def _post(path: str, body: dict):
    s = await _settings()
    if not s:
        raise HTTPException(status_code=404, detail="Blog no conectado")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.post(f"{s['api_base']}{path}", json={"key": s["key"], **body})
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="El motor de contenidos no responde.")
    try:
        return r.status_code, r.json()
    except ValueError:
        return r.status_code, {}


@blog.post("/blog/track")
async def track(data: TrackInput):
    _, res = await _post("/track", {"type": data.type[:60], "article_id": data.article_id[:120]})
    return {"ok": True}


@blog.post("/blog/lead")
async def lead(data: LeadInput):
    email = data.email.strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=400, detail="Introduce un email válido.")
    code, res = await _post("/lead", {"email": email[:200], "name": data.name.strip()[:200], "message": data.message.strip()[:5000],
                                      "article_id": data.article_id[:120]})
    if code >= 400:
        raise HTTPException(status_code=502, detail="No se ha podido enviar el mensaje. Inténtalo de nuevo.")
    return {"ok": True}


@blog.get("/blog-sitemap.xml")
async def blog_sitemap():
    s = await _settings()
    if not s:
        raise HTTPException(status_code=404, detail="Blog no conectado")
    r, _ = await _get("/sitemap.xml", {"key": s["key"]})
    if r.status_code != 200:
        raise HTTPException(status_code=404, detail="Sitemap no disponible")
    return Response(r.content, media_type="application/xml")


@blog.get("/blog/styles.css")
async def blog_styles():
    s = await _settings()
    if not s:
        return Response("", media_type="text/css")
    r, _ = await _get("/styles.css")
    return Response(r.content if r.status_code == 200 else b"", media_type="text/css", headers={"Cache-Control": "public, max-age=300"})
