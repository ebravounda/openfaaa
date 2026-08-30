from dotenv import load_dotenv
from pathlib import Path
import os
import asyncio
load_dotenv(Path(__file__).parent / ".env")

import logging
import uuid
import base64
import re
import secrets
import hmac
from datetime import datetime, timezone, date, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query, Form, Request, BackgroundTasks, Body
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import db, client
from bson import ObjectId
from auth import router as auth_router, get_current_user, seed_admin
from security import SecurityMiddleware
from admin_routes import admin as admin_router
from plans import plan_for_user, plans_list
from templates import TEMPLATE_MAP
from pdf_service import build_invoice_pdf
from email_service import send_email, build_invoice_email_html, build_payment_email_html
import storage_service
from storage_service import put_object, get_object, MIME_TYPES, APP_NAME
from ocr_service import extract_expense
from export_service import build_libros_xlsx, build_libros_csv
import verifactu_service as vf
import spanish_tax
import ai_service
import cert_service

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    docs_url="/api/docs" if os.environ.get("EXPOSE_API_DOCS") == "true" else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if os.environ.get("EXPOSE_API_DOCS") == "true" else None,
)
api = APIRouter(prefix="/api")


# ---------- Models ----------
class LineItem(BaseModel):
    description: str
    detail: str = ""
    quantity: float = 1
    unit_price: float = 0.0
    discount: float = 0
    iva_rate: float = 21
    iva_type: str = "general"  # general | exento | no_sujeto | suplido


class Client(BaseModel):
    name: str
    nif: str = ""
    address: str = ""
    email: str = ""


class InvoiceInput(BaseModel):
    issue_date: str
    client: Client
    line_items: List[LineItem]
    iva_rate: float = 21
    irpf_rate: float = 0
    recargo_equivalencia: bool = False
    global_discount: float = 0
    status: str = "pending"
    notes: str = ""
    series: str = ""
    invoice_type: str = "normal"  # "normal" or "rectificativa"
    rectifies: str = ""
    rectifies_number: str = ""
    rectify_type: str = "I"  # "I" (por diferencias) o "S" (por sustitución)
    due_date: str = ""
    period: str = ""
    payment_method: str = ""
    iban: str = ""
    concept_label: str = ""


class ExpenseInput(BaseModel):
    date: str
    vendor_name: str
    vendor_nif: str = ""
    description: str = ""
    category: str = "General"
    base_amount: float = 0.0
    iva_rate: float = 21
    attachment_path: str = ""


class CompanyInput(BaseModel):
    name: str
    nif: str = ""
    address: str = ""
    email: str = ""
    phone: str = ""
    tax_type: str = "autonomo"
    invoice_prefix: str = ""
    rectify_prefix: str = "R"
    quote_prefix: str = "PRE"
    invoice_start_number: int = 1
    invoice_due_days: int = 15
    verifactu_enabled: bool = False
    verifactu_mode: str = "simulado"
    verifactu_cert_type: str = "personal"  # personal | sello
    template_id: str = "clasico"
    accent_color: str = ""
    logo: str = ""
    invoice_footer: str = ""
    legal_name: str = ""
    legal_notice: str = ""
    footer_message: str = ""
    autonomo_start_date: str = ""


class StatusInput(BaseModel):
    status: str


class AssistantInput(BaseModel):
    message: str
    session_id: str = ""


class ContactSalesInput(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    company: str = ""
    companies_needed: str = ""
    message: str = ""


class ReviewInput(BaseModel):
    client: dict = {}
    line_items: list = []
    iva_rate: float = 21
    irpf_rate: float = 0
    issue_date: str = ""


class ContactInput(BaseModel):
    name: str
    nif: str = ""
    address: str = ""
    email: str = ""
    phone: str = ""
    kind: str = "client"  # "client" or "provider"


class QuoteInput(BaseModel):
    issue_date: str
    valid_until: str = ""
    client: Client
    line_items: List[LineItem]
    irpf_rate: float = 0
    recargo_equivalencia: bool = False
    global_discount: float = 0
    status: str = "borrador"  # borrador | enviado | aceptado | rechazado | facturado
    notes: str = ""
    series: str = ""
    period: str = ""
    payment_method: str = ""
    iban: str = ""
    concept_label: str = ""


# ---------- Helpers ----------
# Recargo de equivalencia asociado a cada tipo de IVA (España)
RE_MAP = {21: 5.2, 10: 1.4, 4: 0.5, 0: 0.0}


def compute_invoice(inv: dict) -> dict:
    recargo = bool(inv.get("recargo_equivalencia"))
    fallback_rate = inv.get("iva_rate", 21)
    gd = float(inv.get("global_discount") or 0)
    breakdown = {}
    base_general = base_exenta = base_no_sujeta = suplidos = 0.0
    base_intracom = 0.0
    subtotal_gross = discount_total = 0.0
    for it in inv["line_items"]:
        qty = it.get("quantity") or 0
        price = it.get("unit_price") or 0
        gross = round(qty * price, 2)
        subtotal_gross += gross
        itype = it.get("iva_type", "general") or "general"
        if itype == "suplido":
            suplidos += gross  # los suplidos no llevan descuento
            continue
        ld = float(it.get("discount") or 0)
        lb = round(round(gross * (1 - ld / 100), 2) * (1 - gd / 100), 2)
        discount_total += round(gross - lb, 2)
        if itype == "no_sujeto":
            base_no_sujeta += lb
            continue
        if itype in ("exento", "intracomunitaria"):
            base_exenta += lb
            if itype == "intracomunitaria":
                base_intracom += lb
            continue
        rate = it.get("iva_rate")
        rate = float(fallback_rate if rate is None else rate)
        base_general += lb
        breakdown.setdefault(rate, {"base": 0.0})["base"] += lb

    iva_amount = re_amount = 0.0
    bd_list = []
    for rate in sorted(breakdown.keys(), reverse=True):
        b = round(breakdown[rate]["base"], 2)
        cuota = round(b * rate / 100, 2)
        re_rate = RE_MAP.get(int(rate), 0.0) if recargo else 0.0
        re_cuota = round(b * re_rate / 100, 2)
        iva_amount += cuota
        re_amount += re_cuota
        bd_list.append({"rate": rate, "base": b, "cuota": cuota,
                        "re_rate": re_rate, "re_cuota": re_cuota})

    iva_amount = round(iva_amount, 2)
    re_amount = round(re_amount, 2)
    base = round(base_general + base_exenta + base_no_sujeta, 2)
    irpf_base = round(base_general + base_exenta, 2)
    irpf_rate = inv.get("irpf_rate", 0) or 0
    irpf_amount = round(irpf_base * irpf_rate / 100, 2)
    total = round(base + suplidos + iva_amount + re_amount - irpf_amount, 2)

    inv["subtotal"] = round(subtotal_gross, 2)
    inv["discount_total"] = round(discount_total, 2)
    inv["global_discount"] = gd
    inv["base"] = base
    inv["base_exenta"] = round(base_exenta, 2)
    inv["base_intracom"] = round(base_intracom, 2)
    inv["base_no_sujeta"] = round(base_no_sujeta, 2)
    inv["suplidos_total"] = round(suplidos, 2)
    inv["iva_amount"] = iva_amount
    inv["re_amount"] = re_amount
    inv["irpf_base"] = irpf_base
    inv["irpf_amount"] = irpf_amount
    inv["total"] = total
    inv["iva_breakdown"] = bd_list
    inv["recargo_equivalencia"] = recargo
    inv["iva_rate"] = max(bd_list, key=lambda x: x["base"])["rate"] if bd_list else 0
    return inv


def _validate_invoice(data) -> None:
    errors = []
    cl = data.client
    if not (cl.name or "").strip():
        errors.append("El nombre del cliente es obligatorio.")
    if not (cl.nif or "").strip():
        errors.append("El NIF/CIF del cliente es obligatorio.")
    elif not spanish_tax.validate_nif(cl.nif):
        errors.append(f"El NIF/CIF '{cl.nif}' no es válido (revisa la letra de control).")
    if not data.line_items:
        errors.append("Añade al menos un concepto a la factura.")
    valid_types = {"general", "exento", "no_sujeto", "suplido", "intracomunitaria"}
    for i, it in enumerate(data.line_items, 1):
        if not (it.description or "").strip():
            errors.append(f"El concepto {i} necesita una descripción.")
        if it.quantity is None or it.quantity <= 0:
            errors.append(f"La cantidad del concepto {i} debe ser mayor que 0.")
        if it.unit_price is None:
            errors.append(f"El precio del concepto {i} no es válido.")
        itype = (getattr(it, "iva_type", "general") or "general")
        if itype not in valid_types:
            errors.append(f"El tipo fiscal del concepto {i} no es válido.")
        if itype == "general" and it.iva_rate not in (0, 4, 10, 21):
            errors.append(f"El IVA del concepto {i} debe ser 0, 4, 10 o 21%.")
    if data.irpf_rate < 0 or data.irpf_rate > 47:
        errors.append("El IRPF debe estar entre 0% y 47%.")
    if errors:
        raise HTTPException(status_code=422, detail=" ".join(errors))


def compute_expense(exp: dict) -> dict:
    base = round(exp["base_amount"], 2)
    iva_amount = round(base * exp["iva_rate"] / 100, 2)
    exp["base"] = base
    exp["iva_amount"] = iva_amount
    exp["total"] = round(base + iva_amount, 2)
    return exp


def quarter_of(d: str) -> int:
    m = int(d[5:7])
    return (m - 1) // 3 + 1


QUARTER_DEADLINES = {
    1: (4, 20),   # abril
    2: (7, 20),   # julio
    3: (10, 20),  # octubre
    4: (1, 30),   # enero siguiente año
}
QUARTER_LABELS = {1: "1T (Ene-Mar)", 2: "2T (Abr-Jun)", 3: "3T (Jul-Sep)", 4: "4T (Oct-Dic)"}


def deadline_date(year: int, q: int) -> date:
    m, d = QUARTER_DEADLINES[q]
    y = year + 1 if q == 4 else year
    return date(y, m, d)


# ---------- Plan gating & global template helpers ----------
def _month_prefix() -> str:
    now = datetime.now(timezone.utc)
    return f"{now.year:04d}-{now.month:02d}"


def _plan_denied(plan, feature):
    return HTTPException(status_code=403,
                         detail=f"Tu plan {plan['name']} no incluye esta función. Mejora tu plan para activarla.")


async def _merge_global_goroky(company: dict) -> dict:
    if TEMPLATE_MAP.get(company.get("template_id", ""), {}).get("layout") != "goroky":
        return company
    g = await db.global_settings.find_one({"_id": "goroky_texts"}) or {}
    c = dict(company)
    if not (c.get("legal_notice") or "").strip() and (g.get("legal_notice") or "").strip():
        c["legal_notice"] = g["legal_notice"]
    if not (c.get("footer_message") or "").strip() and (g.get("footer_message") or "").strip():
        c["footer_message"] = g["footer_message"]
    return c


@api.get("/plan")
async def my_plan(user=Depends(get_current_user)):
    plan = await plan_for_user(user)
    mp = _month_prefix()
    inv_month = await db.invoices.count_documents({"user_id": user["id"], "company_id": await active_cid(user), "issue_date": {"$regex": f"^{mp}"}})
    contacts = await db.contacts.count_documents({"user_id": user["id"], "company_id": await active_cid(user)})
    return {"plan": plan, "usage": {"invoices_month": inv_month, "contacts": contacts}}


@api.get("/plans")
async def list_public_plans(user=Depends(get_current_user)):
    return await plans_list()


@api.post("/contact-sales")
async def contact_sales(data: ContactSalesInput, user=Depends(get_current_user)):
    from html import escape as _esc
    name = _esc(data.name or user.get("name", ""))
    email = _esc(data.email or user.get("email", ""))
    body = (
        f"<h2>Solicitud de plan a medida (más empresas)</h2>"
        f"<p><b>Nombre:</b> {name}</p>"
        f"<p><b>Email:</b> {email}</p>"
        f"<p><b>Teléfono:</b> {_esc(data.phone)}</p>"
        f"<p><b>Empresa / Asesoría:</b> {_esc(data.company)}</p>"
        f"<p><b>Nº de empresas que necesita:</b> {_esc(data.companies_needed)}</p>"
        f"<p><b>Mensaje:</b><br>{_esc(data.message)}</p>"
        f"<hr><p style='font-size:12px;color:#888'>Enviado desde OpenFactura · usuario {_esc(user.get('email',''))}</p>"
    )
    try:
        await send_email(to="soporte@goroky.com",
                         subject=f"[OpenFactura] Solicitud de más empresas — {name or email}",
                         html=body, reply_to=data.email or user.get("email"))
    except Exception as e:
        logger.error(f"contact-sales email failed: {e}")
        raise HTTPException(status_code=400, detail="No se pudo enviar la solicitud. Escríbenos a soporte@goroky.com.")
    return {"status": "sent"}


@api.get("/global-templates/goroky")
async def public_global_goroky(user=Depends(get_current_user)):
    from templates import GOROKY_DEFAULT_LEGAL, GOROKY_DEFAULT_FOOTER
    g = await db.global_settings.find_one({"_id": "goroky_texts"}) or {}
    return {
        "legal_notice": g.get("legal_notice") or GOROKY_DEFAULT_LEGAL,
        "footer_message": g.get("footer_message") or GOROKY_DEFAULT_FOOTER,
    }


# ---------- Multiempresa: empresas del usuario ----------
async def _list_companies(user: dict) -> list:
    comps = await db.companies.find({"user_id": user["id"]}).to_list(200)
    for c in comps:
        if not c.get("id"):
            cid = str(uuid.uuid4())
            await db.companies.update_one({"_id": c["_id"]}, {"$set": {"id": cid}})
            c["id"] = cid
    if not comps:
        cid = str(uuid.uuid4())
        doc = {"id": cid, "user_id": user["id"], "name": "",
               "tax_type": user.get("tax_type", "autonomo"),
               "created_at": datetime.now(timezone.utc).isoformat()}
        await db.companies.insert_one(doc)
        comps = [doc]
    for c in comps:
        c.pop("_id", None)
    # Salvaguarda: adjunta cualquier dato heredado SIN company_id a la primera empresa.
    # Evita que facturas/datos antiguos "desaparezcan" al activar multiempresa. Se ejecuta una sola vez.
    if not user.get("legacy_company_migrated"):
        primary = comps[0]["id"]
        for name in ("invoices", "expenses", "contacts", "quotes", "certificates",
                     "verifactu_log", "files", "payment_transactions"):
            await db[name].update_many(
                {"user_id": user["id"], "company_id": {"$exists": False}},
                {"$set": {"company_id": primary}})
        await db.users.update_one({"_id": ObjectId(user["id"])},
                                  {"$set": {"legacy_company_migrated": True}})
        user["legacy_company_migrated"] = True
    return comps


async def active_company(user: dict) -> dict:
    comps = await _list_companies(user)
    aid = user.get("active_company_id")
    return next((c for c in comps if c.get("id") == aid), comps[0])


async def active_cid(user: dict) -> str:
    return (await active_company(user))["id"]


# ---------- Company ----------
@api.get("/company")
async def get_company(user=Depends(get_current_user)):
    doc = await active_company(user)
    doc.setdefault("template_id", user.get("activity") or "clasico")
    return doc


@api.put("/company")
async def upsert_company(data: CompanyInput, user=Depends(get_current_user)):
    comp = await active_company(user)
    cid = comp["id"]
    doc = data.model_dump()
    doc["user_id"] = user["id"]
    doc["id"] = cid
    if not doc.get("logo") and comp.get("logo"):
        doc["logo"] = comp["logo"]
    await db.companies.update_one({"id": cid, "user_id": user["id"]}, {"$set": doc})
    return doc


@api.post("/company/logo")
async def upload_company_logo(file: UploadFile = File(...), user=Depends(get_current_user)):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="El logo no puede superar 2 MB")
    ct = (file.content_type or "").lower()
    if not ct.startswith("image/"):
        raise HTTPException(status_code=400, detail="El logo debe ser una imagen (PNG o JPG)")
    from io import BytesIO as _BIO
    from PIL import Image as _PILImage
    try:
        im = _PILImage.open(_BIO(data))
        im.thumbnail((700, 700))
        im = im.convert("RGBA")
        out = _BIO()
        im.save(out, format="PNG")
        png = out.getvalue()
    except Exception:
        raise HTTPException(status_code=400, detail="No se pudo procesar la imagen. Usa PNG o JPG.")
    data_url = "data:image/png;base64," + base64.b64encode(png).decode()
    await db.companies.update_one({"id": await active_cid(user), "user_id": user["id"]}, {"$set": {"logo": data_url}})
    return {"logo": data_url}


