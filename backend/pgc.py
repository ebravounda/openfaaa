"""Plan General Contable español (RD 1514/2007 normal y RD 1515/2007 PYMES): cuentas, categorías y modelos de cuentas anuales."""

ACCOUNTS = {
    "1": "Financiación básica", "100": "Capital social", "101": "Fondo social", "102": "Capital",
    "103": "Socios por desembolsos no exigidos", "108": "Acciones o participaciones propias en situaciones especiales",
    "110": "Prima de emisión o asunción", "112": "Reserva legal", "113": "Reservas voluntarias", "114": "Reservas especiales",
    "118": "Aportaciones de socios o propietarios", "119": "Diferencias por ajuste del capital a euros",
    "120": "Remanente", "121": "Resultados negativos de ejercicios anteriores", "129": "Resultado del ejercicio",
    "130": "Subvenciones oficiales de capital", "131": "Donaciones y legados de capital", "141": "Provisión para impuestos",
    "142": "Provisión para otras responsabilidades", "160": "Deudas a l/p con entidades de crédito vinculadas",
    "170": "Deudas a largo plazo con entidades de crédito", "171": "Deudas a largo plazo", "173": "Proveedores de inmovilizado a largo plazo",
    "174": "Acreedores por arrendamiento financiero a largo plazo", "180": "Fianzas recibidas a largo plazo",
    "2": "Activo no corriente", "200": "Investigación", "201": "Desarrollo", "202": "Concesiones administrativas",
    "203": "Propiedad industrial", "204": "Fondo de comercio", "205": "Derechos de traspaso", "206": "Aplicaciones informáticas",
    "210": "Terrenos y bienes naturales", "211": "Construcciones", "212": "Instalaciones técnicas", "213": "Maquinaria",
    "214": "Utillaje", "215": "Otras instalaciones", "216": "Mobiliario", "217": "Equipos para procesos de información",
    "218": "Elementos de transporte", "219": "Otro inmovilizado material", "220": "Inversiones en terrenos y bienes naturales",
    "221": "Inversiones en construcciones", "230": "Adaptación de terrenos y bienes naturales", "240": "Participaciones a l/p en partes vinculadas",
    "250": "Inversiones financieras a l/p en instrumentos de patrimonio", "252": "Créditos a largo plazo",
    "260": "Fianzas constituidas a largo plazo", "265": "Depósitos constituidos a largo plazo",
    "280": "Amortización acumulada del inmovilizado intangible", "2806": "Amortización acumulada de aplicaciones informáticas",
    "281": "Amortización acumulada del inmovilizado material", "2811": "Amortización acumulada de construcciones",
    "2812": "Amortización acumulada de instalaciones técnicas", "2813": "Amortización acumulada de maquinaria",
    "2814": "Amortización acumulada de utillaje", "2815": "Amortización acumulada de otras instalaciones",
    "2816": "Amortización acumulada de mobiliario", "2817": "Amortización acumulada de equipos para procesos de información",
    "2818": "Amortización acumulada de elementos de transporte", "2819": "Amortización acumulada de otro inmovilizado material",
    "282": "Amortización acumulada de las inversiones inmobiliarias", "290": "Deterioro de valor del inmovilizado intangible",
    "291": "Deterioro de valor del inmovilizado material",
    "3": "Existencias", "300": "Mercaderías", "310": "Materias primas", "320": "Otros aprovisionamientos", "330": "Productos en curso",
    "350": "Productos terminados", "390": "Deterioro de valor de las mercaderías",
    "4": "Acreedores y deudores por operaciones comerciales", "400": "Proveedores", "401": "Proveedores, efectos comerciales a pagar",
    "407": "Anticipos a proveedores", "410": "Acreedores por prestaciones de servicios", "430": "Clientes",
    "431": "Clientes, efectos comerciales a cobrar", "436": "Clientes de dudoso cobro", "438": "Anticipos de clientes",
    "440": "Deudores", "460": "Anticipos de remuneraciones", "465": "Remuneraciones pendientes de pago",
    "470": "Hacienda Pública, deudora por diversos conceptos", "4700": "Hacienda Pública, deudora por IVA",
    "471": "Organismos de la Seguridad Social, deudores", "472": "Hacienda Pública, IVA soportado",
    "473": "Hacienda Pública, retenciones y pagos a cuenta", "474": "Activos por impuesto diferido",
    "475": "Hacienda Pública, acreedora por conceptos fiscales", "4750": "Hacienda Pública, acreedora por IVA",
    "4751": "Hacienda Pública, acreedora por retenciones practicadas", "4752": "Hacienda Pública, acreedora por impuesto sobre sociedades",
    "476": "Organismos de la Seguridad Social, acreedores", "477": "Hacienda Pública, IVA repercutido",
    "479": "Pasivos por diferencias temporarias imponibles", "480": "Gastos anticipados", "485": "Ingresos anticipados",
    "490": "Deterioro de valor de créditos por operaciones comerciales",
    "5": "Cuentas financieras", "520": "Deudas a corto plazo con entidades de crédito", "5201": "Deudas a c/p por crédito dispuesto",
    "521": "Deudas a corto plazo", "523": "Proveedores de inmovilizado a corto plazo", "524": "Acreedores por arrendamiento financiero a c/p",
    "540": "Inversiones financieras a c/p en instrumentos de patrimonio", "542": "Créditos a corto plazo", "544": "Créditos a corto plazo al personal",
    "551": "Cuenta corriente con socios y administradores", "555": "Partidas pendientes de aplicación (suplidos)",
    "557": "Dividendo activo a cuenta", "560": "Fianzas recibidas a corto plazo", "565": "Fianzas constituidas a corto plazo",
    "570": "Caja, euros", "572": "Bancos e instituciones de crédito c/c vista, euros", "580": "Inmovilizado (mantenido para la venta)",
    "6": "Compras y gastos", "600": "Compras de mercaderías", "601": "Compras de materias primas", "602": "Compras de otros aprovisionamientos",
    "606": "Descuentos sobre compras por pronto pago", "607": "Trabajos realizados por otras empresas", "608": "Devoluciones de compras",
    "609": "Rappels por compras", "610": "Variación de existencias de mercaderías", "62": "Servicios exteriores",
    "620": "Gastos en investigación y desarrollo del ejercicio", "621": "Arrendamientos y cánones", "622": "Reparaciones y conservación",
    "623": "Servicios de profesionales independientes", "624": "Transportes", "625": "Primas de seguros",
    "626": "Servicios bancarios y similares", "627": "Publicidad, propaganda y relaciones públicas", "628": "Suministros",
    "629": "Otros servicios", "630": "Impuesto sobre beneficios", "631": "Otros tributos", "634": "Ajustes negativos en la imposición indirecta",
    "640": "Sueldos y salarios", "641": "Indemnizaciones", "642": "Seguridad Social a cargo de la empresa", "649": "Otros gastos sociales",
    "650": "Pérdidas de créditos comerciales incobrables", "662": "Intereses de deudas", "665": "Intereses por descuento de efectos",
    "668": "Diferencias negativas de cambio", "669": "Otros gastos financieros", "671": "Pérdidas procedentes del inmovilizado material",
    "678": "Gastos excepcionales", "680": "Amortización del inmovilizado intangible", "681": "Amortización del inmovilizado material",
    "682": "Amortización de las inversiones inmobiliarias", "694": "Pérdidas por deterioro de créditos comerciales",
    "7": "Ventas e ingresos", "700": "Ventas de mercaderías", "701": "Ventas de productos terminados", "702": "Ventas de productos semiterminados",
    "704": "Ventas de envases y embalajes", "705": "Prestaciones de servicios", "706": "Descuentos sobre ventas por pronto pago",
    "708": "Devoluciones de ventas y operaciones similares", "709": "Rappels sobre ventas", "710": "Variación de existencias de productos en curso",
    "730": "Trabajos realizados para el inmovilizado", "740": "Subvenciones a la explotación", "746": "Subvenciones de capital transferidas al resultado",
    "752": "Ingresos por arrendamientos", "754": "Ingresos por comisiones", "759": "Ingresos por servicios diversos",
    "760": "Ingresos de participaciones en instrumentos de patrimonio", "762": "Ingresos de créditos", "768": "Diferencias positivas de cambio",
    "769": "Otros ingresos financieros", "771": "Beneficios procedentes del inmovilizado material", "778": "Ingresos excepcionales",
    "794": "Reversión del deterioro de créditos comerciales",
}
# Cuentas propias del PGC normal (no existen en el de PYMES)
NORMAL_ONLY = {
    "136": "Ajustes por valoración en activos no corrientes mantenidos para la venta",
    "241": "Participaciones a l/p en empresas asociadas", "242": "Valores representativos de deuda a l/p de partes vinculadas",
    "530": "Participaciones a corto plazo en partes vinculadas", "581": "Inversiones con personas y entidades vinculadas (mantenidas para la venta)",
    "585": "Provisiones vinculadas con activos no corrientes mantenidos para la venta",
    "663": "Pérdidas por valoración de instrumentos financieros por su valor razonable",
    "763": "Beneficios por valoración de instrumentos financieros por su valor razonable",
}

