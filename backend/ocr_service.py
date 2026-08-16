import os
import json
import uuid
import logging

logger = logging.getLogger(__name__)
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

SYSTEM_MSG = (
    "Eres un asistente experto en contabilidad y facturación española. "
    "Recibes la imagen de un ticket o factura de compra/gasto. "
    "Extrae los datos y responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional "
    "ni bloques de código. Usa estas claves exactas:\n"
    '{"vendor_name": string, "vendor_nif": string, "date": "YYYY-MM-DD", '
    '"description": string, "category": string, "base_amount": number, '
    '"iva_rate": number, "total": number}\n'
    "Reglas: 'category' debe ser uno de: General, Suministros, Material, Servicios, Alquiler, "
    "Software, Transporte, Otros. 'iva_rate' debe ser uno de: 21, 10, 4, 0. "
    "'base_amount' es la base imponible (sin IVA) y 'total' el importe total con IVA, ambos como número decimal "
    "con punto. Si un dato no aparece, usa cadena vacía para textos y 0 para números. "
    "Si solo ves el total con IVA, calcula la base según el tipo de IVA detectado."
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
        return {"vendor_name": "", "vendor_nif": "", "date": "", "description": "",
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
        "date": str(data.get("date", "") or ""),
        "description": str(data.get("description", "") or ""),
        "category": str(data.get("category", "General") or "General"),
        "base_amount": num(data.get("base_amount", 0)),
        "iva_rate": rate,
        "total": num(data.get("total", 0)),
    }