@api.delete("/company/logo")
async def delete_company_logo(user=Depends(get_current_user)):
    await db.companies.update_one({"id": await active_cid(user), "user_id": user["id"]}, {"$set": {"logo": ""}})
    return {"status": "ok"}


@api.post("/company/preview-pdf")
async def preview_company_pdf(overrides: dict = Body(default={}), user=Depends(get_current_user)):
    """Genera una miniatura PNG del PDF real con los ajustes de aspecto indicados (sin guardar)."""
    company = await active_company(user)
    for k in ("template_id", "accent_color", "logo", "name", "legal_name", "nif", "address",
              "email", "phone", "invoice_footer", "legal_notice", "footer_message"):
        if overrides.get(k) is not None:
            company[k] = overrides[k]
    year = datetime.now(timezone.utc).year
    pfx = company.get("invoice_prefix") or ""
    sample = compute_invoice({
        "number": f"{pfx + '-' if pfx else ''}{year}-0001",
        "issue_date": datetime.now(timezone.utc).date().isoformat(),
        "due_date": "", "status": "pending",
        "client": {"name": "Cliente de ejemplo S.L.", "nif": "B12345674",
                   "address": "Calle Ejemplo 1, 28001 Madrid"},
        "line_items": [
            {"description": "Servicio de ejemplo", "detail": "Descripción detallada del concepto",
             "quantity": 2, "unit_price": 150, "discount": 10, "iva_rate": 21, "iva_type": "general"},
            {"description": "Producto a tipo reducido", "quantity": 1, "unit_price": 80,
             "iva_rate": 10, "iva_type": "general"},
        ],
        "irpf_rate": 15, "recargo_equivalencia": False, "global_discount": 0,
        "notes": "Factura de muestra para la vista previa.",
    })
    pdf = build_invoice_pdf(sample, company)
    import pymupdf
    pdoc = pymupdf.open(stream=pdf, filetype="pdf")
    png = pdoc.load_page(0).get_pixmap(dpi=110).tobytes("png")
    pdoc.close()
    return Response(content=png, media_type="image/png",
                    headers={"Cache-Control": "no-store"})


@api.get("/templates")
async def list_templates(user=Depends(get_current_user)):
    from templates import TEMPLATES
    return TEMPLATES


# ---------- Multiempresa: gestión de empresas ----------
class CompanySwitchInput(BaseModel):
    company_id: str


class MultiToggleInput(BaseModel):
    enabled: bool


@api.get("/companies")
async def list_companies_ep(user=Depends(get_current_user)):
    comps = await _list_companies(user)
    for c in comps:
        c["invoice_count"] = await db.invoices.count_documents(
            {"user_id": user["id"], "company_id": c["id"]})
    return comps


@api.post("/companies")
async def create_company_ep(data: CompanyInput, user=Depends(get_current_user)):
    plan = await plan_for_user(user)
    if not plan["features"].get("multi_company") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Tu plan no permite gestionar varias empresas. Cambia al plan Multiempresas.")
    comps = await _list_companies(user)
    maxc = plan.get("max_companies")
    if maxc is not None and len(comps) >= maxc:
        raise HTTPException(status_code=403, detail=f"Has alcanzado el máximo de {maxc} empresas de tu plan. Contáctanos para ampliar.")
    cid = str(uuid.uuid4())
    doc = data.model_dump()
    doc.update({"id": cid, "user_id": user["id"], "created_at": datetime.now(timezone.utc).isoformat()})
    await db.companies.insert_one(doc)
    doc.pop("_id", None)
    await db.users.update_one({"_id": ObjectId(user["id"])},
                              {"$set": {"active_company_id": cid, "multi_company_enabled": True}})
    return doc