EXPENSE_CATEGORIES = {
    "General": "629", "Suministros": "628", "Telefonía e internet": "629", "Combustible": "628",
    "Restauración y dietas": "629", "Viajes y alojamiento": "629", "Alquiler": "621",
    "Reparaciones y mantenimiento": "622", "Servicios profesionales": "623", "Transporte": "624",
    "Seguros": "625", "Servicios bancarios": "626", "Publicidad y marketing": "627",
    "Material de oficina": "629", "Material": "602", "Compras de mercaderías": "600",
    "Trabajos de otras empresas": "607", "Software": "629", "Formación": "629", "Tributos": "631",
    "Seguridad Social autónomo": "642", "Intereses y gastos financieros": "662", "Servicios": "623", "Otros": "629",
}
INCOME_CATEGORIES = {
    "Prestación de servicios": "705", "Venta de mercaderías": "700", "Venta de productos terminados": "701",
    "Ingresos por arrendamientos": "752", "Ingresos por comisiones": "754", "Subvenciones a la explotación": "740",
    "Otros ingresos": "759",
}

EXPENSE_KEYWORDS = [
    ("Suministros", "iberdrola endesa naturgy totalenergies holaluz repsol luz canal de isabel aguas de agua gas natural electrica electricidad lucera octopus"),
    ("Telefonía e internet", "movistar vodafone orange telefonica jazztel yoigo digi masmovil pepephone lowi simyo fibra telefonia internet"),
    ("Combustible", "cepsa bp galp shell petronor gasolinera carburante ballenoil plenoil gasoleo gasolina estacion de servicio"),
    ("Restauración y dietas", "restaurante bar cafeteria cafe burger mcdonald telepizza glovo just eat uber eats comida menu taberna meson pizzeria asador cerveceria dieta"),
    ("Viajes y alojamiento", "hotel renfe iberia vueling ryanair booking airbnb taxi cabify parking aparcamiento peaje alsa avlo ouigo iryo"),
    ("Software", "google microsoft adobe amazon web services aws apple dropbox notion slack zoom canva openai github hosting dominio ionos godaddy wix shopify software licencia suscripcion"),
    ("Seguros", "mapfre axa allianz mutua seguro generali zurich linea directa ocaso santalucia caser"),
    ("Servicios bancarios", "comision bancaria bbva santander caixabank sabadell bankinter unicaja ing kutxabank abanca mantenimiento cuenta tpv"),
    ("Publicidad y marketing", "facebook meta ads google ads publicidad marketing imprenta rotulos flyers linkedin"),
    ("Material de oficina", "papeleria staples office depot lyreco folios toner tinta"),
    ("Transporte", "seur mrw correos dhl ups nacex gls envio mensajeria paqueteria transporte"),
    ("Servicios profesionales", "notaria notario registro abogado asesoria gestoria consultor auditor procurador"),
    ("Alquiler", "alquiler arrendamiento renta local oficina coworking"),
    ("Tributos", "ayuntamiento agencia tributaria tasa ibi iae dgt impuesto"),
    ("Formación", "curso formacion academia udemy master seminario"),
    ("Seguridad Social autónomo", "tesoreria general seguridad social reta cuota autonomo"),
    ("Reparaciones y mantenimiento", "reparacion mantenimiento taller ferreteria leroy bricomart bricodepot fontaneria electricista"),
]
INCOME_KEYWORDS = [
    ("Ingresos por arrendamientos", "alquiler arrendamiento renta"),
    ("Ingresos por comisiones", "comision intermediacion"),
    ("Subvenciones a la explotación", "subvencion ayuda"),
    ("Venta de mercaderías", "venta producto mercancia articulo unidad kit material"),
]

