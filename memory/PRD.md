# PRD — FiscalHub España (Sistema de Facturación)

## Problem Statement (original)
Sistema de facturación para España: crear facturas introduciendo datos (CIF/NIF) de empresa o autónomo y emitirlas. Debe mostrar cuánto pagar de IVA (según plazos/fechas de Hacienda), cuánto gasto se lleva según las compras, etc.

## User Choices
- Login con JWT (email + contraseña).
- Todos los tipos de IVA españoles (21%, 10%, 4%, 0%/exento) + IRPF (7%/15%).
- Periodicidad trimestral (Modelo 303).
- Facturas de venta + registro de gastos/compras.
- Generar PDF de cada factura + enviarla por email (Resend gestionado).

## Architecture
- Backend: FastAPI + MongoDB (motor). Módulos: `server.py`, `auth.py` (JWT httpOnly cookies), `pdf_service.py` (reportlab), `email_service.py` (Resend gestionado por Emergent).
- Frontend: React + shadcn/ui + Tailwind + Recharts + Sonner. Rutas: /login, /registro, / (Panel), /facturas, /gastos, /impuestos, /configuracion.
- Auth: seed admin (admin@fiscalhub.es / admin123).

## Personas
- Autónomo o pyme española que emite facturas y necesita controlar el IVA a pagar por trimestre.

## Core Requirements (static)
- Facturas de venta con cliente (NIF/CIF), líneas, IVA, IRPF, numeración YYYY-000N.
- Registro de gastos con IVA soportado.
- Dashboard fiscal: IVA a pagar, ingresos, gastos, beneficio, próximo vencimiento Modelo 303, gráfico por trimestre.
- Liquidación trimestral Modelo 303 con fechas oficiales (20 abr, 20 jul, 20 oct, 30 ene).
- PDF de factura + envío por email.

## Implemented (2026-06)
- ✅ Auth JWT (register/login/logout/me/refresh), brute force lockout, admin seed.
- ✅ Perfil de empresa (GET/PUT /api/company).
- ✅ Facturas: crear/listar/ver/eliminar, marcar pagada, cálculo base/IVA/IRPF/total, numeración anual.
- ✅ PDF de factura (reportlab) en /api/invoices/{id}/pdf.
- ✅ Envío de factura por email (HTML detallado, Resend gestionado). NOTA: la integración gestionada NO admite adjuntos binarios; el email lleva la factura como HTML (el PDF se descarga en la app).
- ✅ Gastos: crear/listar/eliminar con IVA soportado.
- ✅ Dashboard + Impuestos (Modelo 303 trimestral con próximos vencimientos).

