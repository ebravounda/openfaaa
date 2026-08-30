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

## Implemented — Iteración 13 (2026-06) UX móvil estilo Holded + anulación/IRPF/IA/validación
- ✅ **Responsive móvil**: Layout.js con barra superior (hamburguesa) y **drawer deslizable** con backdrop en móvil; sidebar fijo solo en lg+. Formularios apilan en móvil. Verificado por testing agent (iteration_13, 100%). Corrige "el menú tapaba el panel en móvil".
- ✅ **Anular con VeriFactu**: botón Anular (RegistroAnulación, huella encadenada), estado ANULADA, sello rojo en PDF, excluida de impuestos. Doble anulación bloqueada (backend verifactu_service + server /invoices/{id}/anular).
- ✅ **IRPF**: sugerencia 7% nuevo autónomo (año alta + 2), 15% general, 0% empresas. Campo "Fecha de alta" en Configuración. GET /api/irpf/suggestion.
- ✅ **Asistente IA** (OpenAI vía Emergent key): chat flotante FiscalBot + "Revisar con IA" en el formulario. spanish_tax.py (validador NIF/NIE/CIF) + ai_service.py.
- ✅ **Validación de factura**: NIF/CIF con dígito control, IVA∈{0,4,10,21}, IRPF 0-47, conceptos y cliente obligatorios (422). Factura anulada no editable.
- ✅ Testing iteración 12 (features) + 13 (móvil): verde, sin bugs de producto.


## Implemented — Iteración 12 (2026-06) Gestión de suscripción + Historial + Auditoría + Plantilla por actividad
- ✅ Cancelar/gestionar suscripción: portal de cliente de Stripe (POST /api/payments/portal, stripe_service.ensure_portal_configuration/create_portal_session). Webhooks customer.subscription.updated (cambio de plan) y .deleted (baja → básico) sincronizan el plan.
- ✅ Historial de pagos: GET /api/payments/history (facturas de Stripe del cliente); tabla en /precios (payment-history) con fecha, importe, estado y enlace a factura. Botón "Gestionar / cancelar suscripción" visible solo en planes de pago.
- ✅ Registro de actividad (admin): db.admin_audit + GET /api/admin/audit (enriquecido con emails vía $in). Sección "Registro de actividad" en /admin (quién bloqueó/personificó/cambió plan/editó plantillas y cuándo).
- ✅ Plantilla por actividad: selector de sector en /registro; se guarda en el usuario y GET /api/company sugiere template_id según la actividad para usuarios sin empresa creada; Settings lo preselecciona.
- ✅ Testing iteración 11/12: 16/16 nuevos + frontend 100%, sin bugs.

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

## Implemented — Iteración 14 (2026-06) Trial + Landing + Plan Anual + Panel MRR
- ✅ **Prueba de 14 días**: al registrarse, auth.py asigna trial_ends_at = now+14d; plans.plan_for_user devuelve TRIAL_PLAN (todas las funciones) mientras el trial esté activo y el plan sea básico. Banner de días restantes en Layout (data-testid trial-banner, oculto para admin y planes de pago).
- ✅ **Landing pública** ('/' sin sesión): OpenFactura.es con hero, features y CTAs (Landing.js). Rutas legales '/terminos' y '/privacidad' (Legal.js). Pantalla de Bienvenida '/bienvenida' tras el registro (Welcome.js).
- ✅ **Plan Anual (Stripe)**: toggle mensual/anual en /precios (billing-cycle-toggle); precio anual = mensual×10 (2 meses gratis) con nota de ahorro. checkout envía cycle; stripe_service crea Prices yearly (lookup plan_*_yearly). Verificado: checkout con cycle=yearly devuelve URL checkout.stripe.com.
- ✅ **Panel de Ingresos (Super Admin)**: GET /api/admin/revenue (MRR, ARR, by_plan, altas_mes, trials_activos). Panel 'Ingresos y suscripciones' en /admin (revenue-panel) con tarjetas y badges por plan.
- ✅ Bug crítico corregido: Layout.js referenciaba trialDays sin definir (pantalla en blanco en rutas autenticadas). Testing iteración 14: 7/7 backend + frontend 100% tras el fix.

## Implemented — Iteración 15 (2026-06) Landing rediseñada estilo Holded
- ✅ Landing.js reconstruida al estilo holded.com/es (petición explícita del usuario): fuente Outfit, acento cobalto #0052FF, secciones alternas claras/oscuras. Estructura: promo bar, nav sticky con blur, hero split con mockup de dashboard flotante + badge VeriFactu, franja de stats animadas, 5 módulos zig-zag con mockups de producto en HTML/Tailwind (dashboard, factura, Modelo 303, escáner OCR, chat FiscalBot), sección oscura "Por qué OpenFactura" (bento 6 razones), testimonios, audiencias (Autónomos/Pymes/Asesorías), franja de integraciones y CTA final azul. Animaciones con framer-motion (fade-up al hacer scroll, staggered, barras animadas). Sin fotos de stock. Verificado por screenshot (hero, features, sección oscura).

