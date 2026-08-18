import re
from datetime import datetime, timezone

# ---------- Validación de NIF/NIE/CIF español ----------
_DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"
_CIF_CONTROL = "JABCDEFGHI"


def validate_nif(nif: str) -> bool:
    if not nif:
        return False
    v = nif.strip().upper().replace("-", "").replace(" ", "")
    # DNI: 8 dígitos + letra
    if re.fullmatch(r"\d{8}[A-Z]", v):
        return v[8] == _DNI_LETTERS[int(v[:8]) % 23]
    # NIE: X/Y/Z + 7 dígitos + letra
    if re.fullmatch(r"[XYZ]\d{7}[A-Z]", v):
        num = str("XYZ".index(v[0])) + v[1:8]
        return v[8] == _DNI_LETTERS[int(num) % 23]
    # CIF: letra + 7 dígitos + control (dígito o letra)
    if re.fullmatch(r"[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]", v):
        digits = v[1:8]
        s_odd = sum(int(d) for d in digits[1::2])
        s_even = 0
        for d in digits[0::2]:
            x = int(d) * 2
            s_even += x if x < 10 else x - 9
        ctrl = (10 - (s_odd + s_even) % 10) % 10
        last = v[8]
        first = v[0]
        if first in "PQRSNW":  # control debe ser letra
            return last == _CIF_CONTROL[ctrl]
        if first in "ABEH":  # control debe ser número
            return last == str(ctrl)
        return last == str(ctrl) or last == _CIF_CONTROL[ctrl]
    return False


# ---------- Sugerencia de IRPF ----------
def irpf_suggestion(tax_type: str, autonomo_start_date: str = "") -> dict:
    """Sugiere el tipo de retención de IRPF para actividades profesionales."""
    if tax_type == "empresa":
        return {
            "suggested_rate": 0,
            "is_new_autonomo": False,
            "reason": "Las empresas (SL) no aplican retención de IRPF en sus facturas emitidas; tributan por el Impuesto de Sociedades.",
        }
    # Autónomo profesional
    is_new = False
    if autonomo_start_date:
        try:
            start_year = int(autonomo_start_date[:4])
            current_year = datetime.now(timezone.utc).year
            # 7% el año de alta y los dos siguientes
            is_new = current_year <= start_year + 2
        except Exception:
            is_new = False
    if is_new:
        return {
            "suggested_rate": 7,
            "is_new_autonomo": True,
            "reason": "Nuevo autónomo profesional: puedes aplicar el tipo reducido del 7% de IRPF el año de alta y los dos años naturales siguientes (art. 95.1 RIRPF). Debes indicarlo en la factura.",
        }
    return {
        "suggested_rate": 15,
        "is_new_autonomo": False,
        "reason": "Actividad profesional: la retención general de IRPF es del 15%. El 7% reducido solo aplica los 3 primeros años desde el alta.",
    }
