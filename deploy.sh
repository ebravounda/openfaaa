#!/usr/bin/env bash
# Despliegue seguro de OpenFactura en el servidor Plesk.
# Uso:  bash /var/www/vhosts/openfactura.es/app/deploy.sh
set -euo pipefail

APP="/var/www/vhosts/openfactura.es/app"
DOCROOT="/var/www/vhosts/openfactura.es/httpdocs"

echo "▶ 1/5 Actualizando código (git pull)..."
cd "$APP"
git pull origin main

echo "▶ 2/5 Compilando frontend..."
cd "$APP/frontend"
yarn install --frozen-lockfile 2>/dev/null || yarn install
yarn build

# Seguridad: si el build falló, NO se publica nada (se queda lo que había).
if [ ! -f "$APP/frontend/build/index.html" ]; then
  echo "❌ ERROR: el build falló (no existe build/index.html). No se publica nada."
  exit 1
fi

echo "▶ 3/5 Publicando build en el docroot (httpdocs)..."
rsync -a --delete --exclude='.htaccess' --exclude='.well-known' \
  "$APP/frontend/build/" "$DOCROOT/"

echo "▶ 4/5 Backend (dependencias + reinicio)..."
cd "$APP/backend"
source "$APP/venv/bin/activate"
# El índice extra de Emergent es necesario para 'emergentintegrations' (OCR / IA), que no está en PyPI.
pip install -q -r requirements.txt --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
systemctl restart openfactura-api

echo "▶ 5/5 Verificación en vivo..."
sleep 3
SERVED=$(curl -s "https://openfactura.es/?cb=$(date +%s)" | grep -o 'main\.[a-z0-9]*\.js' | head -1)
BUILT=$(grep -o 'main\.[a-z0-9]*\.js' "$APP/frontend/build/index.html" | head -1)
API=$(curl -s -o /dev/null -w "%{http_code}" https://openfactura.es/api/pos/settings)
echo "   Servido: ${SERVED:-?} | Compilado: ${BUILT:-?} | API /pos: ${API} (401 = OK)"
if [ "${SERVED:-x}" = "${BUILT:-y}" ] && [ -n "${SERVED:-}" ]; then
  echo "✅ DESPLIEGUE COMPLETADO Y VERIFICADO"
else
  echo "⚠  El HTML servido no coincide con el compilado. Revisa el docroot."
  exit 1
fi
