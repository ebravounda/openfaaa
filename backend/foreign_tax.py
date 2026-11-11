"""Clientes extracomunitarios: servicios no sujetos a IVA español (art. 69 LIVA)."""
EU = {"AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "GR", "ES", "FI", "FR", "HR", "HU",
      "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"}

LEGEND = ("Operación no sujeta a IVA por reglas de localización (art. 69 de la Ley 37/1992 del IVA). "
          "Not subject to Spanish VAT · Place of supply outside the EU.")


def norm_country(c) -> str:
    return (c or "ES").strip().upper()[:2] or "ES"


def is_extra_eu(country) -> bool:
    c = norm_country(country)
    return len(c) == 2 and c.isalpha() and c not in EU


def apply_foreign(inv: dict) -> bool:
    """Si el cliente es extracomunitario, todas las líneas pasan a no sujetas y sin IRPF/recargo."""
    cl = inv.get("client") or {}
    foreign = is_extra_eu(cl.get("country"))
    inv["foreign_client"] = foreign
    if foreign:
        cl["country"] = norm_country(cl.get("country"))
        for it in inv.get("line_items") or []:
            if (it.get("iva_type") or "general") != "suplido":
                it["iva_type"], it["iva_rate"] = "no_sujeto", 0
        inv["irpf_rate"] = 0
        inv["recargo_equivalencia"] = False
    return foreign