@api.put("/companies/{company_id}")
async def update_company_ep(company_id: str, data: CompanyInput, user=Depends(get_current_user)):
    existing = await db.companies.find_one({"id": company_id, "user_id": user["id"]}, {"_id": 0, "logo": 1})
    if not existing:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    doc = data.model_dump()
    doc["user_id"] = user["id"]
    doc["id"] = company_id
    if not doc.get("logo") and existing.get("logo"):
        doc["logo"] = existing["logo"]
    await db.companies.update_one({"id": company_id, "user_id": user["id"]}, {"$set": doc})
    return doc


@api.delete("/companies/{company_id}")
async def delete_company_ep(company_id: str, user=Depends(get_current_user)):
    comps = await _list_companies(user)
    if len(comps) <= 1:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu única empresa.")
    n_inv = await db.invoices.count_documents({"user_id": user["id"], "company_id": company_id})
    if n_inv:
        raise HTTPException(status_code=400, detail="No puedes eliminar una empresa con facturas emitidas.")
    await db.companies.delete_one({"id": company_id, "user_id": user["id"]})
    if user.get("active_company_id") == company_id:
        remaining = next(c["id"] for c in comps if c["id"] != company_id)
        await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"active_company_id": remaining}})
    return {"status": "ok"}


@api.post("/companies/switch")
async def switch_company_ep(data: CompanySwitchInput, user=Depends(get_current_user)):
    c = await db.companies.find_one({"id": data.company_id, "user_id": user["id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"active_company_id": data.company_id}})
    return {"status": "ok", "active_company_id": data.company_id}


@api.post("/companies/multi-toggle")
async def multi_toggle_ep(data: MultiToggleInput, user=Depends(get_current_user)):
    plan = await plan_for_user(user)
    if data.enabled and not plan["features"].get("multi_company") and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Tu plan no incluye multiempresa. Cambia al plan Multiempresas.")
    await db.users.update_one({"_id": ObjectId(user["id"])}, {"$set": {"multi_company_enabled": bool(data.enabled)}})
    return {"status": "ok", "enabled": bool(data.enabled)}


# ---------- Invoices ----------
@api.get("/invoices")
async def list_invoices(user=Depends(get_current_user)):
    docs = await db.invoices.find({"user_id": user["id"], "company_id": await active_cid(user)}, {"_id": 0}).sort("issue_date", -1).to_list(1000)
    return docs


async def _next_seq(user_id: str, company_id: str, prefix: str, year: str, start_number) -> int:
    """Siguiente número de secuencia: max(mayor existente + 1, número de inicio configurado)."""
    pat = f"^{re.escape(prefix)}{year}-"
    max_seq = 0
    async for n in db.invoices.find({"user_id": user_id, "company_id": company_id, "number": {"$regex": pat}}, {"_id": 0, "number": 1}):
        try:
            max_seq = max(max_seq, int(n["number"].rsplit("-", 1)[-1]))
        except Exception:
            pass
    try:
        start = int(start_number or 1)
    except (TypeError, ValueError):
        start = 1
    return max(max_seq + 1, start)


async def _make_invoice(user, company, data: InvoiceInput) -> dict:
    year = data.issue_date[:4]
    if data.invoice_type == "rectificativa":
        series = (data.series or company.get("rectify_prefix", "") or "R").strip()
    else:
        series = (data.series or company.get("invoice_prefix", "") or "").strip()
    prefix = f"{series}-" if series else ""
    seq = await _next_seq(user["id"], company["id"], prefix, year, company.get("invoice_start_number", 1))
    number = f"{prefix}{year}-{seq:04d}"
    doc = data.model_dump()
    doc["series"] = series
    doc.update({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "company_id": company["id"],
        "number": number,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    compute_invoice(doc)
    if company.get("verifactu_enabled"):
        last = await db.invoices.find_one(
            {"user_id": user["id"], "company_id": company["id"], "verifactu.huella": {"$exists": True}},
            {"_id": 0, "verifactu": 1}, sort=[("created_at", -1)])
        prev = last["verifactu"]["huella"] if last else ""
        nif = company.get("nif", "")
        fecha = vf.to_ddmmyyyy(doc["issue_date"])
        tipo = "R1" if doc.get("invoice_type") == "rectificativa" else "F1"
        ts = vf.now_ts()
        huella = vf.compute_fingerprint(nif, number, fecha, tipo, doc["iva_amount"], doc["total"], prev, ts)
        doc["verifactu"] = {
            "enabled": True, "tipo": tipo, "huella": huella, "huella_anterior": prev,
            "timestamp": ts, "qr_url": vf.build_qr_url(nif, number, fecha, doc["total"], produccion=(company.get("verifactu_mode") == "produccion")),
            "submitted": False, "status": "Registrado (pendiente de envío)",
            "submitted_at": None, "csv": None,
        }
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/invoices")
async def create_invoice(data: InvoiceInput, user=Depends(get_current_user)):
    _validate_invoice(data)
    plan = await plan_for_user(user)
    if plan["max_invoices"] is not None:
        cnt = await db.invoices.count_documents(
            {"user_id": user["id"], "company_id": await active_cid(user), "issue_date": {"$regex": f"^{_month_prefix()}"}})
        if cnt >= plan["max_invoices"]:
            raise HTTPException(status_code=403,
                detail=f"Has alcanzado el límite de {plan['max_invoices']} facturas al mes de tu plan {plan['name']}. Mejora tu plan para emitir más.")
    company = await active_company(user)
    return await _make_invoice(user, company, data)


@api.get("/invoices/next-number")
async def next_invoice_number(invoice_type: str = "normal", series: str = "",
                              issue_date: str = "", user=Depends(get_current_user)):
    company = await active_company(user)
    year = (issue_date[:4] if issue_date else str(datetime.now(timezone.utc).year))
    if invoice_type == "rectificativa":
        s = (series or company.get("rectify_prefix", "") or "R").strip()
    else:
        s = (series or company.get("invoice_prefix", "") or "").strip()
    prefix = f"{s}-" if s else ""
    seq = await _next_seq(user["id"], company["id"], prefix, year, company.get("invoice_start_number", 1))
    return {"number": f"{prefix}{year}-{seq:04d}", "series": s,
            "due_days": company.get("invoice_due_days", 15)}


@api.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user=Depends(get_current_user)):
    doc = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return doc


@api.put("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, data: InvoiceInput, user=Depends(get_current_user)):
    _validate_invoice(data)
    existing = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if existing.get("status") == "anulada":
        raise HTTPException(status_code=400, detail="No se puede editar una factura anulada.")
    doc = data.model_dump()
    doc.pop("series", None)
    doc.update({
        "id": invoice_id, "user_id": user["id"],
        "number": existing["number"], "series": existing.get("series", ""),
        "created_at": existing.get("created_at"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    compute_invoice(doc)
    await db.invoices.update_one({"id": invoice_id, "user_id": user["id"]}, {"$set": doc})
    return doc


@api.patch("/invoices/{invoice_id}/status")
async def update_status(invoice_id: str, data: StatusInput, user=Depends(get_current_user)):
    res = await db.invoices.update_one({"id": invoice_id, "user_id": user["id"]},
                                       {"$set": {"status": data.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return {"status": "ok"}


@api.post("/invoices/{invoice_id}/anular")
async def anular_invoice(invoice_id: str, user=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if inv.get("status") == "anulada":
        raise HTTPException(status_code=400, detail="La factura ya está anulada.")
    company = await active_company(user)
    now_iso = datetime.now(timezone.utc).isoformat()
    verifactu_result = None

    vfd = inv.get("verifactu")
    if vfd and vfd.get("enabled"):
        nif = company.get("nif", "")
        fecha = vf.to_ddmmyyyy(inv["issue_date"])
        ts = vf.now_ts()
        last = await db.invoices.find_one(
            {"user_id": user["id"], "company_id": company["id"], "verifactu.huella": {"$exists": True}},
            {"_id": 0, "verifactu": 1, "number": 1, "issue_date": 1}, sort=[("created_at", -1)])
        prev = (last or {}).get("verifactu", {}).get("huella", "") if last else ""
        prev_number = (last or {}).get("number", "") if last else ""
        prev_fecha = vf.to_ddmmyyyy(last["issue_date"]) if (last and last.get("issue_date")) else ""
        huella = vf.compute_fingerprint_anulacion(nif, inv["number"], fecha, prev, ts)
        registro_xml = vf.build_registro_anulacion_xml(company, inv, prev_number, prev, ts, huella, prev_fecha=prev_fecha)

        signature, signed, signer, cert_bytes, cert_pwd = None, False, None, None, None
        cert_doc = await db.certificates.find_one({"user_id": user["id"], "company_id": company["id"]})
        if cert_doc:
            try:
                cert_bytes = cert_service.decrypt(cert_doc["data"].encode())
                cert_pwd = cert_service.decrypt(cert_doc["password"].encode()).decode()
                key, cert, _ = cert_service.parse_pfx(cert_bytes, cert_pwd)
                signature = cert_service.sign_data(key, registro_xml.encode("utf-8"))
                signed = True
                signer = cert_service.cert_metadata(cert).get("subject_cn")
            except Exception as e:
                logger.error(f"Cert signing (anulacion) failed: {e}")

        soap_request = vf.build_soap_request(registro_xml, nif, company.get("name", ""))
        mode = company.get("verifactu_mode", "simulado")
        seal = (company.get("verifactu_cert_type") == "sello")
        if mode in ("preproduccion", "produccion") and cert_bytes:
            produccion = mode == "produccion"
            entorno = "producción" if produccion else "preproducción"
            real = await vf.send_to_aeat(cert_bytes, cert_pwd, soap_request, produccion=produccion, seal=seal)
            simulated, http_status, endpoint = False, real["status"], real["url"]
            aeat_response = real["response"] or f"ERROR DE CONEXIÓN CON LA AEAT ({entorno}):\n{real['error']}"
            parsed = vf.parse_aeat_response(real["response"]) if real["ok"] else {}
            estado_aeat = (parsed.get("estado_registro") or parsed.get("estado_envio") or "").lower()
            if real["ok"] and estado_aeat == "correcto":
                submitted, estado_reg = True, "Anulada"
                csv_code = parsed.get("csv") or ("VF-ANUL-" + secrets.token_hex(6).upper())
                status_msg = f"Anulación aceptada por la AEAT ({entorno})"
            elif real["ok"]:
                submitted, estado_reg = False, "Rechazado"
                csv_code = None
                err = f"{parsed.get('codigo_error','')} {parsed.get('descripcion_error','')}".strip()
                status_msg = (f"Anulación rechazada por la AEAT ({entorno}): {err}" if err
                              else f"Anulación rechazada por la AEAT ({entorno})")
            else:
                submitted, estado_reg = False, "Rechazado"
                csv_code = None
                status_msg = f"Error al anular en la AEAT ({entorno})"
        else:
            simulated, http_status, endpoint = True, 200, "AEAT VerifactuSOAP (SIMULADO)"
            submitted, estado_reg = True, "Anulada"
            csv_code = "VF-ANUL-" + secrets.token_hex(6).upper()
            aeat_response = vf.simulate_aeat_response(nif, inv["number"], csv_code, now_iso)
            status_msg = "Anulación aceptada por la AEAT (simulado)"

        await db.verifactu_log.insert_one({
            "id": str(uuid.uuid4()), "user_id": user["id"], "company_id": company["id"], "invoice_id": invoice_id,
            "invoice_number": inv["number"], "created_at": now_iso, "endpoint": endpoint,
            "estado": "Correcto" if submitted else "Error", "estado_registro": estado_reg,
            "csv": csv_code, "signed": signed, "signer": signer, "huella": huella,
            "simulated": simulated, "mode": mode, "http_status": http_status,
            "request_xml": soap_request, "response_xml": aeat_response, "tipo_registro": "Anulacion",
        })
        verifactu_result = {"huella": huella, "timestamp": ts, "submitted": submitted,
                            "status": status_msg, "csv": csv_code, "signed": signed, "mode": mode}

    await db.invoices.update_one(
        {"id": invoice_id, "user_id": user["id"]},
        {"$set": {"status": "anulada", "annulled": True, "annulled_at": now_iso,
                  "verifactu.anulacion": verifactu_result}})
    return {"status": "anulada", "verifactu": verifactu_result}


@api.get("/irpf/suggestion")
async def irpf_suggestion(user=Depends(get_current_user)):
    company = await active_company(user)
    tax_type = company.get("tax_type") or user.get("tax_type", "autonomo")
    return spanish_tax.irpf_suggestion(tax_type, company.get("autonomo_start_date", ""))


@api.post("/assistant/chat")
async def assistant_chat(data: AssistantInput, user=Depends(get_current_user)):
    if not (data.message or "").strip():
        raise HTTPException(status_code=400, detail="Escribe una pregunta.")
    sid = data.session_id or f"assist-{user['id']}"
    try:
        reply = await ai_service.assistant_reply(sid, data.message.strip())
    except Exception as e:
        logger.error(f"assistant error: {e}")
        raise HTTPException(status_code=502, detail="El asistente no está disponible ahora mismo. Inténtalo de nuevo.")
    return {"reply": reply, "session_id": sid}


@api.post("/invoices/review")
async def review_invoice_ai(data: ReviewInput, user=Depends(get_current_user)):
    draft = data.model_dump()
    # NIF check determinista añadido al contexto
    nif = (draft.get("client") or {}).get("nif", "")
    draft["nif_valido"] = spanish_tax.validate_nif(nif) if nif else False
    try:
        return await ai_service.review_invoice(draft)
    except Exception as e:
        logger.error(f"review error: {e}")
        raise HTTPException(status_code=502, detail="No se pudo revisar con IA ahora mismo.")


@api.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user=Depends(get_current_user)):
    res = await db.invoices.delete_one({"id": invoice_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return {"status": "ok"}


@api.get("/invoices/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: str, user=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    company = await active_company(user)
    company = await _merge_global_goroky(company)
    vfd = inv.get("verifactu")
    # Auto-corrección: si el CSV es placeholder (VF-) o falta, recuperar el real del log de la AEAT
    if vfd and (not vfd.get("csv") or str(vfd.get("csv", "")).startswith("VF-")):
        logs = await db.verifactu_log.find(
            {"user_id": user["id"], "invoice_id": invoice_id},
            {"_id": 0, "response_xml": 1}).sort("created_at", -1).to_list(20)
        for lg in logs:
            real_csv = vf.parse_aeat_response(lg.get("response_xml", "")).get("csv")
            if real_csv:
                vfd["csv"] = real_csv
                await db.invoices.update_one(
                    {"id": invoice_id, "user_id": user["id"]},
                    {"$set": {"verifactu.csv": real_csv}})
                break
    qr_png = None
    if vfd and vfd.get("qr_url"):
        try:
            qr_png = vf.generate_qr_png(vfd["qr_url"])
        except Exception as e:
            logger.error(f"QR generation failed: {e}")
    pdf = build_invoice_pdf(inv, company, qr_png=qr_png, verifactu=vfd)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="factura-{inv["number"]}.pdf"'})


# ---------- Presupuestos (quotes) ----------
QUOTE_STATUSES = {"borrador", "enviado", "aceptado", "rechazado", "facturado"}


def _quote_prefix(company: dict) -> str:
    return ((company or {}).get("quote_prefix") or "PRE").strip()


async def _next_quote_seq(user_id: str, company_id: str, prefix: str, year: str) -> int:
    pat = f"^{re.escape(prefix)}{year}-"
    max_seq = 0
    async for n in db.quotes.find({"user_id": user_id, "company_id": company_id, "number": {"$regex": pat}}, {"_id": 0, "number": 1}):
        try:
            max_seq = max(max_seq, int(n["number"].rsplit("-", 1)[-1]))
        except Exception:
            pass
    return max_seq + 1


@api.get("/quotes")
async def list_quotes(user=Depends(get_current_user)):
    return await db.quotes.find({"user_id": user["id"], "company_id": await active_cid(user)}, {"_id": 0}).sort("issue_date", -1).to_list(1000)


@api.get("/quotes/next-number")
async def next_quote_number(series: str = "", issue_date: str = "", user=Depends(get_current_user)):
    company = await active_company(user)
    year = (issue_date[:4] if issue_date else str(datetime.now(timezone.utc).year))
    s = (series or _quote_prefix(company)).strip()
    prefix = f"{s}-" if s else ""
    seq = await _next_quote_seq(user["id"], company["id"], prefix, year)
    return {"number": f"{prefix}{year}-{seq:04d}", "series": s}


def _build_quote_doc(user, company, data: QuoteInput, number: str, series: str) -> dict:
    doc = data.model_dump()
    doc["series"] = series
    doc["doc_type"] = "presupuesto"
    if doc.get("status") not in QUOTE_STATUSES:
        doc["status"] = "borrador"
    doc.update({
        "id": str(uuid.uuid4()), "user_id": user["id"], "company_id": company["id"], "number": number,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    compute_invoice(doc)
    return doc


@api.post("/quotes")
async def create_quote(data: QuoteInput, user=Depends(get_current_user)):
    _validate_invoice(data)
    company = await active_company(user)
    year = data.issue_date[:4]
    s = (data.series or _quote_prefix(company)).strip()
    prefix = f"{s}-" if s else ""
    seq = await _next_quote_seq(user["id"], company["id"], prefix, year)
    number = f"{prefix}{year}-{seq:04d}"
    doc = _build_quote_doc(user, company, data, number, s)
    await db.quotes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/quotes/{quote_id}")
async def get_quote(quote_id: str, user=Depends(get_current_user)):
    doc = await db.quotes.find_one({"id": quote_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return doc


@api.put("/quotes/{quote_id}")
async def update_quote(quote_id: str, data: QuoteInput, user=Depends(get_current_user)):
    _validate_invoice(data)
    existing = await db.quotes.find_one({"id": quote_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    if existing.get("status") == "facturado":
        raise HTTPException(status_code=400, detail="No se puede editar un presupuesto ya facturado.")
    company = await active_company(user)
    doc = _build_quote_doc(user, company, data, existing["number"], existing.get("series", ""))
    doc["id"] = quote_id
    doc["created_at"] = existing.get("created_at")
    doc["status"] = existing.get("status", "borrador")
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.quotes.update_one({"id": quote_id, "user_id": user["id"]}, {"$set": doc})
    return doc


@api.patch("/quotes/{quote_id}/status")
async def update_quote_status(quote_id: str, data: StatusInput, user=Depends(get_current_user)):
    if data.status not in QUOTE_STATUSES:
        raise HTTPException(status_code=400, detail="Estado no válido")
    res = await db.quotes.update_one({"id": quote_id, "user_id": user["id"]},
                                     {"$set": {"status": data.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return {"status": "ok"}


@api.delete("/quotes/{quote_id}")
async def delete_quote(quote_id: str, user=Depends(get_current_user)):
    res = await db.quotes.delete_one({"id": quote_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return {"status": "ok"}


@api.get("/quotes/{quote_id}/pdf")
async def quote_pdf(quote_id: str, user=Depends(get_current_user)):
    q = await db.quotes.find_one({"id": quote_id, "user_id": user["id"]}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    company = await active_company(user)
    q["doc_type"] = "presupuesto"
    pdf = build_invoice_pdf(q, company)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="presupuesto-{q["number"]}.pdf"'})


@api.post("/quotes/{quote_id}/send-email")
async def send_quote_email(quote_id: str, user=Depends(get_current_user)):
    plan = await plan_for_user(user)
    if not plan["features"].get("email"):
        raise _plan_denied(plan, "email")
    q = await db.quotes.find_one({"id": quote_id, "user_id": user["id"]}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    to = q.get("client", {}).get("email")
    if not to:
        raise HTTPException(status_code=400, detail="El cliente no tiene email registrado")
    company = await active_company(user)
    q["doc_type"] = "presupuesto"
    html = build_invoice_email_html(q, company, doc_label="PRESUPUESTO")
    subject = f"Presupuesto {q['number']} - {company.get('name', 'OpenFactura')}"
    import base64 as _b64
    pdf = build_invoice_pdf(q, company)
    attachments = [{"filename": f"presupuesto-{q['number']}.pdf", "content": _b64.b64encode(pdf).decode()}]
    email_id = await send_email(to=to, subject=subject, html=html, reply_to=company.get("email"), attachments=attachments)
    await db.quotes.update_one({"id": quote_id, "user_id": user["id"]},
                               {"$set": {"emailed_at": datetime.now(timezone.utc).isoformat(),
                                         "status": "enviado" if q.get("status") == "borrador" else q.get("status")}})
    return {"status": "sent", "email_id": email_id, "to": to}


@api.post("/quotes/{quote_id}/convert")
async def convert_quote(quote_id: str, user=Depends(get_current_user)):
    q = await db.quotes.find_one({"id": quote_id, "user_id": user["id"]}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    if q.get("invoice_id"):
        raise HTTPException(status_code=400, detail=f"Este presupuesto ya se convirtió en la factura {q.get('invoice_number')}.")
    plan = await plan_for_user(user)
    if plan["max_invoices"] is not None:
        cnt = await db.invoices.count_documents(
            {"user_id": user["id"], "company_id": await active_cid(user), "issue_date": {"$regex": f"^{_month_prefix()}"}})
        if cnt >= plan["max_invoices"]:
            raise HTTPException(status_code=403,
                detail=f"Has alcanzado el límite de {plan['max_invoices']} facturas al mes de tu plan {plan['name']}. Mejora tu plan para emitir más.")
    company = await active_company(user)
    inv_in = InvoiceInput(
        issue_date=datetime.now(timezone.utc).date().isoformat(),
        client=Client(**(q.get("client") or {})),
        line_items=[LineItem(**{k: it.get(k) for k in ("description", "detail", "quantity", "unit_price", "discount", "iva_rate", "iva_type") if it.get(k) is not None}) for it in q.get("line_items", [])],
        irpf_rate=q.get("irpf_rate", 0) or 0,
        recargo_equivalencia=bool(q.get("recargo_equivalencia")),
        global_discount=q.get("global_discount", 0) or 0,
        notes=q.get("notes", "") or "",
        series="",
        period=q.get("period", "") or "",
        payment_method=q.get("payment_method", "") or "",
        iban=q.get("iban", "") or "",
        concept_label=q.get("concept_label", "") or "",
    )
    inv = await _make_invoice(user, company, inv_in)
    await db.quotes.update_one({"id": quote_id, "user_id": user["id"]}, {"$set": {
        "status": "facturado", "invoice_id": inv["id"], "invoice_number": inv["number"],
        "converted_at": datetime.now(timezone.utc).isoformat()}})
    return inv


@api.post("/invoices/{invoice_id}/verifactu/submit")
async def verifactu_submit(invoice_id: str, user=Depends(get_current_user)):
    plan = await plan_for_user(user)
    if not plan["features"].get("verifactu"):
        raise _plan_denied(plan, "verifactu")
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    vfd = inv.get("verifactu")
    if not vfd:
        raise HTTPException(status_code=400, detail="La factura no tiene registro VeriFactu")
    if vfd.get("submitted"):
        return {"status": vfd.get("status"), "csv": vfd.get("csv"),
                "signed": vfd.get("signed", False), "already": True, "simulated": True}
    company = await active_company(user)
    nif = company.get("nif", "")

    # Encadenamiento: número y fecha de la factura anterior
    prev_number = ""
    prev_fecha = ""
    if vfd.get("huella_anterior"):
        prev = await db.invoices.find_one(
            {"user_id": user["id"], "company_id": company["id"], "verifactu.huella": vfd["huella_anterior"]},
            {"_id": 0, "number": 1, "issue_date": 1})
        if prev:
            prev_number = prev.get("number", "")
            if prev.get("issue_date"):
                prev_fecha = vf.to_ddmmyyyy(prev["issue_date"])

    # Rectificativa: datos de la factura original (obligatorio para R1)
    rectified = None
    if inv.get("invoice_type") == "rectificativa":
        rectified = {"number": inv.get("rectifies_number", ""), "fecha": ""}
        if inv.get("rectifies"):
            orig = await db.invoices.find_one(
                {"id": inv["rectifies"], "user_id": user["id"]},
                {"_id": 0, "number": 1, "issue_date": 1, "base": 1, "iva_amount": 1, "recargo_amount": 1})
            if orig:
                rectified["number"] = orig.get("number") or rectified["number"]
                rectified["base"] = orig.get("base")
                rectified["cuota"] = orig.get("iva_amount")
                rectified["recargo"] = orig.get("recargo_amount") or 0
                if orig.get("issue_date"):
                    rectified["fecha"] = vf.to_ddmmyyyy(orig["issue_date"])

    registro_xml = vf.build_registro_alta_xml(company, inv, prev_number,
                                              vfd.get("huella_anterior", ""), vfd["timestamp"], vfd["huella"],
                                              prev_fecha=prev_fecha, rectified=rectified)

    # Firma con el certificado del usuario (si existe)
    signature, signed, signer = None, False, None
    cert_bytes, cert_pwd = None, None
    cert_doc = await db.certificates.find_one({"user_id": user["id"], "company_id": company["id"]})
    if cert_doc:
        try:
            cert_bytes = cert_service.decrypt(cert_doc["data"].encode())
            cert_pwd = cert_service.decrypt(cert_doc["password"].encode()).decode()
            key, cert, _ = cert_service.parse_pfx(cert_bytes, cert_pwd)
            signature = cert_service.sign_data(key, registro_xml.encode("utf-8"))
            signed = True
            signer = cert_service.cert_metadata(cert).get("subject_cn")
        except Exception as e:
            logger.error(f"Cert signing failed: {e}")

    soap_request = vf.build_soap_request(registro_xml, nif, company.get("name", ""))
    resp_ts = datetime.now(timezone.utc).isoformat()
    mode = company.get("verifactu_mode", "simulado")
    seal = (company.get("verifactu_cert_type") == "sello")

    if mode in ("preproduccion", "produccion") and cert_bytes:
        produccion = mode == "produccion"
        entorno = "producción" if produccion else "preproducción"
        real = await vf.send_to_aeat(cert_bytes, cert_pwd, soap_request, produccion=produccion, seal=seal)
        simulated, endpoint, http_status = False, real["url"], real["status"]
        aeat_response = real["response"] or f"ERROR DE CONEXIÓN CON LA AEAT ({entorno}):\n{real['error']}"
        parsed = vf.parse_aeat_response(real["response"]) if real["ok"] else {}
        estado_aeat = (parsed.get("estado_registro") or parsed.get("estado_envio") or "").lower()
        if real["ok"] and estado_aeat == "correcto":
            estado, estado_reg, submitted = "Correcto", "Aceptado", True
            csv_code = parsed.get("csv") or vfd.get("csv") or ("VF-" + secrets.token_hex(8).upper())
            status_msg = f"Aceptado por la AEAT ({entorno})"
        elif real["ok"]:
            estado, estado_reg, submitted = "Error", "Rechazado", False
            csv_code = None
            err = f"{parsed.get('codigo_error','')} {parsed.get('descripcion_error','')}".strip()
            status_msg = (f"Rechazado por la AEAT ({entorno}): {err}" if err
                          else f"Rechazado por la AEAT ({entorno})")
        else:
            estado, estado_reg, submitted = "Error", "Rechazado", False
            csv_code = None
            status_msg = f"Error de comunicación con la AEAT ({entorno})"
    else:
        simulated, http_status = True, 200
        endpoint = "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP (SIMULADO)"
        estado, estado_reg, submitted = "Correcto", "Aceptado", True
        csv_code = vfd.get("csv") or ("VF-" + secrets.token_hex(8).upper())
        aeat_response = vf.simulate_aeat_response(nif, inv["number"], csv_code, resp_ts)
        status_msg = "Aceptado por la AEAT (simulado)"

    await db.invoices.update_one(
        {"id": invoice_id, "user_id": user["id"]},
        {"$set": {"verifactu.submitted": submitted, "verifactu.status": status_msg,
                  "verifactu.submitted_at": resp_ts, "verifactu.csv": csv_code,
                  "verifactu.signed": signed, "verifactu.mode": mode}})

    entry = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "company_id": company["id"], "invoice_id": invoice_id,
        "invoice_number": inv["number"], "created_at": resp_ts, "endpoint": endpoint,
        "estado": estado, "estado_registro": estado_reg, "csv": csv_code,
        "signed": signed, "signer": signer, "huella": vfd["huella"],
        "simulated": simulated, "mode": mode, "http_status": http_status,
        "request_xml": soap_request, "response_xml": aeat_response,
    }
    await db.verifactu_log.insert_one(entry)

    return {"status": status_msg, "csv": csv_code, "signed": signed,
            "simulated": simulated, "mode": mode,
            "note": ("Transmisión SIMULADA. El envío real requiere el servicio web oficial de la AEAT."
                     if simulated else "Intento real contra el entorno de PREPRODUCCIÓN de la AEAT (mTLS con tu certificado).")}


# ---------- VeriFactu: certificado y log de conexión ----------
@api.post("/verifactu/certificate")
async def upload_certificate(file: UploadFile = File(...), password: str = Form(""), user=Depends(get_current_user)):
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="El certificado no puede superar 5 MB")
    try:
        _key, cert, _chain = cert_service.parse_pfx(data, password)
    except Exception:
        raise HTTPException(status_code=400, detail="Certificado o contraseña no válidos (.pfx/.p12)")
    meta = cert_service.cert_metadata(cert)
    doc = {
        "user_id": user["id"],
        "company_id": await active_cid(user),
        "data": cert_service.encrypt(data).decode(),
        "password": cert_service.encrypt(password.encode()).decode(),
        "meta": meta, "filename": file.filename,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.certificates.update_one({"user_id": user["id"], "company_id": await active_cid(user)}, {"$set": doc}, upsert=True)
    return {"meta": meta, "filename": file.filename, "uploaded_at": doc["uploaded_at"]}


@api.get("/verifactu/certificate")
async def get_certificate(user=Depends(get_current_user)):
    doc = await db.certificates.find_one({"user_id": user["id"], "company_id": await active_cid(user)}, {"_id": 0, "data": 0, "password": 0})
    return doc or {}


@api.delete("/verifactu/certificate")
async def delete_certificate(user=Depends(get_current_user)):
    await db.certificates.delete_one({"user_id": user["id"], "company_id": await active_cid(user)})
    return {"status": "ok"}


@api.get("/verifactu/connection-log")
async def connection_log(user=Depends(get_current_user)):
    logs = await db.verifactu_log.find({"user_id": user["id"], "company_id": await active_cid(user)}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for e in logs:
        if not e.get("csv") or str(e.get("csv", "")).startswith("VF-"):
            real = vf.parse_aeat_response(e.get("response_xml", "")).get("csv")
            if real and not real.startswith("VF-"):
                e["csv"] = real
                await db.verifactu_log.update_one({"id": e.get("id")}, {"$set": {"csv": real}})
    return logs


@api.post("/verifactu/refresh-csv")
async def refresh_verifactu_csv(user=Depends(get_current_user)):
    """Corrige el CSV de facturas ya enviadas releyendo el CSV real de la respuesta guardada de la AEAT."""
    updated = 0
    logs = await db.verifactu_log.find({"user_id": user["id"], "company_id": await active_cid(user)}, {"_id": 0}).sort("created_at", 1).to_list(3000)
    for entry in logs:
        real_csv = vf.parse_aeat_response(entry.get("response_xml", "")).get("csv")
        if not real_csv:
            continue
        await db.verifactu_log.update_one({"id": entry.get("id")}, {"$set": {"csv": real_csv}})
        if entry.get("invoice_id"):
            res = await db.invoices.update_one(
                {"id": entry["invoice_id"], "user_id": user["id"]},
                {"$set": {"verifactu.csv": real_csv}})
            updated += res.modified_count
    return {"updated": updated}


@api.get("/invoices/{invoice_id}/verifactu/xml")
async def verifactu_xml(invoice_id: str, user=Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not inv or not inv.get("verifactu"):
        raise HTTPException(status_code=404, detail="Factura sin registro VeriFactu")
    entry = await db.verifactu_log.find_one(
        {"invoice_id": invoice_id, "user_id": user["id"]}, sort=[("created_at", -1)])
    if entry and entry.get("request_xml"):
        xml = entry["request_xml"]
    else:
        company = await active_company(user)
        vfd = inv["verifactu"]
        registro = vf.build_registro_alta_xml(company, inv, "", vfd.get("huella_anterior", ""),
                                              vfd["timestamp"], vfd["huella"])
        xml = vf.build_soap_request(registro, company.get("nif", ""), None)
    return Response(content=xml, media_type="application/xml",
                    headers={"Content-Disposition": f'attachment; filename="verifactu-{inv["number"]}.xml"'})


@api.get("/lookup/nif")
async def lookup_nif(nif: str, user=Depends(get_current_user)):
    import httpx

    def _norm(v):
        return (v or "").strip().upper().replace(" ", "").replace("-", "").replace(".", "").removeprefix("ES")

    num = _norm(nif)
    if not num:
        raise HTTPException(status_code=400, detail="Introduce un NIF/CIF")

    # 1) Contactos guardados del usuario (gratis, datos completos)
    contacts = await db.contacts.find({"user_id": user["id"], "company_id": await active_cid(user)}, {"_id": 0}).to_list(2000)
    for c in contacts:
        if _norm(c.get("nif", "")) == num:
            return {"valid": True, "name": c.get("name", ""), "address": c.get("address", ""),
                    "email": c.get("email", ""), "phone": c.get("phone", ""),
                    "nif": num, "source": "Contactos guardados"}

    # 2) Validación local (DNI/NIE/CIF). VIES solo valida IVA de empresas, así que
    # un NIE/DNI de autónomo es válido aunque VIES no lo reconozca.
    local_valid = spanish_tax.validate_nif(num)

    # 3) VIES (valida y, para no-ES, suele devolver nombre/dirección)
    name = address = ""
    vies_valid = False
    try:
        async with httpx.AsyncClient(timeout=12) as http_client:
            r = await http_client.post(
                "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
                json={"countryCode": "ES", "vatNumber": num})
        r.raise_for_status()
        d = r.json()
        vies_valid = bool(d.get("valid"))
        name = (d.get("name") or "").strip()
        address = (d.get("address") or "").strip()
        if name in ("---", "MS_UNAVAILABLE"):
            name = ""
        if address in ("---",):
            address = ""
    except Exception as e:
        logger.error(f"VIES lookup failed: {e}")
        if not local_valid:
            raise HTTPException(status_code=502, detail="No se pudo consultar el NIF en VIES. Inténtalo más tarde.")

    source = "VIES (Comisión Europea)" if vies_valid else ("Validación local (DNI/NIE/CIF)" if local_valid else "No válido")
    return {"valid": vies_valid or local_valid, "name": name, "address": address, "email": "",
            "phone": "", "nif": num, "source": source}


@api.post("/invoices/{invoice_id}/send-email")
async def send_invoice_email(invoice_id: str, user=Depends(get_current_user)):
    plan = await plan_for_user(user)
    if not plan["features"].get("email"):
        raise _plan_denied(plan, "email")
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    to = inv.get("client", {}).get("email")
    if not to:
        raise HTTPException(status_code=400, detail="El cliente no tiene email registrado")
    company = await active_company(user)
    html = build_invoice_email_html(inv, company)
    subject = f"Factura {inv['number']} - {company.get('name', 'FiscalHub España')}"
    email_id = await send_email(to=to, subject=subject, html=html, reply_to=company.get("email"))
    await db.invoices.update_one({"id": invoice_id, "user_id": user["id"]},
                                 {"$set": {"emailed_at": datetime.now(timezone.utc).isoformat()}})
    return {"status": "sent", "email_id": email_id, "to": to}


# ---------- Cobros con Stripe (por usuario / BYOK) ----------
class StripeConnectReq(BaseModel):
    secret_key: str


class SendPaymentReq(BaseModel):
    origin_url: str


def _company_stripe_key(company: dict) -> str:
    import cert_service
    enc = (company or {}).get("stripe_secret_key")
    if not enc:
        return ""
    try:
        return cert_service.decrypt(enc.encode()).decode()
    except Exception:
        return ""


@api.post("/stripe/connect")
async def stripe_connect(data: StripeConnectReq, user=Depends(get_current_user)):
    import stripe, cert_service
    key = (data.secret_key or "").strip()
    if not key.startswith("sk_"):
        raise HTTPException(status_code=400, detail="La clave debe ser tu Clave secreta de Stripe (empieza por sk_)")
    try:
        acct = await asyncio.to_thread(stripe.Account.retrieve, api_key=key)
    except stripe.error.AuthenticationError:
        raise HTTPException(status_code=400, detail="Clave de Stripe inválida. Revísala en Stripe → Desarrolladores → Claves API.")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"No se pudo conectar con Stripe: {str(e)}")
    name = (acct.get("business_profile", {}) or {}).get("name") \
        or ((acct.get("settings", {}) or {}).get("dashboard", {}) or {}).get("display_name") \
        or acct.get("email") or acct.get("id")
    charges = bool(acct.get("charges_enabled"))
    mode = "live" if key.startswith("sk_live") else "test"
    await db.companies.update_one({"id": await active_cid(user), "user_id": user["id"]}, {"$set": {
        "stripe_secret_key": cert_service.encrypt(key.encode()).decode(),
        "stripe_account_name": name, "stripe_charges_enabled": charges,
        "stripe_mode": mode, "stripe_connected": True}})
    return {"connected": True, "account_name": name, "charges_enabled": charges, "mode": mode}


@api.get("/stripe/status")
async def stripe_status(user=Depends(get_current_user)):
    c = await active_company(user)
    return {"connected": bool(c.get("stripe_connected") and c.get("stripe_secret_key")),
            "account_name": c.get("stripe_account_name", ""),
            "charges_enabled": c.get("stripe_charges_enabled", False),
            "mode": c.get("stripe_mode", "test")}


@api.delete("/stripe/connect")
async def stripe_disconnect(user=Depends(get_current_user)):
    await db.companies.update_one({"id": await active_cid(user), "user_id": user["id"]}, {"$set": {
        "stripe_connected": False, "stripe_secret_key": "", "stripe_account_name": "",
        "stripe_charges_enabled": False}})
    return {"status": "ok"}


@api.post("/invoices/{invoice_id}/send-payment")
async def send_invoice_payment(invoice_id: str, data: SendPaymentReq, user=Depends(get_current_user)):
    import stripe, base64 as _b64
    inv = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    to = inv.get("client", {}).get("email")
    if not to:
        raise HTTPException(status_code=400, detail="El cliente no tiene email registrado")
    company = await active_company(user)
    key = _company_stripe_key(company)
    if not key:
        raise HTTPException(status_code=400, detail="Conecta tu cuenta de Stripe en Configuración → Cobros con Stripe")
    total = float(inv.get("total") or 0)
    amount_cents = int(round(total * 100))
    if amount_cents < 50:
        raise HTTPException(status_code=400, detail="El importe mínimo para cobrar con Stripe es 0,50 €")
    origin = data.origin_url.rstrip("/")
    desc = (inv.get("line_items") or [{}])[0].get("description", "Factura")
    try:
        session = await asyncio.to_thread(lambda: stripe.checkout.Session.create(
            api_key=key, mode="payment", customer_email=to,
            line_items=[{"price_data": {"currency": "eur",
                        "product_data": {"name": f"Factura {inv['number']}", "description": desc[:250]},
                        "unit_amount": amount_cents}, "quantity": 1}],
            success_url=f"{origin}/pago/exito?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/pago/cancelado",
            metadata={"invoice_id": invoice_id, "user_id": user["id"], "number": inv["number"]}))
    except stripe.error.StripeError as e:
        logger.error(f"stripe invoice checkout failed: {e}")
        raise HTTPException(status_code=502, detail=f"Stripe rechazó la creación del cobro: {str(e)}")
    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()), "session_id": session.id, "invoice_id": invoice_id,
        "invoice_number": inv["number"], "user_id": user["id"], "company_id": company["id"], "amount": total, "currency": "eur",
        "status": "initiated", "payment_status": "pending", "created_at": now})
    qr_png = None
    vfd = inv.get("verifactu")
    if vfd and vfd.get("qr_url"):
        try:
            qr_png = vf.generate_qr_png(vfd["qr_url"])
        except Exception:
            pass
    pdf = build_invoice_pdf(inv, await _merge_global_goroky(company), qr_png=qr_png, verifactu=vfd)
    attachments = [{"filename": f"factura-{inv['number']}.pdf", "content": _b64.b64encode(pdf).decode()}]
    html = build_payment_email_html(inv, company, session.url)
    subject = f"Factura {inv['number']} · Pago pendiente"
    email_id = await send_email(to=to, subject=subject, html=html, reply_to=company.get("email"), attachments=attachments)
    await db.invoices.update_one({"id": invoice_id, "user_id": user["id"]}, {"$set": {
        "payment": {"session_id": session.id, "checkout_url": session.url, "status": "pending",
                    "sent_at": now, "to": to}, "emailed_at": now}})
    return {"status": "sent", "checkout_url": session.url, "to": to, "email_id": email_id}


@api.get("/public/payment-status/{session_id}")
async def public_payment_status(session_id: str):
    import stripe
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    status = tx.get("payment_status", "pending")
    if status != "paid":
        comp = ((await db.companies.find_one({"user_id": tx.get("user_id"), "id": tx.get("company_id")}, {"_id": 0})
                 if tx.get("company_id") else None)
                or await db.companies.find_one({"user_id": tx.get("user_id")}, {"_id": 0}) or {})
        key = _company_stripe_key(comp)
        if key:
            try:
                s = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id, api_key=key)
                if s.get("payment_status") == "paid" or s.get("status") == "complete":
                    status = "paid"
                    now = datetime.now(timezone.utc).isoformat()
                    await db.payment_transactions.update_one(
                        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                        {"$set": {"status": "completed", "payment_status": "paid",
                                  "stripe_payment_intent_id": s.get("payment_intent"), "updated_at": now}})
                    if tx.get("invoice_id"):
                        await db.invoices.update_one({"id": tx["invoice_id"]},
                            {"$set": {"status": "paid", "payment.status": "paid", "paid_at": now}})
            except stripe.error.StripeError:
                pass
    return {"payment_status": status, "invoice_number": tx.get("invoice_number"),
            "amount": tx.get("amount"), "currency": tx.get("currency", "eur")}


# ---------- Expenses ----------
@api.get("/expenses")
async def list_expenses(user=Depends(get_current_user)):
    docs = await db.expenses.find({"user_id": user["id"], "company_id": await active_cid(user)}, {"_id": 0}).sort("date", -1).to_list(1000)
    return docs


@api.post("/expenses")
async def create_expense(data: ExpenseInput, user=Depends(get_current_user)):
    doc = data.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "company_id": await active_cid(user),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    compute_expense(doc)
    await db.expenses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/expenses/{expense_id}")
async def update_expense(expense_id: str, data: ExpenseInput, user=Depends(get_current_user)):
    existing = await db.expenses.find_one({"id": expense_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    doc = data.model_dump()
    doc.update({
        "id": expense_id, "user_id": user["id"],
        "created_at": existing.get("created_at"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    compute_expense(doc)
    await db.expenses.update_one({"id": expense_id, "user_id": user["id"]}, {"$set": doc})
    return doc


@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user=Depends(get_current_user)):
    res = await db.expenses.delete_one({"id": expense_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return {"status": "ok"}


# ---------- Export (libros fiscales) ----------
@api.get("/export/libros")
async def export_libros(year: int, format: str = "xlsx", user=Depends(get_current_user)):
    ys = str(year)
    invoices = await db.invoices.find(
        {"user_id": user["id"], "company_id": await active_cid(user), "issue_date": {"$regex": f"^{ys}"}}, {"_id": 0}).sort("issue_date", 1).to_list(10000)
    expenses = await db.expenses.find(
        {"user_id": user["id"], "company_id": await active_cid(user), "date": {"$regex": f"^{ys}"}}, {"_id": 0}).sort("date", 1).to_list(10000)
    company = await active_company(user)
    if format == "csv":
        content = build_libros_csv(invoices, expenses, year)
        return Response(content=content, media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="libros-fiscales-{year}.csv"'})
    data = build_libros_xlsx(company, invoices, expenses, year)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="libros-fiscales-{year}.xlsx"'})


# ---------- Dashboard ----------
@api.get("/dashboard")
async def dashboard(year: Optional[int] = None, user=Depends(get_current_user)):
    if year is None:
        year = datetime.now(timezone.utc).year
    ys = str(year)
    invoices = await db.invoices.find(
        {"user_id": user["id"], "company_id": await active_cid(user), "issue_date": {"$regex": f"^{ys}"}, "status": {"$ne": "anulada"}}, {"_id": 0}).to_list(5000)
    expenses = await db.expenses.find(
        {"user_id": user["id"], "company_id": await active_cid(user), "date": {"$regex": f"^{ys}"}}, {"_id": 0}).to_list(5000)

    quarters = {q: {"quarter": q, "label": QUARTER_LABELS[q], "ingresos": 0.0, "gastos": 0.0,
                    "iva_repercutido": 0.0, "iva_soportado": 0.0, "irpf": 0.0} for q in (1, 2, 3, 4)}

    for inv in invoices:
        q = quarter_of(inv["issue_date"])
        quarters[q]["ingresos"] += inv.get("base", 0)
        quarters[q]["iva_repercutido"] += inv.get("iva_amount", 0)
        quarters[q]["irpf"] += inv.get("irpf_amount", 0)
    for exp in expenses:
        q = quarter_of(exp["date"])
        quarters[q]["gastos"] += exp.get("base", 0)
        quarters[q]["iva_soportado"] += exp.get("iva_amount", 0)

    q_list = []
    modelo_130 = []
    today = date.today()
    next_deadline = None
    acc_ingresos = acc_gastos = acc_irpf = acc_pagos_130 = 0.0
    for q in (1, 2, 3, 4):
        d = quarters[q]
        iva_pagar = round(d["iva_repercutido"] - d["iva_soportado"], 2)
        dl = deadline_date(year, q)
        q_list.append({
            "quarter": q,
            "label": d["label"],
            "ingresos": round(d["ingresos"], 2),
            "gastos": round(d["gastos"], 2),
            "iva_repercutido": round(d["iva_repercutido"], 2),
            "iva_soportado": round(d["iva_soportado"], 2),
            "iva_a_pagar": iva_pagar,
            "deadline": dl.isoformat(),
        })

        # Modelo 130 (IRPF pagos fraccionados) - acumulado, solo autónomos
        acc_ingresos += d["ingresos"]
        acc_gastos += d["gastos"]
        acc_irpf += d["irpf"]
        rendimiento = acc_ingresos - acc_gastos
        pago = round(max(0.0, 0.20 * rendimiento - acc_irpf - acc_pagos_130), 2)
        acc_pagos_130 += pago
        modelo_130.append({
            "quarter": q,
            "label": d["label"],
            "rendimiento_acumulado": round(rendimiento, 2),
            "irpf_retenido_acumulado": round(acc_irpf, 2),
            "pago_fraccionado": pago,
            "deadline": dl.isoformat(),
        })

        if dl >= today and next_deadline is None:
            next_deadline = {
                "quarter": q, "label": d["label"], "date": dl.isoformat(),
                "days_left": (dl - today).days, "amount": iva_pagar,
            }

    iva_repercutido = round(sum(i.get("iva_amount", 0) for i in invoices), 2)
    iva_soportado = round(sum(e.get("iva_amount", 0) for e in expenses), 2)
    irpf_retenido = round(sum(i.get("irpf_amount", 0) for i in invoices), 2)
    total_ingresos = round(sum(i.get("base", 0) for i in invoices), 2)
    total_gastos = round(sum(e.get("base", 0) for e in expenses), 2)

    return {
        "year": year,
        "tax_type": user.get("tax_type", "autonomo"),
        "iva_repercutido": iva_repercutido,
        "iva_soportado": iva_soportado,
        "iva_a_pagar": round(iva_repercutido - iva_soportado, 2),
        "irpf_retenido": irpf_retenido,
        "total_ingresos": total_ingresos,
        "total_gastos": total_gastos,
        "beneficio": round(total_ingresos - total_gastos, 2),
        "invoice_count": len(invoices),
        "expense_count": len(expenses),
        "pending_amount": round(sum(i.get("total", 0) for i in invoices if i.get("status") == "pending"), 2),
        "quarters": q_list,
        "modelo_130": modelo_130,
        "modelo_130_total": round(acc_pagos_130, 2),
        "next_deadline": next_deadline,
    }


@api.get("/available-years")
async def available_years(user=Depends(get_current_user)):
    years = set()
    async for inv in db.invoices.find({"user_id": user["id"], "company_id": await active_cid(user)}, {"issue_date": 1, "_id": 0}):
        if inv.get("issue_date"):
            years.add(int(inv["issue_date"][:4]))
    async for exp in db.expenses.find({"user_id": user["id"], "company_id": await active_cid(user)}, {"date": 1, "_id": 0}):
        if exp.get("date"):
            years.add(int(exp["date"][:4]))
    years.add(datetime.now(timezone.utc).year)
    return sorted(years, reverse=True)


@api.get("/annual-summary")
async def annual_summary(year: Optional[int] = None, user=Depends(get_current_user)):
    if year is None:
        year = datetime.now(timezone.utc).year
    ys = str(year)
    invoices = await db.invoices.find(
        {"user_id": user["id"], "company_id": await active_cid(user), "issue_date": {"$regex": f"^{ys}"}, "status": {"$ne": "anulada"}}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find(
        {"user_id": user["id"], "company_id": await active_cid(user), "date": {"$regex": f"^{ys}"}}, {"_id": 0}).to_list(10000)

    rates = [21, 10, 4, 0]
    rep_map = {r: {"base": 0.0, "cuota": 0.0} for r in rates}
    for inv in invoices:
        bd = inv.get("iva_breakdown")
        if bd:
            for b in bd:
                r = int(b.get("rate", 0))
                if r in rep_map:
                    rep_map[r]["base"] += b.get("base", 0)
                    rep_map[r]["cuota"] += b.get("cuota", 0)
        else:
            r = int(inv.get("iva_rate", 0) or 0)
            if r in rep_map:
                rep_map[r]["base"] += inv.get("base", 0)
                rep_map[r]["cuota"] += inv.get("iva_amount", 0)
    iva_repercutido, iva_soportado = [], []
    for r in rates:
        iva_repercutido.append({"rate": r, "base": round(rep_map[r]["base"], 2),
                                "cuota": round(rep_map[r]["cuota"], 2)})
        sop_base = round(sum(e.get("base", 0) for e in expenses if e.get("iva_rate") == r), 2)
        sop_cuota = round(sum(e.get("iva_amount", 0) for e in expenses if e.get("iva_rate") == r), 2)
        iva_soportado.append({"rate": r, "base": sop_base, "cuota": sop_cuota})

    total_cuota_rep = round(sum(x["cuota"] for x in iva_repercutido), 2)
    total_cuota_sop = round(sum(x["cuota"] for x in iva_soportado), 2)
    # Modelo 349 — entregas intracomunitarias exentas (art. 25), agrupadas por cliente
    intracom_ops = {}
    total_intracom = 0.0
    for inv in invoices:
        bi = round(float(inv.get("base_intracom", 0) or 0), 2)
        if not bi:
            continue
        cl = inv.get("client", {}) or {}
        key = (cl.get("nif") or cl.get("name") or "—")
        e = intracom_ops.setdefault(key, {"nif": cl.get("nif", ""), "name": cl.get("name", ""), "base": 0.0})
        e["base"] += bi
        total_intracom += bi
    ingresos = round(sum(i.get("base", 0) for i in invoices), 2)
    gastos = round(sum(e.get("base", 0) for e in expenses), 2)
    rendimiento = round(ingresos - gastos, 2)
    retenciones = round(sum(i.get("irpf_amount", 0) for i in invoices), 2)
    pagos_130 = round(max(0.0, 0.20 * rendimiento - retenciones), 2)

    return {
        "year": year,
        "tax_type": user.get("tax_type", "autonomo"),
        "modelo_390": {
            "iva_repercutido": iva_repercutido,
            "iva_soportado": iva_soportado,
            "total_cuota_repercutida": total_cuota_rep,
            "total_cuota_soportada": total_cuota_sop,
            "resultado_anual": round(total_cuota_rep - total_cuota_sop, 2),
            "base_intracomunitaria": round(total_intracom, 2),
        },
        "modelo_349": {
            "total": round(total_intracom, 2),
            "operations": [{"nif": v["nif"], "name": v["name"], "base": round(v["base"], 2)}
                           for v in intracom_ops.values()],
        },
        "irpf": {
            "ingresos": ingresos,
            "gastos": gastos,
            "rendimiento_neto": rendimiento,
            "retenciones_soportadas": retenciones,
            "pagos_fraccionados_130": pagos_130,
            "cuota_estimada": round(max(0.0, 0.20 * rendimiento), 2),
        },
    }


# ---------- Contacts (clients & providers) ----------
@api.get("/contacts")
async def list_contacts(kind: Optional[str] = None, user=Depends(get_current_user)):
    q = {"user_id": user["id"], "company_id": await active_cid(user)}
    if kind:
        q["kind"] = kind
    return await db.contacts.find(q, {"_id": 0}).sort("name", 1).to_list(2000)


@api.post("/contacts")
async def create_contact(data: ContactInput, user=Depends(get_current_user)):
    plan = await plan_for_user(user)
    if plan["max_contacts"] is not None:
        cnt = await db.contacts.count_documents({"user_id": user["id"]})
        if cnt >= plan["max_contacts"]:
            raise HTTPException(status_code=403,
                detail=f"Has alcanzado el límite de {plan['max_contacts']} contactos de tu plan {plan['name']}. Mejora tu plan para guardar más.")
    doc = data.model_dump()
    doc.update({"id": str(uuid.uuid4()), "user_id": user["id"], "company_id": await active_cid(user),
                "created_at": datetime.now(timezone.utc).isoformat()})
    await db.contacts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, user=Depends(get_current_user)):
    res = await db.contacts.delete_one({"id": contact_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contacto no encontrado")
    return {"status": "ok"}


# ---------- Expense document scan (OCR) ----------
@api.post("/expenses/scan")
async def scan_expense(file: UploadFile = File(...), user=Depends(get_current_user)):
    plan = await plan_for_user(user)
    if not plan["features"].get("ocr"):
        raise _plan_denied(plan, "ocr")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo vacío")
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="El archivo no puede superar 10 MB")
    ct = (file.content_type or "").lower()
    ext = (file.filename or "").split(".")[-1].lower() if "." in (file.filename or "") else "bin"

    # Store the original document
    store_ct = MIME_TYPES.get(ext, ct or "application/octet-stream")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = await put_object(path, data, store_ct)
        stored_path = result["path"]
        await db.files.insert_one({
            "id": str(uuid.uuid4()), "user_id": user["id"], "company_id": await active_cid(user), "storage_path": stored_path,
            "original_filename": file.filename, "content_type": store_ct,
            "is_deleted": False, "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error(f"Storage upload failed: {e}")
        raise HTTPException(status_code=502, detail="No se pudo guardar el archivo")

    # Prepare an image for the vision model
    is_pdf = ext == "pdf" or "pdf" in ct
    try:
        if is_pdf:
            import fitz
            doc = fitz.open(stream=data, filetype="pdf")
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            doc.close()
        else:
            img_bytes = data
        image_b64 = base64.b64encode(img_bytes).decode("utf-8")
    except Exception as e:
        logger.error(f"Image prep failed: {e}")
        raise HTTPException(status_code=400, detail="No se pudo procesar el documento")

    try:
        extracted = await extract_expense(image_b64)
    except Exception as e:
        logger.error(f"OCR failed: {e}")
        raise HTTPException(status_code=502, detail="No se pudo analizar el documento con IA")

    return {"attachment_path": stored_path, "extracted": extracted}


@api.get("/files/{path:path}")
async def download_file(path: str, user=Depends(get_current_user)):
    record = await db.files.find_one({"storage_path": path, "user_id": user["id"], "company_id": await active_cid(user), "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    data, ctype = await get_object(path)
    return Response(content=data, media_type=record.get("content_type", ctype))


app.include_router(auth_router)
app.include_router(admin_router)
from payments_routes import payments as payments_router
app.include_router(payments_router)
app.include_router(api)


@app.post("/api/cron/purge-verifactu-log")
async def purge_verifactu_log(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    token = request.headers.get("Authorization", "")
    expected = "Bearer " + os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="No autorizado")

    async def _purge():
        cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
        res = await db.verifactu_log.delete_many({"created_at": {"$lt": cutoff}})
        logger.info(f"VeriFactu log purgado (>60 días): {res.deleted_count} entradas")

    background.add_task(_purge)
    return {"status": "accepted"}


@app.post("/api/cron/check-cert-expiry")
async def check_cert_expiry(request: Request, background: BackgroundTasks):
    token = request.headers.get("Authorization", "")
    expected = "Bearer " + os.environ.get("WEBHOOK_CRON_SECRET", "")
    if not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="No autorizado")

    async def _check():
        from datetime import timedelta
        soon = datetime.now(timezone.utc) + timedelta(days=30)
        certs = await db.certificates.find({}).to_list(10000)
        for c in certs:
            meta = c.get("meta", {})
            valid_to_raw = meta.get("valid_to")
            if not valid_to_raw:
                continue
            try:
                valid_to = datetime.fromisoformat(valid_to_raw)
            except Exception:
                continue
            if valid_to > soon:
                continue
            if c.get("expiry_notified_for") == valid_to_raw:
                continue
            try:
                u = await db.users.find_one({"_id": ObjectId(c["user_id"])})
            except Exception:
                u = None
            if not u or not u.get("email"):
                continue
            days = (valid_to - datetime.now(timezone.utc)).days
            estado = "ha caducado" if days < 0 else f"caduca en {days} días"
            html = (
                f'<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">'
                f'<h2 style="color:#0F172A">Tu certificado digital {estado}</h2>'
                f'<p style="color:#475569;font-size:14px">El certificado <b>{meta.get("subject_cn","")}</b> '
                f'(NIF {meta.get("nif","")}) usado para VeriFactu es válido hasta '
                f'<b>{valid_to.strftime("%d/%m/%Y")}</b>.</p>'
                f'<p style="color:#475569;font-size:14px">Renueva tu certificado y vuelve a subirlo en FiscalHub '
                f'para seguir enviando tus facturas a la AEAT sin interrupciones.</p>'
                f'<p style="color:#94a3b8;font-size:12px">Nunca te pediremos tu contraseña ni datos bancarios por email.</p>'
                f'</div>'
            )
            try:
                await send_email(to=u["email"], subject="Tu certificado digital está a punto de caducar", html=html)
                await db.certificates.update_one({"_id": c["_id"]},
                                                 {"$set": {"expiry_notified_for": valid_to_raw}})
            except Exception as e:
                logger.error(f"Cert expiry email failed: {e}")

    background.add_task(_check)
    return {"status": "accepted"}

_cors_env = os.environ.get("CORS_ORIGINS") or os.environ.get("FRONTEND_URL", "http://localhost:3000")
_cors_origins = [o.strip().rstrip("/") for o in _cors_env.split(",") if o.strip()]

app.add_middleware(SecurityMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    secret = os.environ.get("JWT_SECRET", "")
    if len(secret) < 32:
        logger.warning("SECURITY: JWT_SECRET es demasiado corto (<32 chars). Usa un secreto aleatorio de 64 hex en producción.")
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.register_attempts.create_index("ip")
    await db.invoices.create_index("user_id")
    await db.quotes.create_index("user_id")
    await db.expenses.create_index("user_id")
    await db.contacts.create_index("user_id")
    await db.files.create_index("storage_path")
    await db.certificates.create_index("user_id", unique=True)
    await db.verifactu_log.create_index("user_id")
    await seed_admin()
    try:
        storage_service.init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    logger.info("Startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()