## Implemented — Iteración 16 (2026-06) SEO + Endurecimiento de seguridad
- ✅ **SEO integral (landing)**: index.html con title/description optimizados, keywords, canonical, robots, geo-tags (España), Open Graph + Twitter Cards con imagen social (og-image.jpg), y JSON-LD (Organization, WebSite, SoftwareApplication con rating, Service con areaServed de 14 ciudades, FAQPage). robots.txt, sitemap.xml y manifest.json en /public. Sección visible "Cobertura nacional" con 20 ciudades (Madrid, Barcelona, Valencia, Sevilla, Málaga, Granada, Fuengirola…). NOTA: es una SPA (CSR); para posicionar debe desplegarse en el dominio real openfactura.es. Meta por-página requeriría react-helmet + SSR/prerender (pendiente).
- ✅ **Logo OpenFactura by GoRoky**: integrado en landing (nav+footer), Login (variante blanca), Registro, y Layout (sidebar + topbar móvil). Optimizado a 42KB/28KB. Precarga con prioridad alta.
- ✅ **Seguridad (security.py SecurityMiddleware)**: cabeceras HTTP (nosniff, X-Frame-Options DENY, HSTS, Referrer-Policy, Permissions-Policy), protección CSRF vía cabecera `X-OF-Client: web` (frontend axios la envía; exentos webhook Stripe y cron), límite de tamaño (12MB global, cert 5MB, OCR 10MB), oculta header Server. Validación de fuerza de contraseña (min 8, letras+números) y throttle de registro (5/h por IP). re.escape en búsqueda de admin (anti regex/NoSQL injection). Docs FastAPI deshabilitados (404). Check de JWT_SECRET en arranque.
- ✅ Testing iteración 14 (seguridad): 14/14 backend + 0 regresiones CSRF en la UI (frontend 100%).

## REGLA PERMANENTE — Independencia y servidor Plesk
- El servidor Plesk del usuario aloja OTRAS plataformas (ingresoqr.com, gym24.app, tramilex, goroky y varios contenedores). **PROHIBIDO tocar cualquiera de ellas.** openfactura.es debe ser 100% independiente: su propio dominio, su propia base de datos MongoDB (MONGO_URL/DB_NAME propios), sus propias variables de entorno. Nada compartido ni referenciado entre plataformas.

## Implemented — Iteración 17 (2026-06) SEO por página + Preparación de despliegue independiente
- ✅ **SEO por página (react-helmet-async@3.0.0)**: componente `Seo` (`components/Seo.jsx`) con title/description/canonical/OG/Twitter únicos. Aplicado a Landing (/), Login, Registro, Términos y Privacidad (indexables) y noindex en páginas privadas (vía Layout + Welcome). index.html limpiado: solo etiquetas globales (keywords, geo, JSON-LD, fuentes, favicon, manifest); las per-page las gestiona Helmet (sin duplicados). Verificado en navegador: 1 sola meta description por página, canonical y robots correctos.
- ✅ **Preparación de despliegue (independiente en Plesk)**: guía completa en `/app/DEPLOYMENT.md` (BD Mongo propia `openfactura_prod`, usuario dedicado, systemd con puerto exclusivo, build React, proxy nginx solo del vhost, HTTPS, cron con secreto, webhook Stripe, checklist de independencia). Fix bloqueadores del deployment_agent: (1) cron purge-verifactu-log ahora borra SOLO registros >60 días (ya no `delete_many({})`); (2) CORS usa `CORS_ORIGINS` (multi-origen, coma) con fallback `FRONTEND_URL`. NOTA: CORS NO se pone en `"*"` a propósito (rompería cookies con credentials).

## Implemented — Iteración 18 (2026-06) Producción Plesk + IVA por línea + Fixes + Panel Integraciones
- ✅ **Despliegue backend en Plesk (SELinux)**: resuelto el fallo de `openfactura-api.service`. Causa: `EnvironmentFile` dentro del vhost + SELinux Enforcing. Solución: `.env` movido a `/etc/openfactura/openfactura.env` (contexto etc_t legible por systemd) + reetiquetado del venv a `bin_t` (`semanage fcontext`) para permitir la transición del servicio. Backend VIVO en 127.0.0.1:8712. Frontend build publicado en httpdocs + `.htaccess` (fallback SPA) + proxy nginx `/api`→8712. Admin producción: soporte@goroky.com.
- ✅ **IVA por línea (conjunto legal ES)**: `LineItem` con `iva_rate` + `iva_type` (general|exento|no_sujeto|suplido) e `InvoiceInput.recargo_equivalencia`. `compute_invoice` recalcula base (excluye suplidos), `iva_breakdown` por tipo, recargo de equivalencia (21→5,2 / 10→1,4 / 4→0,5), IRPF sobre base general+exenta. PDF (estándar + GoRoky), Modelo 303/390 y libros (xlsx/csv) agregando por `iva_breakdown`. IRPF sigue GLOBAL. Testing iter 15: 9/9 backend + frontend 100%.
- ✅ **Fixes**: (1) PDF cabecera "FACTURA" ya no se solapa con Nº/fecha (leading). (2) NIE/DNI aceptado en `/api/lookup/nif` aunque VIES no lo devuelva (validación local; VIES solo para nombre/dirección). (3) Numeración: `_next_seq` (max secuencia+1 o `invoice_start_number`), endpoint `GET /api/invoices/next-number`, número siguiente mostrado en el formulario; vencimiento automático (+`invoice_due_days`, def. 15). Campos nuevos en Configuración. (4) Placeholder "TRAMILEX…" eliminado.
- ✅ **Panel Integraciones (Super Admin)** `GET/PUT /api/admin/integrations` (secretos cifrados con Fernet/CERT_ENCRYPTION_KEY, enmascarados al leer): 
  - **Resend (self-hosted, API propia)**: `email_service.send_email` usa Resend directo (api.resend.com) cuando hay api_key configurada; fallback al email gestionado Emergent si no. Campos: api_key, from_email (dominio verificado), from_name, reply_to. (Soporte confirmó que en self-hosted SÍ se permite API propia.)
  - **Stripe (API propia)**: secret/publishable/webhook/mode; `payments_routes` aplica la clave de BD con prioridad sobre `.env` (incl. webhook secret dinámico).
  - **Asistente IA (proveedor a elección)**: emergent (universal key) | openai (LlmChat, clave propia) | groq (API directa OpenAI-compatible). `ai_service._complete` unificado. Modelo configurable.
