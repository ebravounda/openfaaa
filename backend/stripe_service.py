import os
import stripe

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"

CURRENCY = "eur"
TAX_CODE = "txcd_10103001"  # SaaS
# Only paid plans are purchasable
PLAN_LOOKUP = {"medio": "plan_medio_monthly", "platino": "plan_platino_monthly"}
LOOKUP_PLAN = {v: k for k, v in PLAN_LOOKUP.items()}


def _account_country() -> str:
    try:
        return stripe.Account.retrieve().get("country", "ES")
    except Exception:
        return "ES"


def ensure_tax_settings():
    try:
        s = stripe.tax.Settings.retrieve()
        if s.get("head_office") and getattr(s.head_office, "address", None):
            return
        stripe.tax.Settings.modify(
            head_office={"address": {"country": _account_country(), "line1": "Calle Mayor 1",
                                     "city": "Madrid", "postal_code": "28001"}},
            defaults={"tax_behavior": "exclusive"},
        )
    except Exception:
        pass


def _get_or_create_product(pid: str, name: str):
    for p in stripe.Product.list(active=True, limit=100).auto_paging_iter():
        if p.get("metadata", {}).get("emergent_product_id") == pid:
            if p.name != name:
                try:
                    stripe.Product.modify(p.id, name=name)
                except Exception:
                    pass
            return p
    return stripe.Product.create(name=name, tax_code=TAX_CODE,
                                 metadata={"managed_by": "emergent", "emergent_product_id": pid})


def sync_catalog(plans: dict):
    """Create/update Stripe recurring Prices to match current DB plan prices."""
    for plan_id, lookup in PLAN_LOOKUP.items():
        p = plans.get(plan_id)
        if not p:
            continue
        amount = int(round(float(p.get("price", 0) or 0) * 100))
        if amount <= 0:
            continue
        prod = _get_or_create_product(f"plan_{plan_id}", p.get("name") or plan_id)
        existing = stripe.Price.list(lookup_keys=[lookup], active=True, limit=1).data
        if existing and (existing[0].unit_amount != amount or existing[0].currency != CURRENCY):
            try:
                stripe.Price.modify(existing[0].id, active=False)
            except Exception:
                pass
            existing = []
        if not existing:
            stripe.Price.create(product=prod.id, unit_amount=amount, currency=CURRENCY,
                                lookup_key=lookup, transfer_lookup_key=True,
                                recurring={"interval": "month"})


def get_price_id(lookup: str):
    d = stripe.Price.list(lookup_keys=[lookup], active=True, limit=1).data
    return d[0].id if d else None


def _portal_config_id():
    for c in stripe.billing_portal.Configuration.list(limit=100).auto_paging_iter():
        if c.get("metadata", {}).get("managed_by") == "emergent":
            return c.id
    return None


def ensure_portal_configuration():
    products = []
    for lookup in PLAN_LOOKUP.values():
        pid = get_price_id(lookup)
        if pid:
            pr = stripe.Price.retrieve(pid)
            products.append({"product": pr.product, "prices": [pid]})
    features = {
        "customer_update": {"enabled": True, "allowed_updates": ["email", "address", "name"]},
        "invoice_history": {"enabled": True},
        "payment_method_update": {"enabled": True},
        "subscription_cancel": {"enabled": True, "mode": "at_period_end"},
    }
    if products:
        features["subscription_update"] = {
            "enabled": True, "default_allowed_updates": ["price"],
            "products": products, "proration_behavior": "create_prorations",
        }
    cid = _portal_config_id()
    if cid:
        return stripe.billing_portal.Configuration.modify(cid, features=features).id
    return stripe.billing_portal.Configuration.create(
        features=features, metadata={"managed_by": "emergent"},
        business_profile={"headline": "FiscalHub España"}).id


def create_portal_session(customer_id: str, return_url: str):
    cfg = ensure_portal_configuration()
    return stripe.billing_portal.Session.create(
        customer=customer_id, return_url=return_url, configuration=cfg)


def plan_from_subscription(sub_obj) -> str:
    try:
        items = sub_obj["items"]["data"]
        lookup = items[0]["price"].get("lookup_key")
        return LOOKUP_PLAN.get(lookup)
    except Exception:
        return None


def create_subscription_session(price_id: str, origin_url: str, metadata: dict):
    kwargs = dict(
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin_url}/payment/cancel",
        metadata=metadata,
        subscription_data={"metadata": metadata},
    )
    try:
        return stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
    except stripe.error.InvalidRequestError:
        try:
            return stripe.checkout.Session.create(**kwargs, automatic_tax={"enabled": True},
                                                  billing_address_collection="required")
        except stripe.error.InvalidRequestError:
            return stripe.checkout.Session.create(**kwargs)
