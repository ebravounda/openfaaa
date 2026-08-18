from dotenv import load_dotenv
from pathlib import Path
import os
load_dotenv(Path(__file__).parent / ".env")

import logging
import uuid
import base64
import re
import secrets
import hmac
from datetime import datetime, timezone, date
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query, Form, Request, BackgroundTasks
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import db, client
from bson import ObjectId
from auth import router as auth_router, get_current_user, seed_admin
from admin_routes import admin as admin_router
from plans import plan_for_user, plans_list
from templates import TEMPLATE_MAP
from pdf_service import build_invoice_pdf
from email_service import send_email, build_invoice_email_html
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

app = FastAPI()
api = APIRouter(prefix="/api")


# ---------- Models ----------
class LineItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float = 0.0


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
    status: str = "pending"
    notes: str = ""
    series: str = ""
    invoice_type: str = "normal"  # "normal" or "rectificativa"
    rectifies: str = ""
    rectifies_number: str = ""
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
    verifactu_enabled: bool = False
    verifactu_mode: str = "simulado"
    template_id: str = "clasico"
    accent_color: str = ""
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


# ---------- Helpers ----------
def compute_invoice(inv: dict) -> dict:
    base = round(sum(i["quantity"] * i["unit_price"] for i in inv["line_items"]), 2)
    iva_amount = round(base * inv["iva_rate"] / 100, 2)
    irpf_amount = round(base * inv.get("irpf_rate", 0) / 100, 2)
    total = round(base + iva_amount - irpf_amount, 2)
    inv["base"] = base
    inv["iva_amount"] = iva_amount
    inv["irpf_amount"] = irpf_amount
    inv["total"] = total
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
    for i, it in enumerate(data.line_items, 1):
        if not (it.description or "").strip():
            errors.append(f"El concepto {i} necesita una descripción.")
        if it.quantity is None or it.quantity <= 0:
            errors.append(f"La cantidad del concepto {i} debe ser mayor que 0.")
        if it.unit_price is None or it.unit_price < 0:
            errors.append(f"El precio del concepto {i} no puede ser negativo.")
    if data.iva_rate not in (0, 4, 10, 21):
        errors.append("El tipo de IVA debe ser 0, 4, 10 o 21%.")
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
    inv_month = await db.invoices.count_documents({"user_id": user["id"], "issue_date": {"$regex": f"^{mp}"}})
    contacts = await db.contacts.count_documents({"user_id": user["id"]})
    return {"plan": plan, "usage": {"invoices_month": inv_month, "contacts": contacts}}


@api.get("/plans")
async def list_public_plans(user=Depends(get_current_user)):
    return await plans_list()


@api.get("/global-templates/goroky")
async def public_global_goroky(user=Depends(get_current_user)):
    from templates import GOROKY_DEFAULT_LEGAL, GOROKY_DEFAULT_FOOTER
    g = await db.global_settings.find_one({"_id": "goroky_texts"}) or {}
    return {
        "legal_notice": g.get("legal_notice") or GOROKY_DEFAULT_LEGAL,
        "footer_message": g.get("footer_message") or GOROKY_DEFAULT_FOOTER,
    }


# ---------- Company ----------
@api.get("/company")
async def get_company(user=Depends(get_current_user)):
    doc = await db.companies.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        return {"template_id": user.get("activity") or "clasico"}
    return doc


@api.put("/company")
async def upsert_company(data: CompanyInput, user=Depends(get_current_user)):
    doc = data.model_dump()
    doc["user_id"] = user["id"]
    await db.companies.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    return doc


@api.get("/templates")
async def list_templates(user=Depends(get_current_user)):
    from templates import TEMPLATES
    return TEMPLATES


# ---------- Invoices ----------
@api.get("/invoices")
async def list_invoices(user=Depends(get_current_user)):
    docs = await db.invoices.find({"user_id": user["id"]}, {"_id": 0}).sort("issue_date", -1).to_list(1000)
    return docs