- ⚠️ **Pendiente de REDESPLIEGUE en producción**: los errores de "Anular" y "enviar por correo" en openfactura.es (Cloudflare 5xx) se deben a que el servidor tenía código anterior; en preview funcionan. Hay que hacer git pull + `yarn build` + `systemctl restart openfactura-api` para aplicar todos estos cambios.

## Implemented — Iteración 19 (2026-06) Holded fields + Vista previa PDF + Email de prueba + DESPLIEGUE PRODUCCIÓN
- ✅ **Campos tipo Holded en factura**: descuento por línea (`LineItem.discount`), descuento global (`InvoiceInput.global_discount`), concepto + descripción larga (`LineItem.detail`), total por línea. `compute_invoice` calcula `subtotal`, `discount_total` y bases netas (suplidos sin descuento). PDF con columna Dto. + filas Subtotal/Descuento. Testing iter 16: 100% backend + frontend.
- ✅ **Vista previa PDF real** en Configuración: `POST /api/company/preview-pdf` genera miniatura PNG (pymupdf) de una factura de muestra con los ajustes actuales; se actualiza (debounce) al cambiar plantilla/color/textos.
- ✅ **Email de prueba** en panel admin: `POST /api/admin/test-email` (usa la config de Resend guardada o el email gestionado como fallback).
- ✅ **DESPLEGADO EN PRODUCCIÓN (openfactura.es)**: git pull + pip install + restart backend (systemd `active`) + `yarn build` + publicado en httpdocs. Verificado end-to-end: frontend 200, API viva por dominio (Cloudflare→Nginx→uvicorn:8712), login admin OK (soporte@goroky.com). Falta que el usuario configure sus claves reales (Resend/Stripe/OpenAI/Groq) en /admin → Integraciones y validar anular/correo en el dominio real.

## Implemented — Iteración 21 (2026-06) Logo propio por empresa en todas las plantillas PDF
- ✅ **Logo de empresa en el PDF (todas las plantillas)**: el usuario sube su logo en Configuración → sección Plantilla. `CompanyInput.logo` (data URL base64). Endpoints `POST /api/company/logo` (valida imagen, normaliza a PNG con Pillow, thumbnail ≤700px, máx 2 MB) y `DELETE /api/company/logo`. `PUT /api/company` conserva el logo si el form no lo reenvía. `pdf_service` renderiza el logo: en la plantilla estándar (cabecera izquierda, sobre el nombre, helpers `_logo_bytes/_logo_reader/_logo_flowable`) y en GoRoky (usa el logo del usuario si existe, si no el fijo de GoRoky). `preview-pdf` incluye `logo`. Frontend `Settings.js`: uploader con preview, botones Subir/Cambiar/Quitar, integrado en la vista previa en vivo. Verificado por PDF real (logo visible en plantilla clásica y GoRoky).

## Implemented — Iteración 22 (2026-06) VeriFactu: RCA error 4103 + FechaExpedicion en encadenamiento
- ✅ **RCA error 4103 (parse XML AEAT)**: el usuario pegó el XML enviado desde PRODUCCIÓN. Diagnóstico confirmado: producción ejecuta CÓDIGO ANTIGUO (prefijo `sf:` con namespace obsoleto `.../tikeV1.0/SistemaFacturacion.xsd`, `xmlns:sf` declarado dentro de `RegistroAlta` → XML mal formado, sin wrapper `RegistroFactura`). El código actual del repo ya genera XML correcto (verificado bien formado): namespaces `sum`/`sum1` en el Envelope, `<sum:RegistroFactura>`, `ClaveRegimen`, `CalificacionOperacion`, `SistemaInformatico` completo y `Encadenamiento`. → SOLUCIÓN: redesplegar producción (git pull + restart) y reenviar la factura.
- ✅ **Fix encadenamiento**: `verifactu_submit` y `anular_invoice` (server.py) ahora obtienen la `issue_date` de la factura anterior y la pasan como `prev_fecha` a `build_registro_alta_xml`/`build_registro_anulacion_xml`, de modo que `RegistroAnterior/FechaExpedicionFactura` ya no va vacía (evitaría un error de validación tras el parseo). Verificado: ambos XML bien formados con la fecha presente.
- ⚠️ PENDIENTE: no verificable contra la AEAT desde preview (requiere el certificado del usuario en preproducción). Confirmar tras redesplegar producción y reenviar.

