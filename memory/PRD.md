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

## Backlog (prioritized)
- P1: Adjuntar PDF binario al email (bloqueado: la integración gestionada de Resend no soporta adjuntos actualmente).
- P2: Facturas rectificativas; múltiples series simultáneas gestionadas.
- P2: Escaneo también de facturas de venta.
- P2: Resumen anual (Modelo 390/100); exportar en formato de la AEAT.
- P3: Añadir DialogDescription (aria-describedby) para eliminar warning de accesibilidad en modales.
