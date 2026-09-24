import os
import json
import uuid
import logging

logger = logging.getLogger(__name__)
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

SYSTEM_MSG = (
    "Eres un experto contable español especializado en leer facturas y tickets de gasto con MÁXIMA precisión. "
    "Recibes la imagen de UNA sola factura o ticket de compra. Analízala con seriedad y cuidado, revisando "
    "importes, fechas, NIF y número de factura. Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto "
    "adicional ni bloques de código. Usa estas claves exactas:\n"
    '{"vendor_name": string, "vendor_nif": string, "invoice_number": string, "date": "YYYY-MM-DD", '
    '"description": string, "category": string, "base_amount": number, '
    '"iva_rate": number, "total": number}\n'
    "Reglas estrictas:\n"
    "- 'vendor_name': el emisor/proveedor de la factura (quien cobra), NO el cliente.\n"
    "- 'vendor_nif': NIF/CIF del proveedor en formato español (p.ej. B12345678). Si no aparece, cadena vacía.\n"
    "- 'invoice_number': el número o serie de la factura tal cual aparece; si no hay, cadena vacía.\n"
    "- 'date': fecha de emisión en formato YYYY-MM-DD.\n"
    "- 'category' debe ser uno de: General, Suministros, Material, Servicios, Alquiler, Software, Transporte, Otros.\n"
    "- 'iva_rate' debe ser uno de: 21, 10, 4, 0.\n"
    "- 'base_amount' es la base imponible (sin IVA) y 'total' el importe total con IVA, ambos como número decimal con punto.\n"
    "- Verifica la coherencia: base_amount + IVA debe aproximarse al total. Si solo ves el total con IVA, calcula la base según el tipo detectado.\n"
    "- Si un dato no aparece con claridad, usa cadena vacía para textos y 0 para números. NO inventes datos."
)


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


async def extract_expense(image_base64: str) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ocr-{uuid.uuid4()}",
        system_message=SYSTEM_MSG,
    ).with_model("openai", "gpt-5.4")

    msg = UserMessage(
        text="Extrae los datos de este documento de gasto y devuelve solo el JSON.",
        file_contents=[ImageContent(image_base64=image_base64)],
    )
    resp = await chat.send_message(msg)
    text = resp if isinstance(resp, str) else str(resp)
    try:
        data = _parse_json(text)
    except Exception as e:
        logger.error(f"OCR parse error: {e} | raw: {text[:500]}")
        return {"vendor_name": "", "vendor_nif": "", "invoice_number": "", "date": "", "description": "",
                "category": "General", "base_amount": 0, "iva_rate": 21, "total": 0}

    def num(v):
        try:
            return round(float(v), 2)
        except Exception:
            return 0.0

    rate = num(data.get("iva_rate", 21))
    if rate not in (21, 10, 4, 0):
        rate = 21
    return {
        "vendor_name": str(data.get("vendor_name", "") or ""),
        "vendor_nif": str(data.get("vendor_nif", "") or ""),
        "invoice_number": str(data.get("invoice_number", "") or ""),
        "date": str(data.get("date", "") or ""),
        "description": str(data.get("description", "") or ""),
        "category": str(data.get("category", "General") or "General"),
        "base_amount": num(data.get("base_amount", 0)),
        "iva_rate": rate,
        "total": num(data.get("total", 0)),
    }
