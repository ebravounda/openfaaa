from dotenv import load_dotenv
from pathlib import Path
import os
load_dotenv(Path(__file__).parent / ".env")

import logging
import uuid
import base64
from datetime import datetime, timezone, date
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import db, client
from auth import router as auth_router, get_current_user, seed_admin
from pdf_service import build_invoice_pdf
from email_service import send_email, build_invoice_email_html
import storage_service
from storage_service import put_object, get_object, MIME_TYPES, APP_NAME
from ocr_service import extract_expense

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


class StatusInput(BaseModel):
    status: str


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


# ---------- Company ----------
@api.get("/company")
async def get_company(user=Depends(get_current_user)):
    doc = await db.companies.find_one({"user_id": user["id"]}, {"_id": 0})
    return doc or {}


@api.put("/company")
async def upsert_company(data: CompanyInput, user=Depends(get_current_user)):
    doc = data.model_dump()
    doc["user_id"] = user["id"]
    await db.companies.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    return doc


# ---------- Invoices ----------
@api.get("/invoices")
async def list_invoices(user=Depends(get_current_user)):
    docs = await db.invoices.find({"user_id": user["id"]}, {"_id": 0}).sort("issue_date", -1).to_list(1000)
    return docs


@api.post("/invoices")
async def create_invoice(data: InvoiceInput, user=Depends(get_current_user)):
    year = data.issue_date[:4]
    count = await db.invoices.count_documents({"user_id": user["id"], "number": {"$regex": f"^{year}-"}})
    number = f"{year}-{count + 1:04d}"
    doc = data.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "number": number,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    compute_invoice(doc)
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user=Depends(get_current_user)):
    doc = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return doc


@api.patch("/invoices/{invoice_id}/status")
async def update_status(invoice_id: str, data: StatusInput, user=Depends(get_current_user)):
    res = await db.invoices.update_one({"id": invoice_id, "user_id": user["id"]},
                                       {"$set": {"status": data.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return {"status": "ok"}


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
    pdf = build_invoice_pdf(inv, company)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="factura-{inv["number"]}.pdf"'})


@api.post("/invoices/{invoice_id}/send-email")
async def send_invoice_email(invoice_id: str, user=Depends(get_current_user)):
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


@api.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, user=Depends(get_current_user)):
    res = await db.expenses.delete_one({"id": expense_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return {"status": "ok"}


# ---------- Dashboard ----------
@api.get("/dashboard")
async def dashboard(year: Optional[int] = None, user=Depends(get_current_user)):
    if year is None:
        year = datetime.now(timezone.utc).year
    ys = str(year)
    invoices = await db.invoices.find(
        {"user_id": user["id"], "issue_date": {"$regex": f"^{ys}"}}, {"_id": 0}).to_list(5000)
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


# ---------- Contacts (clients & providers) ----------
@api.get("/contacts")
async def list_contacts(kind: Optional[str] = None, user=Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if kind:
        q["kind"] = kind
    return await db.contacts.find(q, {"_id": 0}).sort("name", 1).to_list(2000)


@api.post("/contacts")
async def create_contact(data: ContactInput, user=Depends(get_current_user)):
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
app.include_router(api)

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
