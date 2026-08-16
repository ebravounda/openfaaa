TEMPLATES = [
    {"id": "electricista", "name": "Electricista", "accent": "#F59E0B", "tagline": "Instalaciones y reparaciones eléctricas"},
    {"id": "fontanero", "name": "Fontanero", "accent": "#0EA5E9", "tagline": "Fontanería y climatización"},
    {"id": "fotografo", "name": "Fotógrafo", "accent": "#111827", "tagline": "Servicios fotográficos"},
    {"id": "chef", "name": "Chef / Catering", "accent": "#DC2626", "tagline": "Cocina y catering"},
    {"id": "transportista", "name": "Transportista", "accent": "#1D4ED8", "tagline": "Transporte y logística"},
    {"id": "informatico", "name": "Informático", "accent": "#7C3AED", "tagline": "Servicios informáticos"},
    {"id": "telecomunicaciones", "name": "Telecomunicaciones", "accent": "#0891B2", "tagline": "Redes y telecomunicaciones"},
    {"id": "medico", "name": "Médico", "accent": "#059669", "tagline": "Servicios médicos"},
    {"id": "dentista", "name": "Dentista", "accent": "#06B6D4", "tagline": "Clínica dental"},
    {"id": "inmobiliaria", "name": "Inmobiliaria", "accent": "#B45309", "tagline": "Servicios inmobiliarios"},
    {"id": "restaurante", "name": "Restaurante", "accent": "#E11D48", "tagline": "Restauración y hostelería"},
    {"id": "gasolina", "name": "Gasolinera", "accent": "#16A34A", "tagline": "Carburantes y estación de servicio"},
    {"id": "peluqueria", "name": "Peluquería", "accent": "#DB2777", "tagline": "Peluquería y estética"},
    {"id": "abogado", "name": "Abogado / Asesoría", "accent": "#1E3A8A", "tagline": "Servicios jurídicos y asesoría"},
    {"id": "clasico", "name": "Clásico", "accent": "#0A0A0A", "tagline": "Plantilla neutra profesional"},
    {"id": "goroky", "name": "GoRoky", "accent": "#1F6FEB", "tagline": "Factura de telecomunicaciones con aviso legal", "layout": "goroky"},
]

TEMPLATE_MAP = {t["id"]: t for t in TEMPLATES}

# Texto de pie por defecto de la plantilla GoRoky (mensaje central del pie)
GOROKY_DEFAULT_FOOTER = "Documento generado automáticamente. Gracias por confiar en GoRoky."

# Aviso legal por defecto (2ª página). Convención de formato:
#   "## Titulo"  -> encabezado de sección (azul, negrita)
#   "- texto"    -> viñeta
#   "**texto**"  -> negrita en línea
GOROKY_DEFAULT_LEGAL = """## Aviso Legal
Los Servicios de telecomunicaciones son facturados y comercializados por GOROKY (TRAMILEX GLOBAL SERVICE SL con CIF B21796925) en nombre y por cuenta de Likes Telecom (EZ EASY TELECOM SL con CIF B09883612) quien a su vez realiza la gestión de la facturación y cobro en nombre y por cuenta del operador de red que presta cada servicio según se indica a continuación:
- **Servicios de móvil y fibra:** El operador de red móvil es XFERA MÓVILES, S.A.U. con CIF A82528548 y domicilio social Parque Empresarial 'La Finca', Paseo del Club Deportivo, 1, Edif. 8, 28223 - Pozuelo de Alarcón, (Madrid - España).
- **Servicio de TV OTT:** MEDIOS AUDIOVISUALES MASMEDIA SL con CIF B88644828 como prestatario del servicio de TV OTT.
- **Resto de servicios** que no son de telecomunicaciones son comercializados por GOROKY (TRAMILEX GLOBAL SERVICE SL con CIF B21796925).

## Datos de carácter personal
En cualquier momento puedes ejercitar tus derechos de acceso, rectificación, cancelación y oposición, mediante petición escrita junto con una fotocopia de tu DNI dirigida a privacy@goroky.com, dirección Calle Segovia 22, Bajo 4, Madrid, Att. EDUARDO BRAVO. Nuestra política de protección de tus datos se encuentra recogida en las condiciones generales de contratación y legales de las tarifas, que puedes consultar en GOROKY.COM.

## Reclamaciones
El abonado deberá dirigirse al departamento o servicio especializado de atención al cliente en el plazo de un mes desde que se tenga conocimiento del hecho que motive su reclamación. Cuando el abonado presente la reclamación, el operador está obligado a facilitarle el número de referencia dado a la reclamación del usuario. Si en el plazo de un mes el usuario no hubiera recibido respuesta satisfactoria del operador, podrá dirigir su reclamación a las siguientes vías, siguiendo la normativa propia a cada organismo:
- **Secretaría de Estado de Telecomunicaciones e Infraestructuras Digitales** - Teléfono de consulta: 901 33 66 99; Página web: http://www.usuariosteleco.es
- **Juntas Arbitrales de Consumo**, directamente o a través de una Asociación de Consumidores.

## Impago
El presente aviso legal sirve como comunicación fehaciente al abonado en caso de impago de la presente factura, que conllevará las siguientes actuaciones:
- **Impago del Servicio de Telefonía Fija:** Transcurrido 1 mes desde el impago se notificará al abonado por SMS o email la suspensión temporal del servicio si tras el plazo de 48 horas desde el aviso persiste el impago, cortándose todas las llamadas excepto las dirigidas a servicios de emergencia y entrantes no facturables. Transcurridos tres meses desde la recepción de la factura y el abonado no hubiese pagado todavía, se podrá interrumpir definitivamente el servicio, dando de baja la línea y el contrato aplicando las penalizaciones que correspondan y ejercitará sus derechos para hacer efectivo el cobro. Antes de la interrupción definitiva, se realizará previo aviso con 48 horas de antelación al abonado por SMS o email.
- **Impago del Resto de Servicios:** Se suspenderá temporalmente el servicio una vez esta factura resulte impagada previa notificación con 48 horas de antelación."""