## Implemented — Iteración 23 (2026-06) VeriFactu: fix error 1110 (SistemaInformatico)
- ✅ **4103 RESUELTO en producción** (tras redesplegar): la AEAT ya parsea el XML. Nuevo error de negocio **1110**: "Error en el bloque de SistemaInformatico. El NIF no está identificado en el censo... NIF:Z3452060H, NOMBRE_RAZON:OpenFactura". Causa: enviábamos `SistemaInformatico/NombreRazon=OpenFactura` con el NIF del obligado; la AEAT valida el par NombreRazon+NIF del PRODUCTOR contra su censo y el NIF Z3452060H está censado como "Eduardo Bravo Unda".
- ✅ **Fix**: `_sistema_informatico(nif, nombre_razon)` ahora usa el NombreRazon del propio obligado (software de uso propio → productor = obligado). `NombreSistemaInformatico` sigue siendo "OpenFactura". Callers en alta y anulación pasan `company['name']`. Verificado: XML lleva NombreRazon=Eduardo Bravo Unda.
- ✅✅ **HOMOLOGADO EN PREPRODUCCIÓN AEAT**: factura GRKY-2026-0007 devuelve `<EstadoEnvio>Correcto</EstadoEnvio>` + `<EstadoRegistro>Correcto</EstadoRegistro>` + CSV `A-68VNLQ7RKHNZCS`. Recorrido resuelto: 4103 (namespaces/parseo) → 1110 (SistemaInformatico NombreRazon) → Correcto.
- 📌 **URLs de PRODUCCIÓN listas** (pendiente de activar por el usuario): cert estándar `https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP`; sello `https://www10.agenciatributaria.gob.es/...`; QR prod ya correcto (www2). Falta wiring `mode==produccion` en `send_to_aeat`/server.py.

## Implemented — Iteración 24 (2026-06) VeriFactu: Producción real activada (multi-tenant)
- ✅ **Modo Producción AEAT**: `verifactu_service.aeat_url(produccion, seal)` con 4 hosts (preprod/prod × personal/sello). `send_to_aeat(produccion, seal)`. `server.py` (verifactu_submit y anular) envían real cuando `mode in (preproduccion, produccion)`, con `entorno` dinámico en los mensajes y el log. QR ya usa host prod cuando mode==produccion.
- ✅ **Multi-tenant por certificado**: `CompanyInput.verifactu_cert_type` (personal|sello) elige host `www1` (persona física/representante) o `www10` (sello de entidad). Cada usuario configura su NIF/nombre/certificado.
- ✅ **UI Settings**: selector de modo con opción "Producción AEAT (envío legal y definitivo)", selector de tipo de certificado, y aviso ámbar de irreversibilidad al elegir Producción. Textos obsoletos ("simulación") actualizados. Verificado routing de los 4 hosts + UI por screenshot.

## Implemented — Iteración 25 (2026-06) VeriFactu: rectificativa conforme (R1)
- ✅ **Rectificativa VeriFactu completa**: `build_registro_alta_xml` añade `TipoRectificativa=I` (por diferencias, coherente con el abono en negativo de la app) y `FacturasRectificadas/IDFacturaRectificada` (IDEmisor + NumSerie + FechaExpedicion de la original), obligatorios para R1-R5. `verifactu_submit` busca la factura original por `rectifies` y pasa `rectified={number,fecha}`. Verificado: XML bien formado con TipoFactura R1 + bloque rectificativo. Sin esto la AEAT habría rechazado las rectificativas.

## Implemented — Iteración 26 (2026-06) Tooltips en botones de acción de Facturas
- ✅ **Tooltips descriptivos** (shadcn/radix) en todos los botones de la columna Acciones de /facturas, sustituyendo los `title` nativos: VeriFactu (Enviar a la AEAT / Registrada · CSV), Crear rectificativa, Editar, Ver/descargar PDF, Enviar por email, Marcar pagada/pendiente (dinámico), Anular, Eliminar. Helper `Tip` + `TooltipProvider` (delay 150ms). Verificado por screenshot.

## 🏁 HITO — VeriFactu en PRODUCCIÓN REAL (2026-08-30)
- ✅✅✅ **Alta (F1)**: factura GRKY-2026-0008 → EstadoRegistro=Correcto, CSV `A-FKWVCHJ35EULQ8`.
- ✅✅✅ **Rectificativa (R1)**: R-2026-0005 con `TipoRectificativa=I` + `FacturasRectificadas` (ref. GRKY-2026-0008) → EstadoRegistro=Correcto, CSV `A-T97FFHYYRSV7AZ`. Encadenamiento correcto.
- Endpoint PROD `www1.agenciatributaria.gob.es`, firmado con certificado real (BRAVO UNDA EDUARDO ANDRES - Z3452060H). Ciclo completo alta+rectificativa homologado. Recorrido: 4103 → 1110 → Correcto(preprod) → 1114 → Correcto(PROD alta+rectificativa).

