# Despliegue de OpenFactura.es (100% independiente en Plesk)

> ⚠️ **REGLA DE ORO**: El servidor Plesk aloja otras plataformas (ingresoqr.com, gym24.app,
> tramilex, goroky, contenedores…). **NO se toca NADA de eso.** OpenFactura debe ser
> totalmente independiente: su propio dominio, su propia base de datos, sus propias
> variables de entorno y su propio proceso. No compartas puertos, BD, ni rutas con las
> demás plataformas.

---

## 0. Resumen de arquitectura
- **Frontend**: React (build estático) servido por el vhost de `openfactura.es`.
- **Backend**: FastAPI (Uvicorn) escuchando en un **puerto propio y exclusivo** (ej. `8712`),
  detrás del proxy inverso del dominio, con todas las rutas bajo `/api`.
- **Base de datos**: MongoDB con **una base de datos propia** (ej. `openfactura_prod`).
  Puede ser el mismo servidor Mongo que otras apps SIEMPRE que uses un `DB_NAME` distinto
  y, preferiblemente, un usuario Mongo con permisos SOLO sobre esa BD.

---

## 1. Base de datos MongoDB independiente
Crea una BD y un usuario dedicados (no reutilices los de otras plataformas):

```javascript
// mongosh
use openfactura_prod
db.createUser({
  user: "openfactura",
  pwd: "<CONTRASEÑA_FUERTE_ALEATORIA>",
  roles: [{ role: "readWrite", db: "openfactura_prod" }]
})
```

`MONGO_URL` resultante:
```
mongodb://openfactura:<CONTRASEÑA>@127.0.0.1:27017/openfactura_prod?authSource=openfactura_prod
```

---

## 2. Variables de entorno de producción

### backend/.env  (NO subir a git, permisos 600)
```
MONGO_URL="mongodb://openfactura:<PWD>@127.0.0.1:27017/openfactura_prod?authSource=openfactura_prod"
DB_NAME="openfactura_prod"
CORS_ORIGINS="https://openfactura.es,https://www.openfactura.es"
FRONTEND_URL="https://openfactura.es"
JWT_SECRET="<64_HEX_ALEATORIO>"
ADMIN_EMAIL="admin@openfactura.es"
ADMIN_PASSWORD="<CONTRASEÑA_ADMIN_FUERTE>"
CERT_ENCRYPTION_KEY="<FERNET_KEY>"
WEBHOOK_CRON_SECRET="<TOKEN_ALEATORIO>"
EMERGENT_LLM_KEY="<tu_clave>"
EMERGENT_EMAIL_KEY="<tu_clave_resend_gestionada>"
EMAIL_FROM_NAME="OpenFactura"
STRIPE_SECRET_KEY="<sk_live_o_test>"
STRIPE_PUBLISHABLE_KEY="<pk_live_o_test>"
STRIPE_WEBHOOK_SECRET="<whsec_...>"
STRIPE_MODE="live"
# EXPOSE_API_DOCS  -> NO definir en producción (docs quedan deshabilitados)
```

Generar secretos:
```bash
openssl rand -hex 32                     # JWT_SECRET
openssl rand -hex 24                     # WEBHOOK_CRON_SECRET
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # CERT_ENCRYPTION_KEY
```

### frontend/.env
```
REACT_APP_BACKEND_URL=https://openfactura.es
```
(El frontend llama a `${REACT_APP_BACKEND_URL}/api`. Al servir frontend y backend bajo el
mismo dominio con el proxy `/api`, las cookies funcionan como same-site.)

---

## 3. Backend como servicio propio (systemd)
Crea `/etc/systemd/system/openfactura-api.service` (NO toques servicios de otras apps):

```ini
[Unit]
Description=OpenFactura API (FastAPI)
After=network.target mongod.service

[Service]
User=openfactura
WorkingDirectory=/var/www/vhosts/openfactura.es/api/backend
EnvironmentFile=/var/www/vhosts/openfactura.es/api/backend/.env
ExecStart=/var/www/vhosts/openfactura.es/api/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8712 --workers 2
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
python3 -m venv /var/www/vhosts/openfactura.es/api/venv
/var/www/vhosts/openfactura.es/api/venv/bin/pip install -r backend/requirements.txt
systemctl daemon-reload
systemctl enable --now openfactura-api
```

> El puerto `8712` es un ejemplo: elige uno LIBRE que no use ninguna otra plataforma.

---

## 4. Frontend (build estático)
```bash
cd frontend
yarn install
yarn build          # genera frontend/build
```
Copia el contenido de `frontend/build` a la raíz de documentos del dominio en Plesk
(ej. `/var/www/vhosts/openfactura.es/httpdocs`).

---

## 5. Proxy inverso (Plesk → Nginx directives del dominio openfactura.es)
En Plesk: *Dominios → openfactura.es → Apache & nginx Settings → Additional nginx directives*.
**Solo afecta a este dominio**, no a los demás:

```nginx
# API -> backend FastAPI (puerto propio)
location /api/ {
    proxy_pass http://127.0.0.1:8712;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    client_max_body_size 15m;   # subidas (OCR/certificado)
}

# SPA React -> index.html en rutas del cliente
location / {
    try_files $uri $uri/ /index.html;
}
```

---

## 6. HTTPS
Activa **Let's Encrypt** para `openfactura.es` (y `www`) desde Plesk. Las cookies del backend
son `Secure` + `SameSite=None`, así que HTTPS es obligatorio.

---

## 7. Tareas programadas (cron) — opcional
Los endpoints cron están protegidos por `WEBHOOK_CRON_SECRET`. Programa en el cron de Plesk
(solo para este dominio):
```bash
# Día 3 de cada mes: purga de log VeriFactu (>60 días)
curl -s -X POST https://openfactura.es/api/cron/purge-verifactu-log -H "Authorization: Bearer <WEBHOOK_CRON_SECRET>"
# Diario: aviso de caducidad de certificados
curl -s -X POST https://openfactura.es/api/cron/check-cert-expiry -H "Authorization: Bearer <WEBHOOK_CRON_SECRET>"
```

---

## 8. Stripe (webhook)
En el panel de Stripe crea un endpoint de webhook apuntando a:
```
https://openfactura.es/api/stripe/webhook
```
Copia el `whsec_...` en `STRIPE_WEBHOOK_SECRET`.

---

## 9. Checklist final de independencia y seguridad
- [ ] `DB_NAME` exclusivo (`openfactura_prod`), usuario Mongo con permisos SOLO a esa BD.
- [ ] Puerto de la API exclusivo, no usado por otras plataformas.
- [ ] `.env` con permisos 600 y fuera del control de versiones.
- [ ] `JWT_SECRET`, `WEBHOOK_CRON_SECRET`, `CERT_ENCRYPTION_KEY` aleatorios y únicos.
- [ ] `ADMIN_PASSWORD` fuerte (se re-siembra en cada arranque).
- [ ] HTTPS (Let's Encrypt) activo; `EXPOSE_API_DOCS` NO definido.
- [ ] Directivas nginx aplicadas SOLO al vhost de openfactura.es.
- [ ] Ninguna referencia ni recurso compartido con ingresoqr.com, gym24.app, tramilex, goroky.
- [ ] Backups programados de la BD `openfactura_prod` (independientes).
