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
- ✅ Envío de factura por email (HTML detallado, Resend gestionado).
- ✅ Gastos: crear/listar/eliminar con IVA soportado.
- ✅ Dashboard + Impuestos (Modelo 303 trimestral con próximos vencimientos).
- ✅ Testing 100% backend (12/12) y frontend.

## Backlog (prioritized)
- P1: Adjuntar el PDF real al email (actualmente el email envía la factura en HTML; el PDF se descarga en la app).
- P1: Filtro por año/ejercicio en el dashboard e impuestos (selector).
- P2: Modelo 130 (IRPF pagos fraccionados) y resumen anual.
- P2: Gestión de clientes/proveedores guardados y reutilizables.
- P2: Numeración de factura configurable (series, prefijos).
- P2: Exportar libros de IVA (repercutido/soportado) a CSV/Excel.
