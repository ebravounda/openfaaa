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

## Backlog (prioritized)
- P1: Campos tipo Holded en factura: descuentos (línea/global), concepto+descripción separados, total por línea, número editable.
- P2: Editar límites/precios de planes desde admin (ahora fijos en plans.py).
- P2: Vista previa en vivo del PDF al cambiar colores/plantilla.
- P3: Refactor server.py en routers (verifactu, invoices, contacts).
