import os
import asyncio
import requests

from motor.motor_asyncio import AsyncIOMotorGridFSBucket
from database import db

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "fiscalhub"

# Self-hosted (Plesk, etc.): guarda los archivos en la propia base de datos MongoDB
# (GridFS) en lugar del Object Storage gestionado por Emergent (no accesible fuera del
# preview). Así la subida de gastos/OCR/logos funciona en cualquier servidor con su Mongo.
USE_DB_STORAGE = os.environ.get("USE_LOCAL_STORAGE", "").strip().lower() in ("1", "true", "yes", "on")

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
}

storage_key = None
_bucket = None


def _gridfs() -> AsyncIOMotorGridFSBucket:
    global _bucket
    if _bucket is None:
        _bucket = AsyncIOMotorGridFSBucket(db, bucket_name="uploads")
    return _bucket


def init_storage(force: bool = False):
    global storage_key
    if USE_DB_STORAGE:
        return "db"
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def _put_emergent(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def _get_emergent(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    if USE_DB_STORAGE:
        await _gridfs().upload_from_stream(path, data, metadata={"contentType": content_type})
        return {"path": path}
    return await asyncio.to_thread(_put_emergent, path, data, content_type)


async def get_object(path: str):
    if USE_DB_STORAGE:
        docs = await _gridfs().find({"filename": path}).sort("uploadDate", -1).to_list(1)
        if not docs:
            raise FileNotFoundError(path)
        stream = await _gridfs().open_download_stream(docs[0]["_id"])
        data = await stream.read()
        ct = (docs[0].get("metadata") or {}).get("contentType", "application/octet-stream")
        return data, ct
    return await asyncio.to_thread(_get_emergent, path)