# Tabla oficial de coeficientes de amortización (art. 12.1.a LIS): coef. máximo % y periodo máximo (años)
AMORT_TABLE = [
    {"key": "construcciones", "label": "Edificios y construcciones", "account": "211", "rate": 3, "max_years": 68},
    {"key": "instalaciones", "label": "Instalaciones", "account": "215", "rate": 10, "max_years": 20},
    {"key": "maquinaria", "label": "Maquinaria", "account": "213", "rate": 12, "max_years": 18},
    {"key": "utillaje", "label": "Útiles y herramientas", "account": "214", "rate": 25, "max_years": 8},
    {"key": "mobiliario", "label": "Mobiliario", "account": "216", "rate": 10, "max_years": 20},
    {"key": "informatica", "label": "Equipos informáticos", "account": "217", "rate": 25, "max_years": 8},
    {"key": "transporte", "label": "Elementos de transporte", "account": "218", "rate": 16, "max_years": 14},
    {"key": "otro", "label": "Otro inmovilizado material", "account": "219", "rate": 15, "max_years": 14},
    {"key": "software", "label": "Aplicaciones informáticas", "account": "206", "rate": 33, "max_years": 6},
]

BALANCE_ACTIVO = [
    ("A) ACTIVO NO CORRIENTE", [
        ("I. Inmovilizado intangible", ["20", "280", "290"]),
        ("II. Inmovilizado material", ["21", "23", "281", "291"]),
        ("III. Inversiones inmobiliarias", ["22", "282", "292"]),
        ("IV. Inversiones en empresas del grupo y asociadas a largo plazo", ["240", "241", "242", "243", "249", "293"]),
        ("V. Inversiones financieras a largo plazo", ["25", "26", "294", "295", "296", "297", "298"]),
        ("VI. Activos por impuesto diferido", ["474"]),
    ]),
    ("B) ACTIVO CORRIENTE", [
        ("I. Activos no corrientes mantenidos para la venta", ["58", "599"]),
        ("II. Existencias", ["3", "407"]),
        ("III. Deudores comerciales y otras cuentas a cobrar", ["43", "44", "460", "470", "471", "472", "473", "544", "490", "493"]),
        ("IV. Inversiones en empresas del grupo y asociadas a corto plazo", ["530", "531", "532", "533", "534", "535", "539"]),
        ("V. Inversiones financieras a corto plazo", ["54", "565", "566", "59"]),
        ("VI. Periodificaciones a corto plazo", ["480", "567"]),
        ("VII. Efectivo y otros activos líquidos equivalentes", ["57"]),
    ]),
]
BALANCE_PASIVO = [
    ("A) PATRIMONIO NETO", [
        ("I. Capital", ["10"]),
        ("II. Prima de emisión", ["11" + "0"]),
        ("III. Reservas", ["112", "113", "114", "115", "119"]),
        ("IV. Aportaciones de socios", ["118"]),
        ("V. Resultados de ejercicios anteriores", ["12"]),
        ("VI. Resultado del ejercicio", ["__RESULT__"]),
        ("VII. Dividendo a cuenta", ["557"]),
        ("VIII. Subvenciones, donaciones y legados recibidos", ["13"]),
    ]),
    ("B) PASIVO NO CORRIENTE", [
        ("I. Provisiones a largo plazo", ["14"]),
        ("II. Deudas a largo plazo", ["15", "16", "17", "18"]),
        ("III. Pasivos por impuesto diferido", ["479"]),
    ]),
    ("C) PASIVO CORRIENTE", [
        ("I. Provisiones a corto plazo", ["499", "529"]),
        ("II. Deudas a corto plazo", ["50", "51", "52", "551", "552", "553", "555", "556", "560", "561", "569"]),
        ("III. Acreedores comerciales y otras cuentas a pagar", ["40", "41", "438", "465", "466", "475", "476", "477"]),
        ("IV. Periodificaciones a corto plazo", ["485", "568"]),
    ]),
]
PYMES_SKIP = {"IV. Inversiones en empresas del grupo y asociadas a largo plazo", "I. Activos no corrientes mantenidos para la venta",
              "IV. Inversiones en empresas del grupo y asociadas a corto plazo"}

