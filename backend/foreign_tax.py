"""Clientes extranjeros (UE y fuera de la UE): servicios sin IVA español."""
EU = {"AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "GR", "FI", "FR", "HR", "HU",
      "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"}

LEGEND_EXTRA = ("Operación no sujeta a IVA por reglas de localización (art. 69 de la Ley 37/1992 del IVA). "
                "Not subject to Spanish VAT · Place of supply outside the EU.")
LEGEND_EU = ("Inversión del sujeto pasivo: operación no sujeta a IVA en España (arts. 69 y 84.Uno.2º Ley 37/1992; "
             "art. 196 Directiva 2006/112/CE). Reverse charge · VAT to be accounted for by the recipient.")


def norm_country(c) -> str:
    return (c or "ES").strip().upper()[:2] or "ES"


def is_foreign(country) -> bool:
    c = norm_country(country)
    return len(c) == 2 and c.isalpha() and c != "ES"


def is_eu(country) -> bool:
    return norm_country(country) in EU


def is_extra_eu(country) -> bool:
    return is_foreign(country) and not is_eu(country)


def legend(country) -> str:
    return LEGEND_EU if is_eu(country) else LEGEND_EXTRA


def vat_id(cl: dict) -> str:
    """ID para VeriFactu: en la UE, el NIF-IVA con prefijo de país."""
    raw = (cl.get("nif") or "").strip().upper().replace(" ", "").replace(".", "").replace("-", "")
    c = norm_country(cl.get("country"))
    if is_eu(c):
        pref = "EL" if c == "GR" else c
        if raw[:2] == "GR":
            raw = "EL" + raw[2:]
        return raw if raw[:2].isalpha() else pref + raw
    return (cl.get("nif") or "").strip()


def apply_foreign(inv: dict) -> bool:
    """Cliente extranjero: todas las líneas pasan a no sujetas, sin IRPF ni recargo."""
    cl = inv.get("client") or {}
    foreign = is_foreign(cl.get("country"))
    inv["foreign_client"] = foreign
    inv["foreign_eu"] = foreign and is_eu(cl.get("country"))
    if foreign:
        cl["country"] = norm_country(cl.get("country"))
        for it in inv.get("line_items") or []:
            if (it.get("iva_type") or "general") != "suplido":
                it["iva_type"], it["iva_rate"] = "no_sujeto", 0
        inv["irpf_rate"] = 0
        inv["recargo_equivalencia"] = False
    return foreign