## Implemented — Iteración 27 (2026-06) VeriFactu: CSV real + estado según respuesta AEAT
- ✅ **Bug crítico**: el CSV impreso en el PDF era un placeholder (`VF-...`) y la factura se marcaba "Aceptada" solo por HTTP 200, ignorando `EstadoRegistro`. `verifactu_service.parse_aeat_response` extrae CSV/EstadoEnvio/EstadoRegistro/CodigoError/Descripcion de la respuesta SOAP. `verifactu_submit` y `anular` ahora: (1) marcan Aceptada solo si `EstadoRegistro=Correcto`; (2) guardan el CSV REAL de la AEAT; (3) si `Incorrecto`, marcan Rechazada con el código+descripción del error. Verificado con las respuestas reales (CSV `A-T97FFHYYRSV7AZ` y error 1114).
- ✅ Endpoint de backfill `POST /api/verifactu/refresh-csv`: relee el log y corrige el CSV de facturas ya enviadas que tuvieran placeholder.
- ✅ **Auto-heal en `/invoices/{id}/pdf`**: si el CSV guardado es placeholder (`VF-`) o vacío, recupera el CSV real del `verifactu_log.response_xml` y actualiza la factura antes de generar el PDF. Así basta redesplegar + re-descargar el PDF (sin pasos manuales).
- ✅ **Fix pantalla Conexión**: (1) el badge del log ahora muestra "Producción" (verde) / "Preprod" (azul) / "Simulado" — antes producción se etiquetaba erróneamente como "Simulado"; (2) el header "Estado del servicio" contempla el modo producción; (3) `/verifactu/connection-log` auto-corrige el CSV placeholder de cada entrada leyendo el CSV real de la respuesta guardada.

