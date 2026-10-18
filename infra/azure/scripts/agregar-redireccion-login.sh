#!/usr/bin/env bash
# Agrega una URL como redirección SPA de la app registration del login, sin quitar las que ya tiene.
#
#   ./infra/azure/scripts/agregar-redireccion-login.sh <url> [client-id]
#   (client-id por defecto: incrementa-gestion-dev, el login de pre-prod)
set -euo pipefail

URL="${1:?Falta la URL. Ejemplo: https://polite-ocean-07eccf60f.3.azurestaticapps.net}"
CLIENT_ID="${2:-dc734f4a-5f25-4e88-b728-aab4715f2122}"
URL="${URL%/}"

OBJ="$(az ad app show --id "$CLIENT_ID" --query id -o tsv)"
ACTUALES="$(az ad app show --id "$CLIENT_ID" --query "spa.redirectUris" -o json)"

if echo "$ACTUALES" | grep -q "\"$URL\""; then
  echo "La URL ya estaba registrada:"
  echo "$ACTUALES"
  exit 0
fi

NUEVAS="$(python3 -c 'import json,sys; l=json.loads(sys.argv[1]); l.append(sys.argv[2]); print(json.dumps(l))' "$ACTUALES" "$URL")"
az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/$OBJ" \
  --headers "Content-Type=application/json" \
  --body "{\"spa\":{\"redirectUris\":$NUEVAS}}" --output none

echo "Listo. Redirecciones SPA de la app:"
az ad app show --id "$CLIENT_ID" --query "spa.redirectUris" -o tsv