@api.post("/invoices")
async def create_invoice(data: InvoiceInput, user=Depends(get_current_user)):
    _validate_invoice(data)
    plan = await plan_for_user(user)
    if plan["max_invoices"] is not None:
        cnt = await db.invoices.count_documents(
            {"user_id": user["id"], "issue_date": {"$regex": f"^{_month_prefix()}"}})
        if cnt >= plan["max_invoices"]:
            raise HTTPException(status_code=403,
                detail=f"Has alcanzado el límite de {plan['max_invoices']} facturas al mes de tu plan {plan['name']}. Mejora tu plan para emitir más.")
    year = data.issue_date[:4]
    company = await db.companies.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    if data.invoice_type == "rectificativa":
        series = (data.series or company.get("rectify_prefix", "") or "R").strip()
    else:
        series = (data.series or company.get("invoice_prefix", "") or "").strip()
    prefix = f"{series}-" if series else ""
    pat = f"^{re.escape(prefix)}{year}-"
    seq = await db.invoices.count_documents({"user_id": user["id"], "number": {"$regex": pat}}) + 1
    number = f"{prefix}{year}-{seq:04d}"
    doc = data.model_dump()
    doc["series"] = series
    doc.update({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "number": number,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    compute_invoice(doc)
    if company.get("verifactu_enabled"):
        last = await db.invoices.find_one(
            {"user_id": user["id"], "verifactu.huella": {"$exists": True}},
            {"_id": 0, "verifactu": 1}, sort=[("created_at", -1)])
        prev = last["verifactu"]["huella"] if last else ""
        nif = company.get("nif", "")
        fecha = vf.to_ddmmyyyy(doc["issue_date"])
        tipo = "R1" if doc.get("invoice_type") == "rectificativa" else "F1"
        ts = vf.now_ts()
        huella = vf.compute_fingerprint(nif, number, fecha, tipo, doc["iva_amount"], doc["total"], prev, ts)
        doc["verifactu"] = {
            "enabled": True, "tipo": tipo, "huella": huella, "huella_anterior": prev,
            "timestamp": ts, "qr_url": vf.build_qr_url(nif, number, fecha, doc["total"]),
            "submitted": False, "status": "Registrado (pendiente de envío)",
            "submitted_at": None, "csv": None,
        }
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


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
    company = await db.companies.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    now_iso = datetime.now(timezone.utc).isoformat()
    verifactu_result = None

    vfd = inv.get("verifactu")
    if vfd and vfd.get("enabled"):
        nif = company.get("nif", "")
        fecha = vf.to_ddmmyyyy(inv["issue_date"])
        ts = vf.now_ts()
        last = await db.invoices.find_one(
            {"user_id": user["id"], "verifactu.huella": {"$exists": True}},
            {"_id": 0, "verifactu": 1, "number": 1}, sort=[("created_at", -1)])
        prev = (last or {}).get("verifactu", {}).get("huella", "") if last else ""
        prev_number = (last or {}).get("number", "") if last else ""
        huella = vf.compute_fingerprint_anulacion(nif, inv["number"], fecha, prev, ts)
        registro_xml = vf.build_registro_anulacion_xml(company, inv, prev_number, prev, ts, huella)

        signature, signed, signer, cert_bytes, cert_pwd = None, False, None, None, None
        cert_doc = await db.certificates.find_one({"user_id": user["id"]})
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

        soap_request = vf.build_soap_request(registro_xml, nif, signature)
        mode = company.get("verifactu_mode", "simulado")
        if mode == "preproduccion" and cert_bytes:
            real = await vf.send_to_aeat(cert_bytes, cert_pwd, soap_request)
            simulated, http_status, endpoint = False, real["status"], real["url"]
            if real["ok"]:
                submitted, estado_reg = True, "Anulada"
                aeat_response = real["response"]
                csv_code = "VF-ANUL-" + secrets.token_hex(6).upper()
                status_msg = "Anulación aceptada por la AEAT (preproducción)"
            else:
                submitted, estado_reg = False, "Rechazado"
                aeat_response = real["response"] or f"ERROR DE CONEXIÓN CON LA AEAT (preproducción):\n{real['error']}"
                csv_code = None
                status_msg = "Error al anular en la AEAT (preproducción)"
        else:
            simulated, http_status, endpoint = True, 200, "AEAT VerifactuSOAP (SIMULADO)"
            submitted, estado_reg = True, "Anulada"
            csv_code = "VF-ANUL-" + secrets.token_hex(6).upper()
            aeat_response = vf.simulate_aeat_response(nif, inv["number"], csv_code, now_iso)
            status_msg = "Anulación aceptada por la AEAT (simulado)"

        await db.verifactu_log.insert_one({
            "id": str(uuid.uuid4()), "user_id": user["id"], "invoice_id": invoice_id,
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
    company = await db.companies.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
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
    company = await db.companies.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    company = await _merge_global_goroky(company)
    qr_png = None
    vfd = inv.get("verifactu")
    if vfd and vfd.get("qr_url"):
        try:
            qr_png = vf.generate_qr_png(vfd["qr_url"])
        except Exception as e:
            logger.error(f"QR generation failed: {e}")
    pdf = build_invoice_pdf(inv, company, qr_png=qr_png, verifactu=vfd)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="factura-{inv["number"]}.pdf"'})


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
    company = await db.companies.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    nif = company.get("nif", "")

    # Encadenamiento: número de la factura anterior
    prev_number = ""
    if vfd.get("huella_anterior"):
        prev = await db.invoices.find_one(
            {"user_id": user["id"], "verifactu.huella": vfd["huella_anterior"]},
            {"_id": 0, "number": 1})
        prev_number = prev["number"] if prev else ""

    registro_xml = vf.build_registro_alta_xml(company, inv, prev_number,
                                              vfd.get("huella_anterior", ""), vfd["timestamp"], vfd["huella"])

    # Firma con el certificado del usuario (si existe)
    signature, signed, signer = None, False, None
    cert_bytes, cert_pwd = None, None
    cert_doc = await db.certificates.find_one({"user_id": user["id"]})
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

    soap_request = vf.build_soap_request(registro_xml, nif, signature)
    resp_ts = datetime.now(timezone.utc).isoformat()
    mode = company.get("verifactu_mode", "simulado")

    if mode == "preproduccion" and cert_bytes:
        real = await vf.send_to_aeat(cert_bytes, cert_pwd, soap_request)
        simulated, endpoint, http_status = False, real["url"], real["status"]
        if real["ok"]:
            estado, estado_reg, submitted = "Correcto", "Aceptado", True
            aeat_response = real["response"]
            csv_code = vfd.get("csv") or ("VF-" + secrets.token_hex(8).upper())
            status_msg = "Aceptado por la AEAT (preproducción)"
        else:
            estado, estado_reg, submitted = "Error", "Rechazado", False
            aeat_response = real["response"] or f"ERROR DE CONEXIÓN CON LA AEAT (preproducción):\n{real['error']}"
            csv_code = vfd.get("csv")
            status_msg = "Error de comunicación con la AEAT (preproducción)"
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
        "id": str(uuid.uuid4()), "user_id": user["id"], "invoice_id": invoice_id,
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
    try:
        _key, cert, _chain = cert_service.parse_pfx(data, password)
    except Exception:
        raise HTTPException(status_code=400, detail="Certificado o contraseña no válidos (.pfx/.p12)")
    meta = cert_service.cert_metadata(cert)
    doc = {
        "user_id": user["id"],
        "data": cert_service.encrypt(data).decode(),
        "password": cert_service.encrypt(password.encode()).decode(),
        "meta": meta, "filename": file.filename,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.certificates.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    return {"meta": meta, "filename": file.filename, "uploaded_at": doc["uploaded_at"]}


@api.get("/verifactu/certificate")
async def get_certificate(user=Depends(get_current_user)):
    doc = await db.certificates.find_one({"user_id": user["id"]}, {"_id": 0, "data": 0, "password": 0})
    return doc or {}


@api.delete("/verifactu/certificate")
async def delete_certificate(user=Depends(get_current_user)):
    await db.certificates.delete_one({"user_id": user["id"]})
    return {"status": "ok"}


@api.get("/verifactu/connection-log")
async def connection_log(user=Depends(get_current_user)):
    return await db.verifactu_log.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


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
        company = await db.companies.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
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
    contacts = await db.contacts.find({"user_id": user["id"]}, {"_id": 0}).to_list(2000)
    for c in contacts:
        if _norm(c.get("nif", "")) == num:
            return {"valid": True, "name": c.get("name", ""), "address": c.get("address", ""),
                    "email": c.get("email", ""), "phone": c.get("phone", ""),
                    "nif": num, "source": "Contactos guardados"}

    # 2) VIES (valida y, para no-ES, suele devolver nombre/dirección)
    try:
        async with httpx.AsyncClient(timeout=12) as http_client:
            r = await http_client.post(
                "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
                json={"countryCode": "ES", "vatNumber": num})
        r.raise_for_status()
        d = r.json()
    except Exception as e:
        logger.error(f"VIES lookup failed: {e}")
        raise HTTPException(status_code=502, detail="No se pudo consultar el NIF en VIES. Inténtalo más tarde.")
    name = (d.get("name") or "").strip()
    address = (d.get("address") or "").strip()
    if name in ("---", "MS_UNAVAILABLE"):
        name = ""
    if address in ("---",):
        address = ""
    return {"valid": bool(d.get("valid")), "name": name, "address": address, "email": "",
            "phone": "", "nif": num, "source": "VIES (Comisión Europea)"}


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
    company = await db.companies.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    html = build_invoice_email_html(inv, company)
    subject = f"Factura {inv['number']} - {company.get('name', 'FiscalHub España')}"
    email_id = await send_email(to=to, subject=subject, html=html, reply_to=company.get("email"))
    await db.invoices.update_one({"id": invoice_id, "user_id": user["id"]},
                                 {"$set": {"emailed_at": datetime.now(timezone.utc).isoformat()}})
    return {"status": "sent", "email_id": email_id, "to": to}


# ---------- Expenses ----------
@api.get("/expenses")
async def list_expenses(user=Depends(get_current_user)):
    docs = await db.expenses.find({"user_id": user["id"]}, {"_id": 0}).sort("date", -1).to_list(1000)
    return docs


@api.post("/expenses")
async def create_expense(data: ExpenseInput, user=Depends(get_current_user)):
    doc = data.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
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
        {"user_id": user["id"], "issue_date": {"$regex": f"^{ys}"}}, {"_id": 0}).sort("issue_date", 1).to_list(10000)
    expenses = await db.expenses.find(
        {"user_id": user["id"], "date": {"$regex": f"^{ys}"}}, {"_id": 0}).sort("date", 1).to_list(10000)
    company = await db.companies.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
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
        {"user_id": user["id"], "issue_date": {"$regex": f"^{ys}"}, "status": {"$ne": "anulada"}}, {"_id": 0}).to_list(5000)
    expenses = await db.expenses.find(
        {"user_id": user["id"], "date": {"$regex": f"^{ys}"}}, {"_id": 0}).to_list(5000)

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
    async for inv in db.invoices.find({"user_id": user["id"]}, {"issue_date": 1, "_id": 0}):
        if inv.get("issue_date"):
            years.add(int(inv["issue_date"][:4]))
    async for exp in db.expenses.find({"user_id": user["id"]}, {"date": 1, "_id": 0}):
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
        {"user_id": user["id"], "issue_date": {"$regex": f"^{ys}"}, "status": {"$ne": "anulada"}}, {"_id": 0}).to_list(10000)
    expenses = await db.expenses.find(
        {"user_id": user["id"], "date": {"$regex": f"^{ys}"}}, {"_id": 0}).to_list(10000)

    rates = [21, 10, 4, 0]
    iva_repercutido, iva_soportado = [], []
    for r in rates:
        rep_base = round(sum(i.get("base", 0) for i in invoices if i.get("iva_rate") == r), 2)
        rep_cuota = round(sum(i.get("iva_amount", 0) for i in invoices if i.get("iva_rate") == r), 2)
        sop_base = round(sum(e.get("base", 0) for e in expenses if e.get("iva_rate") == r), 2)
        sop_cuota = round(sum(e.get("iva_amount", 0) for e in expenses if e.get("iva_rate") == r), 2)
        iva_repercutido.append({"rate": r, "base": rep_base, "cuota": rep_cuota})
        iva_soportado.append({"rate": r, "base": sop_base, "cuota": sop_cuota})

    total_cuota_rep = round(sum(x["cuota"] for x in iva_repercutido), 2)
    total_cuota_sop = round(sum(x["cuota"] for x in iva_soportado), 2)
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
    q = {"user_id": user["id"]}
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
    doc.update({"id": str(uuid.uuid4()), "user_id": user["id"],
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
    ct = (file.content_type or "").lower()
    ext = (file.filename or "").split(".")[-1].lower() if "." in (file.filename or "") else "bin"

    # Store the original document
    store_ct = MIME_TYPES.get(ext, ct or "application/octet-stream")
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, store_ct)
        stored_path = result["path"]
        await db.files.insert_one({
            "id": str(uuid.uuid4()), "user_id": user["id"], "storage_path": stored_path,
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
    record = await db.files.find_one({"storage_path": path, "user_id": user["id"], "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    data, ctype = get_object(path)
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
        res = await db.verifactu_log.delete_many({})
        logger.info(f"VeriFactu log purged: {res.deleted_count} entradas")

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.invoices.create_index("user_id")
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