## Implemented — Iteración 28 (2026-06) Cobros con Stripe (BYOK por usuario)
- ✅ **Stripe por tenant**: cada usuario conecta SU cuenta Stripe (clave secreta propia, cifrada en company doc). Endpoints: `POST/GET/DELETE /api/stripe/connect|status` (valida con `stripe.Account.retrieve(api_key=...)`, guarda nombre de cuenta + charges_enabled + modo live/test).
- ✅ **Enviar Cobro**: `POST /api/invoices/{id}/send-payment` crea Checkout Session (EUR, importe de la factura, tarjeta) con la clave del usuario, guarda `payment_transactions` + `invoice.payment`, y envía email al cliente con botón "Pagar" (`build_payment_email_html`) + **PDF adjunto** (Resend con attachments base64). success_url `/pago/exito`, cancel_url `/pago/cancelado`.
- ✅ **Marcar pagada automáticamente**: página pública `/pago/exito` (polling) → `GET /api/public/payment-status/{session_id}` (sin auth) recupera la sesión con la clave del usuario y, si `paid`, marca la factura `status=paid` + tx paid. Sin necesidad de configurar webhooks por usuario.
- ✅ **UI**: Configuración → "Cobros con tarjeta" (logo Stripe #635BFF, input clave, Conectar/Desconectar, estado "Conectada: {cuenta}", mini tutorial con enlaces a registro y claves API). Facturas → botón "Enviar Cobro" (icono tarjeta, tooltip) visible si no pagada/anulada. Páginas públicas PagoExito/PagoCancelado.
- ⚠️ **No verificable end-to-end en preview** (requiere una clave Stripe real del usuario). Verificado: validación de claves, endpoints (401/404/validación), UI por screenshot, y que la creación de Checkout Session usa parámetros correctos (la SDK llega a la validación de Stripe).

## Implemented — Iteración 29 (2026-06) Stripe: blindaje anti-bloqueo (Cloudflare 52x)
- ✅ El SDK `stripe` es síncrono; dentro de endpoints async podía bloquear el event loop del worker → posibles 502/520 en producción. Envueltas las 3 llamadas (`Account.retrieve`, `checkout.Session.create`, `checkout.Session.retrieve`) en `asyncio.to_thread(...)` con `timeout` (15-20s) para que fallen rápido y no bloqueen. Verificado: clave inválida devuelve 400 en <25s.

## Implemented — Iteración 30 (2026-06) Fix email: mensaje real en vez de Cloudflare 502
- ✅ **RCA del "error Cloudflare" al enviar email**: Resend devolvía 403 ("The openfacura.es domain is not verified") y el backend respondía HTTP 502, que Cloudflare/Plesk sustituían por su página de error genérica. Cambiado `_send_via_resend` y el fallback para devolver **400 con el mensaje real** (detecta dominio no verificado y guía a resend.com/domains). Ahora el usuario ve el motivo exacto en la app. Causa de negocio: el `from_email` usa `openfacura.es` (dominio no verificado en Resend / typo de openfactura.es).

## Implemented — Iteración 31 (2026-06) Métodos de pago en el menú
- ✅ Nueva página dedicada `/metodos-pago` (`pages/PaymentMethods.js`) con toda la config de Stripe (conectar/estado/desconectar + tutorial + "cómo funciona"). Ítem "Métodos de pago" en el menú lateral (icono tarjeta, entre Conexión y Planes; Planes pasa a icono Landmark). Retirada la sección Stripe duplicada de Configuración. Verificado por screenshot.

## Implemented — Iteración 32 (2026-06) Fix Stripe: quitar parámetro `timeout` inválido
- ✅ Bug "Received unknown parameter: timeout": el SDK de Stripe interpretaba `timeout=` (pasado a los métodos de recurso) como parámetro de la API → rechazaba la petición. Quitado de `Account.retrieve` y `checkout.Session.create`. El `asyncio.to_thread` ya evita el bloqueo del event loop. Verificado tras redeploy.

## Implemented — Iteración 33 (2026-06) Landing actualizada con Cobros/Stripe + RedSys próximamente
- ✅ Nuevo módulo "Cobros — Cobra con tarjeta por Stripe" en la landing (con `PaymentMockup`: importe, tarjeta, botón Pagar #635BFF, "se marca pagada al instante"). Bullets: Enviar Cobro, marca pagada automática, "Próximamente RedSys". Nav con enlace #cobros; ids de módulos por `m.id` (no por índice). Facturación resalta "plantillas personalizables con tu logo". Integraciones: chip "RedSys · Próximamente" (badge punteado). Razón "Cobros con tarjeta" añadida. Hero menciona cobros y plantillas. Verificado por screenshot.

## Backlog (prioritized)
- P1: Campos tipo Holded en factura: descuentos (línea/global), concepto+descripción separados, total por línea, número editable.
- P2: Editar límites/precios de planes desde admin (ahora fijos en plans.py).
- P2: Vista previa en vivo del PDF al cambiar colores/plantilla.
- P3: Refactor server.py en routers (verifactu, invoices, contacts).

## Implemented — Iteración 20 (2026-06) Guía Factura Rectificativa + PWA
- ✅ **Guía paso a paso de Factura Rectificativa** (petición explícita del usuario): componente `components/RectificativaGuide.jsx` — modal de 6 pasos con base legal (RD 1619/2012 art. 15, art. 80 Ley IVA), cuándo emitirla, datos obligatorios, formas (diferencias vs sustitución), tipos R1–R5 de VeriFactu, y cómo hacerlo en la app. Checkbox **"No mostrar más"** (persistido en localStorage `of_rectify_guide_dismissed`). Se abre automáticamente al pulsar "Crear rectificativa" (si no está descartada; si lo está, va directo) y desde el botón **"Guía rectificativa"** en la cabecera de /facturas. `openRectify` → guía → `doRectify`. Verificado por screenshot.
- ✅ **PWA instalable**: `public/service-worker.js` (cache app-shell, network-first en navegación SPA, cache-first estáticos, ignora /api y orígenes externos), registrado en `index.js`. `manifest.json` con iconos 192/512 maskable (`pwa-icon-192.png`/`pwa-icon-512.png` generados con marca cobalto), scope, orientation y categories. index.html con apple-touch-icon 192 + metas apple/mobile-web-app. Verificado: SW/manifest/iconos responden 200 en preview.

## PENDIENTE DE USUARIO (no bloqueante para lo anterior)
- 🟠 **VeriFactu XML (AEAT preproducción, error 4103)**: a la espera de que el usuario envíe una factura en modo Preproducción y pegue la respuesta SOAP literal de la AEAT para seguir depurando `verifactu_service.py`. NO activar endpoint de PRODUCCIÓN hasta recibir `<EstadoRegistro>Correcto</EstadoRegistro>`.
- 🔵 **Logos dinámicos por plantilla PDF**: requiere decisión de qué logos/assets por sector (actualmente solo GoRoky tiene logo fijo).
- 🟣 **eInforma/Axesor**: requiere API key de pago del usuario para autocompletar nombre/dirección por CIF.

## Implemented — Iteración 35 (2026-06) Storage GridFS + Intracomunitario + Multiempresa + Plan Multiempresas
- ✅ **Storage self-hosted (P0)**: `storage_service` usa **MongoDB GridFS** cuando `USE_LOCAL_STORAGE=true` (bucket `uploads`), en vez del Object Storage de Emergent (401 en Plesk). Funciona en preview (flag off → Emergent) y self-hosted (flag on → su propia Mongo). `put_object/get_object` ahora async; call sites actualizados. Verificado roundtrip GridFS.
- ✅ **Facturación intracomunitaria**: nuevo `iva_type="intracomunitaria"` (exenta art. 25 / inversión sujeto pasivo). compute → `base_intracom` (dentro de base_exenta). PDF con leyenda legal ES/EN. VeriFactu: desglose parte E1 (exento puro) + **E5** (intracomunitaria) sin romper S1. Resumen anual añade Modelo 349 (operaciones por cliente) y base intracom en 390. Opciones en Invoices+Quotes. Verificado: factura mixta IVA solo sobre base general; E5 en XML.
- ✅ **Multiempresa (agencias)**: una cuenta gestiona varias empresas/autónomos. `db.companies` con `id` propio; `user.active_company_id` + `multi_company_enabled`. Datos (facturas/gastos/contactos/presupuestos/certificados/verifactu_log/files/pagos) scoped por `company_id`; migración transparente que hace backfill de datos legacy. Numeración y **cadena de huellas VeriFactu independientes por empresa**. Certificado, plantilla y Stripe por empresa. Endpoints `/api/companies` (CRUD), `/switch`, `/multi-toggle`. Frontend: selector de empresa en sidebar + página `/empresas` (acordeón por empresa, activar multiempresas, crear/editar/eliminar, "ver contabilidad"). Verificado E2E: empresa 2 (B-2026-0001) aislada de las 117 facturas de empresa 1.
- ✅ **Plan Multiempresas**: `multiempresas` (49,99€, 20 empresas) y `multiempresas_50` (89,99€*, 50 empresas) con `max_companies` + feature `multi_company`. Gating al crear empresas. Formulario "necesito más empresas" → `POST /api/contact-sales` (email a soporte@goroky.com). Stripe lookup keys añadidas para los nuevos planes. (*precio del tramo 50 provisional, editable por admin.)

## Implemented — Iteración 38 (2026-06) Página /precios pública + Blog + Rectificativa por Sustitución
- ✅ **/precios pública e indexable**: `PreciosRoute` sirve marketing (`PreciosPublic.jsx`) a anónimos y el panel de upgrade (`Pricing`) a usuarios logueados. Incluye 4 planes (con Multiempresas), tabla comparativa, FAQ con FAQPage JSON-LD y CTAs a /registro. Verificado visualmente.
- ✅ **Blog** (`/blog`, `/blog/:slug`): índice + 3 artículos ("Cómo facturar como autónomo", "VeriFactu explicado", "IVA e IRPF modelos 303/130") en `blogData.js`, con Seo por post y **Article JSON-LD** (react-helmet-async). Enlazado desde footer del landing. Verificado.
- ✅ **Rectificativa por Sustitución (S)**: `InvoiceInput.rectify_type` ("I" diferencias / "S" sustitución). En el submit se recuperan base/cuota/recargo de la factura original y VeriFactu añade `<TipoRectificativa>S` + `<ImporteRectificacion>` (BaseRectificada/CuotaRectificada/CuotaRecargoRectificado); la "I" no lo incluye. Frontend: selector en el diálogo de rectificativa que ajusta el signo de los importes. Verificado XML.
- ✅ **Sitemap** actualizado con /precios, /blog y los 3 posts. robots.txt sin cambios.

## Implemented — Iteración 37 (2026-06) Landing (planes + novedades) + Legal + SEO
- ✅ **Landing**: nueva sección **Novedades** (Presupuestos, Multiempresa, Facturación intracomunitaria, Cobro con tarjeta) y sección **Precios** con los 4 planes incluido **Multiempresas 49,99€/20** + nota de plan 50/ a medida (mailto soporte@goroky.com). Nav "Precios" → ancla #precios. Sección "alternativa a Holded/FacturaDirecta/Quipu/Billin".
- ✅ **Legal** (`Legal.js`): Términos (identificación GoRoky, planes, propiedad intelectual, ley aplicable, contacto soporte@goroky.com) y Privacidad (RGPD/LOPDGDD ampliado, encargados Stripe/Resend/IA, derechos + AEPD, seguridad) mejorados. Rutas /terminos y /privacidad ya existían y están en sitemap + footer.
- ✅ **SEO**: keywords con términos de competidores y nuevas funciones; `featureList` y **2 nuevas FAQ** (alternativa a competidores, multiempresa) en el JSON-LD (validado); robots.txt actualizado (bloquea /panel,/presupuestos,/empresas,/metodos-pago). Base SEO previa intacta (meta, OG/Twitter, hreflang, canonical vía Seo).
- ⚠️ Nota SEO: la indexación en Google requiere acciones off-site del usuario (verificar dominio en Google Search Console y enviar sitemap). App es SPA (CRA); el contenido se renderiza en cliente.
- ✅ **Banner "estás configurando la empresa X"**: componente `ActiveCompanyBanner` en Configuración, Conexión AEAT y Métodos de pago (solo visible en cuentas multiempresa o con >1 empresa), con enlace a `/empresas`. Deja claro que certificado/plantilla/cobros son por empresa.
- ✅ **Badges en el listado de facturas**: columna Estado ahora muestra (1) estado de cobro — "Pagado con tarjeta" (verde, cuando `payment.status==="paid"` vía Stripe), "Pagada" (manual), "Pendiente" o "Anulada"; y (2) estado VeriFactu — "VeriFactu ✓" (verde, tooltip con el CSV real) si `verifactu.submitted`, "VeriFactu ✕" (rojo, tooltip motivo) si rechazada, "VeriFactu ⏳" (ámbar) si pendiente de envío. Verificado contra datos reales (28 facturas registradas con CSV).

## Implemented — Iteración 34 (2026-06) Presupuestos (Fase 1 del nuevo backlog)
- ✅ **Presupuestos (quotes)**: nueva sección `/presupuestos` (menú lateral, icono FileSignature). Modelo `QuoteInput` + colección `db.quotes`, numeración propia serie "PRE" (`quote_prefix` en Company), estados borrador/enviado/aceptado/rechazado/facturado. Reutiliza `compute_invoice` (IVA por línea, descuentos, IRPF, RE, suplidos). Backend: GET/POST/PUT/DELETE `/api/quotes`, `/api/quotes/next-number`, PATCH `/status`, `/pdf`, `/send-email` (PDF adjunto, gated por plan email), `/convert`.
- ✅ **Convertir en factura**: `POST /api/quotes/{id}/convert` genera la factura definitiva (reutiliza `_make_invoice`, respeta límite de plan y encadenamiento VeriFactu), marca el presupuesto `facturado` con ref. a la factura; doble conversión bloqueada (400). El presupuesto NO se envía a VeriFactu (no es fiscal).
- ✅ **PDF**: `build_invoice_pdf` con `doc_type="presupuesto"` → título "PRESUPUESTO", línea "Válido hasta", sin QR/VeriFactu, fuerza plantilla estándar (no goroky). Email con `doc_label` configurable. Estado editable en la tabla (dropdown), botón "Convertir en factura".
- ✅ Verificado backend E2E (curl): PRE-2026-0001 (total 1060€ con IRPF) → PDF 200 con "PRESUPUESTO"/"Válido hasta" → convert → factura 2026-0014 → estado facturado → re-convert 400. Refactor: `create_invoice` extraído a `_make_invoice(user, company, data)`.

## NUEVO BACKLOG (petición del usuario, 2026-06)
- Fase 1 ✅ Presupuestos + conversión a factura (manual, sin aceptación online).
- Fase 2 ⏳ Facturación intracomunitaria (tipo IVA "intracomunitaria" exenta art. 25 / inversión sujeto pasivo, leyenda PDF, mapeo VeriFactu OperaciónExenta E5 + Modelo 303/349).
- Fase 3 ⏳ Multiempresa (gran refactor): `company_id` en facturas/gastos/contactos/certificados, selector de empresa, panel acordeón por empresa/autónomo, certificado por empresa, menú "Activar multiempresas".
  - Nuevo plan "Multiempresas" 49,99€/mes con tramos 20 y 50 empresas + opción "necesitas más empresas: contáctanos" (formulario → email a soporte@goroky.com).

## Fix — Iteración 18 (2026-06) Facturas "desaparecidas" al activar empresa + diagnóstico IA producción
- 🐛 **Causa raíz facturas ocultas**: al crear/activar una empresa nueva (vacía), `active_company_id` cambiaba y el panel solo mostraba las facturas de la empresa activa → las facturas antiguas seguían en BD bajo la empresa original (NUNCA se borran). Además `_list_companies` NO migraba datos heredados (sin `company_id`) cuando auto-creaba la empresa por defecto (rama `if not comps`), dejando facturas legacy huérfanas e invisibles.
- ✅ **Fix backend** (`server.py` `_list_companies`): salvaguarda única por usuario (flag `legacy_company_migrated`) que adjunta TODO documento sin `company_id` (invoices, expenses, contacts, quotes, certificates, verifactu_log, files, payment_transactions) a la primera empresa. Elimina la migración inline anterior.
- ✅ **Fix UX** (`GET /api/companies` + `Companies.js`): cada empresa devuelve `invoice_count`; el panel /empresas muestra badge "N facturas" por empresa para que el usuario vea de un vistazo dónde están sus facturas y active la correcta. Verificado en preview (Mi Empresa 117 · Autonomo B 1 · TEST UI Empresa2 0).
- ℹ️ **IA en producción (Cloudflare Error 520)**: la IA funciona 200 OK en preview (assistant y OCR usan EMERGENT_LLM_KEY / gpt-5.4). El 520 es específico del servidor Plesk del usuario: origen devuelve respuesta incompleta = timeout del proxy Nginx durante la llamada LLM (superan el `proxy_read_timeout` por defecto) o `emergentintegrations` no instalado en el venv de producción o saldo del EMERGENT_LLM_KEY agotado. Pendiente diagnóstico del usuario (sin acceso SSH del agente).

## Recuperación datos producción + Rediseño UI (Iteración 19, 2026-08)
- 🛟 **Recuperación producción (openfactura_prod)**: las facturas de un usuario (soporte@goroky.com, _id 6a8582933d10ad1e124522b3) apuntaban a una empresa "fantasma" `04e7f083…` inexistente en `companies`, mientras su empresa activa `00c41c85…` (Eduardo Bravo Unda) estaba vacía. Se reasignaron por MongoDB (solo lectura + update_many controlado) todas las colecciones (invoices, expenses, contacts, quotes, certificates, verifactu_log, files, payment_transactions) de la empresa fantasma a la activa. Datos recuperados, VeriFactu intacto (huellas/CSV/cadena/cert no tocados). Panel en 0 resultó CORRECTO: rectificativa R-2026-0005 (−0,60€) compensa a GRKY-2026-0008 (+0,60€) y el resto estaban anuladas.
- 🎨 **Rediseño UI estilo Holded** (guía en `/app/design_guidelines.json` generada por design_agent):
  - `Login.js` reescrito: split-screen, imagen 3D Unsplash + degradado `from-[#0A1B3D] to-[#0052FF]`, tarjeta glassmorphism flotante (backdrop-blur) con métrica y badge VeriFactu, inputs h-12 rounded-xl bg-slate-50, botón con sombra azul y microinteracción, animación `of-fade-up`.
  - `Invoices.js`: 3 tarjetas resumen bento (facturado/cobrado/pendiente con iconos en chips), buscador (`invoice-search`) + filtro de estado (`invoice-status-filter`), tabla envuelta en tarjeta rounded-[20px] shadow suave, cabecera uppercase, filas hover. `summary` y `filtered` con useMemo. Toda la lógica, badges, tooltips y diálogo preservados.
  - `index.css`: keyframes `of-fade-up` y `of-float`. Verificado visualmente (login y facturas) y compila sin errores.
- 🎨 **Rediseño UI completo (resto de pantallas, Iteración 20, 2026-08)**: aplicado el mismo lenguaje Holded a `Dashboard.js` (banner con glow, 4 métricas con chips e iconos, gráfico con degradado, trimestres en pills), `Expenses.js`, `Quotes.js`, `Taxes.js` y `Contacts.js`. Patrón común: tarjetas `rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-slate-200/60`, botones primarios pill con sombra azul + microinteracción, cabeceras de tabla uppercase/tracking, filas con hover, estados vacíos con chip redondeado, tarjetas de contacto con elevación en hover y `of-fade-up`. Toda la lógica y `data-testid` preservados. Verificado en preview (Panel, Facturas, Login, Gastos, Impuestos) y compila sin errores.
