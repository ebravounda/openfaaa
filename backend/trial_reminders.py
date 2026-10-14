"""Recordatorios de fin de prueba (3 días y 1 día antes). Lo revisa el propio backend cada hora."""
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from html import escape

from database import db
from email_service import send_email

logger = logging.getLogger(__name__)
WINDOWS = (3, 1)


def _base_url() -> str:
    return (os.environ.get("APP_BASE_URL") or os.environ.get("PUBLIC_BASE_URL") or "https://openfactura.es").rstrip("/")


def _html(name: str, days: int, ends: datetime) -> str:
    url = f"{_base_url()}/precios"
    when = "mañana" if days == 1 else f"en {days} días"
    head = "¡Tu prueba termina mañana!" if days == 1 else f"Te quedan {days} días de prueba"
    return (
        '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0F172A">'
        '<div style="background:#0052FF;border-radius:14px 14px 0 0;padding:26px 28px;color:#ffffff">'
        '<div style="font-size:14px;opacity:.85">OpenFactura</div>'
        f'<div style="font-size:24px;font-weight:bold;margin-top:6px">{head}</div></div>'
        '<div style="border:1px solid #E2E8F0;border-top:0;border-radius:0 0 14px 14px;padding:26px 28px">'
        f'<p style="font-size:15px;margin:0 0 12px">Hola {escape(name or "")},</p>'
        f'<p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 12px">Esperamos que estés disfrutando de OpenFactura. '
        f'Tu prueba gratuita termina <b>{when}</b> (el {ends.strftime("%d/%m/%Y")}).</p>'
        '<p style="font-size:15px;line-height:1.6;color:#334155;margin:0 0 22px">Completa tu suscripción ahora y sigue facturando, '
        'con VeriFactu, presupuestos y todos tus datos tal y como los tienes, sin interrupciones. '
        'Puedes elegir pago mensual o anual (con 2 meses gratis).</p>'
        f'<p style="text-align:center;margin:0 0 22px"><a href="{url}" style="display:inline-block;background:#0052FF;color:#ffffff;'
        'text-decoration:none;font-weight:bold;font-size:15px;padding:13px 28px;border-radius:999px">Completa tu suscripción</a></p>'
        '<p style="font-size:13px;color:#64748B;line-height:1.5;margin:0">¿Tienes alguna duda? Responde a este email y te ayudamos encantados.</p>'
        '</div></div>'
    )


async def run_trial_reminders() -> int:
    now = datetime.now(timezone.utc)
    sent = 0
    for days in WINDOWS:
        lo, hi = (now + timedelta(days=days - 1)).isoformat(), (now + timedelta(days=days)).isoformat()
        flag = f"trial_reminder_{days}d_sent"
        q = {"plan": "basico", "role": "user", "trial_ends_at": {"$gt": lo, "$lte": hi}, flag: {"$exists": False},
             "stripe_subscription_id": {"$in": [None, ""]}, "email": {"$nin": [None, ""]}}
        async for u in db.users.find(q, {"_id": 1, "email": 1, "name": 1, "trial_ends_at": 1}):
            claim = await db.users.update_one({"_id": u["_id"], flag: {"$exists": False}}, {"$set": {flag: now.isoformat()}})
            if not claim.modified_count:
                continue
            try:
                ends = datetime.fromisoformat(u["trial_ends_at"])
                subj = "Tu prueba de OpenFactura termina mañana" if days == 1 else f"Te quedan {days} días de prueba en OpenFactura"
                await send_email(to=u["email"], subject=subj, html=_html(u.get("name", ""), days, ends))
                sent += 1
            except Exception as e:
                logger.error(f"Recordatorio de prueba ({days}d) a {u.get('email')} falló: {e}")
                await db.users.update_one({"_id": u["_id"]}, {"$unset": {flag: ""}})
    if sent:
        logger.info(f"Recordatorios de prueba enviados: {sent}")
    return sent


async def trial_reminder_loop():
    await asyncio.sleep(60)
    while True:
        try:
            await run_trial_reminders()
        except Exception as e:
            logger.error(f"trial_reminder_loop: {e}")
        await asyncio.sleep(3600)
