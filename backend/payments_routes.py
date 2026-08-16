import os
import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from bson import ObjectId

from database import db
from auth import get_current_user
from plans import load_plans
import stripe_service as ss

logger = logging.getLogger("payments")
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

payments = APIRouter(prefix="/api")


class CheckoutReq(BaseModel):
    plan: str
    origin_url: str


class PortalReq(BaseModel):
    return_url: str


async def _upgrade_user(user_id: str, plan: str, session_obj):
    if not user_id or plan not in ss.PLAN_LOOKUP:
        return
    try:
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"plan": plan,
                      "stripe_subscription_id": session_obj.get("subscription"),
                      "stripe_customer_id": session_obj.get("customer"),
                      "plan_updated_at": datetime.now(timezone.utc).isoformat()}},
        )
    except Exception as e:
        logger.error(f"upgrade user failed: {e}")


@payments.post("/payments/checkout")
async def create_checkout(req: CheckoutReq, user=Depends(get_current_user)):
    if req.plan not in ss.PLAN_LOOKUP:
        raise HTTPException(status_code=400, detail="Este plan no requiere pago")
    plans = await load_plans()
    ss.ensure_tax_settings()
    ss.sync_catalog(plans)
    price_id = ss.get_price_id(ss.PLAN_LOOKUP[req.plan])
    if not price_id:
        raise HTTPException(status_code=500, detail="Precio no disponible en Stripe")
    meta = {"user_id": user["id"], "plan": req.plan}
    try:
        session = ss.create_subscription_session(price_id, req.origin_url, meta)
    except stripe.error.StripeError as e:
        logger.error(f"stripe checkout failed: {e}")
        raise HTTPException(status_code=502, detail="No pudimos iniciar el pago. Inténtalo de nuevo en unos minutos.")
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": user["id"], "plan": req.plan,
        "amount": None, "currency": ss.CURRENCY,
        "status": "initiated", "payment_status": "pending",
        "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc),
    })
    return {"checkout_url": session.url, "session_id": session.id}


@payments.post("/payments/portal")
async def customer_portal(req: PortalReq, user=Depends(get_current_user)):
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    cust = (u or {}).get("stripe_customer_id")
    if not cust:
        raise HTTPException(status_code=400, detail="No tienes una suscripción activa que gestionar")
    try:
        session = ss.create_portal_session(cust, req.return_url)
    except stripe.error.StripeError as e:
        logger.error(f"portal session failed: {e}")
        raise HTTPException(status_code=502, detail="No pudimos abrir el portal de suscripción. Inténtalo más tarde.")
    return {"portal_url": session.url}


@payments.get("/payments/history")
async def payment_history(user=Depends(get_current_user)):
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    cust = (u or {}).get("stripe_customer_id")
    if not cust:
        return []
    out = []
    try:
        invoices = stripe.Invoice.list(customer=cust, limit=24)
        for inv in invoices.auto_paging_iter():
            out.append({
                "id": inv.get("id"),
                "date": inv.get("created"),
                "amount": (inv.get("amount_paid") or inv.get("amount_due") or 0) / 100,
                "currency": (inv.get("currency") or "eur").upper(),
                "status": inv.get("status"),
                "description": (inv.get("lines", {}).get("data", [{}])[0] or {}).get("description", ""),
                "invoice_url": inv.get("hosted_invoice_url"),
                "pdf": inv.get("invoice_pdf"),
            })
    except stripe.error.StripeError as e:
        logger.error(f"history failed: {e}")
    return out


@payments.get("/payments/status/{session_id}")
async def get_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id})
    if not record:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                res = await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "updated_at": datetime.now(timezone.utc)}},
                )
                if res.modified_count:
                    await _upgrade_user(record.get("user_id"), record.get("plan"), s)
                record = await db.payment_transactions.find_one({"session_id": session_id})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"],
            "payment_status": record["payment_status"], "plan": record.get("plan")}


@payments.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(status_code=400, detail="Firma inválida")
    obj, t = event["data"]["object"], event["type"]

    if t == "checkout.session.completed":
        res = await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"),
                      "updated_at": datetime.now(timezone.utc)}},
        )
        if res.modified_count:
            meta = obj.get("metadata") or {}
            await _upgrade_user(meta.get("user_id"), meta.get("plan"), obj)
    elif t == "customer.subscription.updated":
        plan = ss.plan_from_subscription(obj)
        if plan:
            await db.users.update_one(
                {"stripe_customer_id": obj.get("customer")},
                {"$set": {"plan": plan, "stripe_subscription_id": obj.get("id"),
                          "plan_updated_at": datetime.now(timezone.utc).isoformat()}})
    elif t == "customer.subscription.deleted":
        sub_id = obj.get("id")
        await db.users.update_one({"stripe_subscription_id": sub_id},
                                  {"$set": {"plan": "basico", "stripe_subscription_id": None,
                                            "plan_updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"status": "ok"}