PYG = [
    ("1. Importe neto de la cifra de negocios", ["700", "701", "702", "703", "704", "705", "706", "708", "709"]),
    ("2. Variación de existencias de productos terminados y en curso", ["71"]),
    ("3. Trabajos realizados por la empresa para su activo", ["73"]),
    ("4. Aprovisionamientos", ["60", "61"]),
    ("5. Otros ingresos de explotación", ["74", "75"]),
    ("6. Gastos de personal", ["64"]),
    ("7. Otros gastos de explotación", ["62", "631", "634", "636", "639", "65", "694", "695", "794"]),
    ("8. Amortización del inmovilizado", ["68"]),
    ("9. Imputación de subvenciones de inmovilizado no financiero", ["746"]),
    ("10. Excesos de provisiones", ["795"]),
    ("11. Deterioro y resultado por enajenaciones del inmovilizado", ["670", "671", "672", "690", "691", "692", "770", "771", "772", "790", "791", "792"]),
    ("12. Otros resultados", ["678", "778"]),
    ("__A__", "A) RESULTADO DE EXPLOTACIÓN"),
    ("13. Ingresos financieros", ["760", "761", "762", "769"]),
    ("14. Gastos financieros", ["660", "661", "662", "664", "665", "669"]),
    ("15. Variación de valor razonable en instrumentos financieros", ["663", "763"]),
    ("16. Diferencias de cambio", ["668", "768"]),
    ("17. Deterioro y resultado por enajenaciones de instrumentos financieros", ["666", "667", "673", "675", "696", "697", "698", "699", "766", "773", "775", "796", "797", "798", "799"]),
    ("__B__", "B) RESULTADO FINANCIERO"),
    ("__C__", "C) RESULTADO ANTES DE IMPUESTOS"),
    ("18. Impuestos sobre beneficios", ["630", "633", "638"]),
    ("__D__", "D) RESULTADO DEL EJERCICIO"),
]


def account_name(code: str, plan: str = "pymes") -> str:
    cat = {**ACCOUNTS, **(NORMAL_ONLY if plan == "normal" else {})}
    for n in range(len(code), 0, -1):
        if code[:n] in cat:
            return cat[code[:n]]
    return "Cuenta " + code


def catalogue(plan: str = "pymes") -> list:
    cat = {**ACCOUNTS, **(NORMAL_ONLY if plan == "normal" else {})}
    return [{"code": k, "name": v, "level": len(k)} for k, v in sorted(cat.items())]


def _norm(s: str) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", (s or "").lower()) if unicodedata.category(c) != "Mn")


def guess_category(text: str, rules) -> str:
    t = " " + _norm(text) + " "
    for cat, words in rules:
        for w in words.split(" "):
            if len(w) > 2 and w in t:
                return cat
    return ""


def match_prefix(code: str, prefixes) -> int:
    return max((len(p) for p in prefixes if code.startswith(p)), default=0)
