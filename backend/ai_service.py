import os
import json
import uuid
import logging

logger = logging.getLogger("ai_service")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

ASSISTANT_SYSTEM = (
    "Eres FiscalBot, un asesor experto en facturación e impuestos para autónomos y pymes de España. "
    "Ayudas a crear facturas correctamente y resuelves dudas sobre IVA, IRPF, VeriFactu, Modelo 303, 130, 111 y 115. "
    "Responde SIEMPRE en español, de forma clara, breve y práctica, con pasos concretos cuando proceda. "
    "Contexto útil: el IVA general es 21% (reducido 10%, superreducido 4%, exento 0%). "
    "La retención de IRPF para actividades profesionales es del 15%, pero los nuevos autónomos pueden aplicar el 7% "
    "el año de alta y los dos siguientes. Las empresas (SL) no aplican IRPF en sus facturas emitidas. "
    "Si te preguntan cómo crear una factura, explica: datos del cliente (nombre y NIF/CIF), fecha, "
    "conceptos con base imponible, tipo de IVA, IRPF si aplica, y cómo se calcula el total. "
    "No inventes cifras concretas del usuario; si faltan datos, pídelos. No des asesoramiento legal vinculante; "
    "recomienda confirmar con su asesor en casos complejos."
)

REVIEW_SYSTEM = (
    "Eres un revisor experto de facturas españolas. Recibes una factura en JSON y detectas errores o mejoras "
    "(NIF/CIF ausente o inválido, IVA/IRPF fuera de lo habitual, conceptos vacíos, importes incoherentes, "
    "falta de fecha, retención mal aplicada). Responde EXCLUSIVAMENTE con un JSON válido, sin texto extra, con la forma: "
    '{"ok": boolean, "issues": [{"field": string, "severity": "error"|"warning", "message": string}], '
    '"summary": string}. "ok" es true solo si no hay errores (severity error). Mensajes en español, claros y accionables.'
)


def _chat(system_message: str, session_id: str, api_key: str, model: str):
    from emergentintegrations.llm.chat import LlmChat
    return LlmChat(api_key=api_key, session_id=session_id,
                   system_message=system_message).with_model("openai", model or "gpt-5.4")


async def _groq_complete(system_message: str, user_text: str, cfg: dict) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=cfg["groq_key"], base_url="https://api.groq.com/openai/v1")
    r = await client.chat.completions.create(
        model=cfg.get("model") or "llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": system_message},
                  {"role": "user", "content": user_text}])
    return r.choices[0].message.content or ""


async def _complete(system_message: str, user_text: str, session_id: str) -> str:
    from integrations_config import get_ai
    cfg = await get_ai()
    provider = cfg.get("provider", "emergent")
    if provider == "groq":
        if not cfg.get("groq_key"):
            raise RuntimeError("Falta la API key de Groq en Integraciones.")
        return await _groq_complete(system_message, user_text, cfg)
    from emergentintegrations.llm.chat import UserMessage
    if provider == "openai":
        if not cfg.get("openai_key"):
            raise RuntimeError("Falta la API key de OpenAI en Integraciones.")
        key, model = cfg["openai_key"], (cfg.get("model") or "gpt-5.4")
    else:  # emergent (universal key)
        key, model = EMERGENT_LLM_KEY, "gpt-5.4"
    chat = _chat(system_message, session_id, key, model)
    resp = await chat.send_message(UserMessage(text=user_text))
    return resp if isinstance(resp, str) else str(resp)


async def assistant_reply(session_id: str, message: str) -> str:
    return await _complete(ASSISTANT_SYSTEM, message, session_id or f"assist-{uuid.uuid4()}")


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.lstrip().lower().startswith("json"):
            text = text.lstrip()[4:]
    s, e = text.find("{"), text.rfind("}")
    if s != -1 and e != -1:
        text = text[s:e + 1]
    return json.loads(text)


async def review_invoice(draft: dict) -> dict:
    text = await _complete(
        REVIEW_SYSTEM,
        "Revisa esta factura y devuelve solo el JSON:\n" + json.dumps(draft, ensure_ascii=False),
        f"review-{uuid.uuid4()}")
    try:
        data = _parse_json(text)
        if not isinstance(data.get("issues"), list):
            data["issues"] = []
        data["ok"] = bool(data.get("ok"))
        data["summary"] = str(data.get("summary", ""))
        return data
    except Exception as ex:
        logger.error(f"review parse error: {ex} | {text[:300]}")
        return {"ok": True, "issues": [], "summary": "No se pudo analizar automáticamente. Revisa los datos manualmente."}
