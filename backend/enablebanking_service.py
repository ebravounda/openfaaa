"""Enable Banking (PSD2 AIS) — servicio de conexión bancaria.
Autenticación JWT RS256 con la clave privada de la aplicación."""
import os
import time
from datetime import datetime, timezone, timedelta

import jwt
import httpx

BASE = "https://api.enablebanking.com"
APP_ID = os.environ.get("ENABLEBANKING_APP_ID")
KEY_PATH = os.environ.get("ENABLEBANKING_KEY_PATH")

_cache = {"tok": None, "exp": 0}


def configured() -> bool:
    return bool(APP_ID and KEY_PATH and os.path.exists(KEY_PATH or ""))


def _jwt() -> str:
    now = int(time.time())
    if _cache["tok"] and _cache["exp"] - 120 > now:
        return _cache["tok"]
    with open(KEY_PATH) as f:
        key = f.read()
    tok = jwt.encode(
        {"iss": "enablebanking.com", "aud": "api.enablebanking.com", "iat": now, "exp": now + 3600},
        key, algorithm="RS256", headers={"kid": APP_ID},
    )
    _cache["tok"] = tok
    _cache["exp"] = now + 3600
    return tok


def _headers():
    return {"Authorization": f"Bearer {_jwt()}", "Content-Type": "application/json"}


async def _get(path, params=None):
    async with httpx.AsyncClient(timeout=45) as c:
        r = await c.get(BASE + path, headers=_headers(), params=params)
        r.raise_for_status()
        return r.json()


async def _post(path, body):
    async with httpx.AsyncClient(timeout=45) as c:
        r = await c.post(BASE + path, headers=_headers(), json=body)
        r.raise_for_status()
        return r.json()


async def list_aspsps(country: str = "ES"):
    d = await _get("/aspsps", {"country": country})
    return d.get("aspsps", [])


async def start_auth(aspsp_name: str, country: str, redirect_url: str, state: str, psu_type: str = "personal"):
    valid_until = (datetime.now(timezone.utc) + timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    body = {
        "access": {"valid_until": valid_until},
        "aspsp": {"name": aspsp_name, "country": country},
        "state": state,
        "redirect_url": redirect_url,
        "psu_type": psu_type,
    }
    return await _post("/auth", body)


async def create_session(code: str):
    return await _post("/sessions", {"code": code})


async def get_account_details(account_uid: str):
    return await _get(f"/accounts/{account_uid}/details")


async def get_balances(account_uid: str):
    d = await _get(f"/accounts/{account_uid}/balances")
    return d.get("balances", [])


async def get_transactions(account_uid: str, date_from: str):
    params = {"date_from": date_from}
    out, cont = [], None
    for _ in range(15):
        if cont:
            params["continuation_key"] = cont
        d = await _get(f"/accounts/{account_uid}/transactions", params)
        out.extend(d.get("transactions", []))
        cont = d.get("continuation_key")
        if not cont:
            break
    return out