## Implemented — Iteración 2 (2026-06) SaaS + IA
- ✅ SaaS multiusuario: registro con selección Autónomo/Empresa (tax_type), UI condicionada.
- ✅ Rediseño UI profesional (azul cobalto #0052FF + slate, Manrope/IBM Plex, skeletons, responsive).
- ✅ Escaneo de gastos con IA: subir imagen/PDF → OCR con OpenAI gpt-5.4 (emergentintegrations) → revisión con vista previa → guardar. Object storage gestionado. Endpoints: POST /api/expenses/scan, GET /api/files/{path}.
- ✅ Selector de ejercicio (año) en Panel e Impuestos (GET /api/available-years).
- ✅ Contactos reutilizables (clientes/proveedores): CRUD /api/contacts, autocompletado en facturas y gastos.
- ✅ Modelo 130 (IRPF pagos fraccionados) junto al 303, solo autónomos.
- ✅ Testing iteración 2: 19/19 backend + frontend 100%.

## Implemented — Iteración 3 (2026-06)
- ✅ Serie de numeración configurable por usuario (invoice_prefix en Configuración): número = {PREFIJO}-{AÑO}-{NNNN}, secuencia independiente por prefijo+año. Campo Serie y previsualización en el diálogo de factura.
- ✅ Editar facturas y gastos existentes (PUT /api/invoices/{id}, PUT /api/expenses/{id}): recalcula importes, la factura mantiene su número/serie.
- ✅ Exportar libros fiscales: GET /api/export/libros?year=&format=xlsx|csv. Excel con 3 hojas (IVA Repercutido, IVA Soportado, Resumen) y CSV. Botones en Impuestos.
- ✅ Testing iteración 3: backend + frontend 100%.

## Implemented — Iteración 4 (2026-06)
- ✅ Facturas rectificativas (abonos): invoice_type, rectifies, rectifies_number; serie propia (rectify_prefix, por defecto "R") con secuencia independiente. Botón "Crear rectificativa" que precarga cliente y líneas negadas. Badge en lista, banner en diálogo, PDF con título "FACTURA RECTIFICATIVA" y referencia a la original. Agregación correcta (negativos) en dashboard/impuestos.
- ✅ Testing iteración 4: 10/10 backend + frontend 100%.

## Nota VeriFactu (respuesta a consulta usuario)
- VeriFactu (RD 1007/2023) SÍ es integrable pero es un proyecto sustancial. Requiere: registros de facturación encadenados con hash, QR + leyenda "VERI*FACTU", y envío en tiempo real a la AEAT (o modo no verificable con firma electrónica + registro de eventos). Necesita certificado digital del contribuyente y servicio web AEAT.
- Plazos: Sociedades (IS) antes del 1 ene 2027; resto (autónomos) antes del 1 jul 2027. No confundir con factura electrónica B2B (Crea y Crece, RD 238/2026).
- Backlog P1: implementar VeriFactu (hash chain + QR + envío AEAT) — pendiente de decisión del usuario.

## Implemented — Iteración 5 (2026-06)
- ✅ VeriFactu (activable en Configuración, verifactu_enabled): por cada factura genera huella SHA-256 encadenada (spec AEAT: IDEmisorFactura, NumSerie, Fecha, TipoFactura F1/R1, CuotaTotal, ImporteTotal, Huella anterior, FechaHoraHuso), código QR (URL ValidarQR) y leyenda "VERI*FACTU" en el PDF. Envío a la AEAT SIMULADO (POST /api/invoices/{id}/verifactu/submit) — MOCKED: la transmisión real requiere certificado digital + servicio web AEAT. verifactu_service.py.
- ✅ Resumen anual: GET /api/annual-summary. Modelo 390 (IVA repercutido/soportado por tipo 21/10/4/0, resultado anual) e IRPF (rendimiento neto, retenciones, pagos fraccionados 130). Sección en Impuestos.
- ✅ Testing iteración 5: 29/29 backend + frontend 100%.

## Implemented — Iteración 6 (2026-06) VeriFactu real por usuario
- ✅ VeriFactu opcional (toggle en Configuración, verifactu_enabled).
- ✅ Certificado digital por usuario: subida .pfx/.p12 + contraseña, validado y guardado CIFRADO (Fernet, CERT_ENCRYPTION_KEY). cert_service.py (parse_pfx, cert_metadata, sign_data RSA-SHA256). Endpoints POST/GET/DELETE /api/verifactu/certificate.
- ✅ Envío VeriFactu: genera XML RegistroAlta (SuministroLR), lo FIRMA con el certificado del usuario, y registra en el log la petición SOAP y la respuesta de la AEAT (estado, CSV). Idempotente (no duplica). Transmisión real a la AEAT MOCKED (simulada).
- ✅ Panel "Conexión AEAT": estado (certificado, servicio, nº registros), log detallado (request/response XML expandible), aviso de purga.
- ✅ Log de conexión se borra automáticamente el día 3 de cada mes vía cron (.emergent/crons.yml → POST /api/cron/purge-verifactu-log, auth Bearer WEBHOOK_CRON_SECRET).
- ✅ Testing iteración 6: 10/10 nuevas + regresión; idempotencia corregida.

## Implemented — Iteración 8 (2026-06) Plantillas + búsqueda CIF
- ✅ Búsqueda por CIF/NIF al crear factura: autocompleta desde Contactos guardados (normaliza formato: puntos/guiones/prefijo ES) y valida con VIES (GET /api/lookup/nif). Nota: España no expone nombre/dirección por CIF de forma gratuita (limitación legal); para datos completos automáticos hace falta proveedor de pago (eInforma/Axesor) con API key.
- ✅ 15 plantillas de factura por sector (electricista, fontanero, fotógrafo, chef, transportista, informático, telecomunicaciones, médico, dentista, inmobiliaria, restaurante, gasolinera, peluquería, abogado, clásico). templates.py + GET /api/templates.
- ✅ Personalización por usuario: elegir plantilla, color de acento (con override) y pie de factura. Company: template_id, accent_color, invoice_footer. El PDF aplica el color al encabezado/total y añade el pie.
- ✅ Panel Conexión muestra el modo real (Simulado/Preproducción).

## Implemented — Iteración 11 (2026-06) Autoservicio de pago (Stripe) + Aviso al 80%
- ✅ Suscripciones Stripe (Flow A sandbox reclamable, país ES, EUR): el usuario básico mejora a Medio (9.99€/mes) o Platino (24.99€/mes) desde /precios; checkout en modo suscripción, cobro mensual automático. stripe_service.py (sync catálogo por lookup_key, sesión con SMP + fallback automatic_tax + sin impuestos), payments_routes.py (/api/payments/checkout, /api/payments/status/{id}, /api/stripe/webhook).
- ✅ Sincronización de plan automática: al pagar (webhook checkout.session.completed y/o polling de status) se sube el plan del usuario en MongoDB; customer.subscription.deleted lo baja a básico. PUT /api/admin/plans re-sincroniza precios en Stripe.
- ✅ Páginas /payment/success (poll + activa plan) y /payment/cancel. tax_mode = "full" (Stripe gestiona impuestos y cumplimiento, +3.5%/transacción) por ser ES + SaaS digital.
- ✅ Aviso al 80%: banner global en Layout (usage-warning-banner) + aviso ámbar/rojo y barras en /precios cuando el uso llega al 80% (ámbar) o 100% (rojo).
- ✅ Testing iteración 10/11: 11/11 nuevos + frontend 100%, sin bugs de producto (pago hosted de Stripe no automatizado, best-effort).

## Implemented — Iteración 10 (2026-06) CIF en Gastos + Planes editables + Página de Precios
- ✅ Búsqueda CIF/NIF al registrar Gastos: botón junto al NIF del proveedor (Expenses.js lookupVendorNif) reutiliza GET /api/lookup/nif; autocompleta proveedor desde contactos guardados + validación VIES.
- ✅ Planes editables por el admin: db.global_settings _id="plans" guarda overrides que se fusionan sobre DEFAULT_PLANS (plans.py load_plans/_merge_one). Endpoints GET/PUT /api/admin/plans. Editor en Admin.js (nombre, precio, facturas/mes, contactos, toggles email/ocr/verifactu). plan_for_user ahora es async y lee de BD; gating actualizado en server.py.
- ✅ Página de Precios /precios (Pricing.js, nav "Planes"): 3 tarjetas con features ✓/✗, resalta el plan actual, panel de uso con barras y aviso ámbar al alcanzar el límite. GET /api/plans (público autenticado) + GET /api/plan (plan + uso).
- ✅ Testing iteración 9/10: 12/12 nuevos + 82/82 regresión backend, frontend 100%, sin bugs.

## Implemented — Iteración 9 (2026-06) Plantilla GoRoky + Super Admin + Planes
- ✅ Plantilla "goroky": PDF de 2 páginas (factura + Aviso Legal) idéntico al ejemplo del cliente, con logo GoRoky embebido (/app/backend/assets/goroky_logo.png), cabecera+pie en cada página, tabla Concepto/Detalle/Precio y bloque de importes. pdf_service.build_goroky_invoice_pdf. templates.py: GOROKY_DEFAULT_LEGAL/FOOTER.
- ✅ Campos nuevos de factura (opcionales, usados por GoRoky): due_date (Vencimiento), period (Periodo), payment_method (Método), iban, concept_label (Concepto). Formulario en Invoices.js (sección "Datos de pago y periodo").
- ✅ Textos de plantilla editables: globales por el super admin (todos los usuarios los ven) Y sobrescribibles por cada usuario en Configuración. Cascada: usuario > global > por defecto. _merge_global_goroky en el endpoint PDF.
- ✅ Super Admin (rol admin, admin@fiscalhub.es): panel /admin (Admin.js). Gestión de usuarios (listar/buscar/uso), estadísticas, bloquear/desbloquear (login bloqueado → 403 "Tu cuenta ha sido bloqueada, contacta a soporte"), personificación (impersonate/stop-impersonate con claim JWT `imp`, banner ámbar "Volver a admin"), edición de textos globales GoRoky. admin_routes.py.
- ✅ Planes de suscripción (plans.py): basico (10 fact/mes, 10 contactos, sin email/verifactu/OCR), medio (100/100, email+OCR), platino (ilimitado, todo). Admin sin límites. Gating aplicado en create_invoice, create_contact, send-email, verifactu/submit, expenses/scan. GET /api/plan devuelve plan + uso.
- ✅ Auth: create_access_token/refresh_token soportan claim `imp`; get_current_user rechaza usuarios bloqueados y expone is_impersonating; require_admin (bloquea a impersonadores). refresh conserva `imp`.
- ✅ Testing iteración 8/9: 18/18 nuevos + 70/70 regresión backend, frontend 100%, sin bugs.

## Backlog (prioritized)
- P1: Adjuntar PDF binario al email (bloqueado: la integración gestionada de Resend no soporta adjuntos actualmente).
- P2: Búsqueda por CIF también al registrar Gastos (autocompletar proveedor).
- P2: Editar los límites/precios de los planes desde el panel admin (ahora son fijos en plans.py).
- P2: Registro de actividad/logs de admin visible en UI (ya se guarda en db.admin_audit).
- P2: Sugerir plantilla por defecto según tipo de actividad al registrarse.
- P3: Refactor server.py (960+ líneas) en routers (verifactu, invoices, contacts).
- P3: Validación defensiva de ObjectId en admin_routes (evitar 500 con id malformado).
