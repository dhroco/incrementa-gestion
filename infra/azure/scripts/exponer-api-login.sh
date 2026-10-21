#!/usr/bin/env bash
# Configura la app registration del login para que el frontend pueda pedir tokens del backend:
#   - Application ID URI: api://<client-id>
#   - Scope delegado: access_as_user
#   - Tokens de acceso v2 (el backend valida el issuer .../v2.0)
# Se puede correr más de una vez: si el scope ya existe, reutiliza su id.
#
#   ./infra/azure/scripts/exponer-api-login.sh <client-id>
set -euo pipefail

APP_ID="${1:?Falta el client id. Ejemplo: ./infra/azure/scripts/exponer-api-login.sh 9976f99a-975a-4f33-8dd8-746a2411adad}"

OBJ_ID="$(az ad app show --id "$APP_ID" --query id -o tsv)"
SCOPE_ID="$(az ad app show --id "$APP_ID" --query "api.oauth2PermissionScopes[?value=='access_as_user'].id | [0]" -o tsv)"
if [ -z "$SCOPE_ID" ] || [ "$SCOPE_ID" = "None" ]; then
  SCOPE_ID="$(uuidgen | tr 'A-Z' 'a-z')"
  echo "Scope nuevo: $SCOPE_ID"
else
  echo "El scope ya existía, se reutiliza: $SCOPE_ID"
fi

CUERPO="$(mktemp)"
trap 'rm -f "$CUERPO"' EXIT
cat > "$CUERPO" <<EOF
{
  "identifierUris": ["api://$APP_ID"],
  "api": {
    "requestedAccessTokenVersion": 2,
    "oauth2PermissionScopes": [{
      "id": "$SCOPE_ID",
      "value": "access_as_user",
      "type": "User",
      "isEnabled": true,
      "adminConsentDisplayName": "Acceder como usuario",
      "adminConsentDescription": "Permite a la aplicación acceder a la API en nombre del usuario.",
      "userConsentDisplayName": "Acceder como usuario",
      "userConsentDescription": "Permite a la aplicación acceder a la API en tu nombre."
    }]
  }
}
EOF

az rest --method PATCH \
  --uri "https://graph.microsoft.com/v1.0/applications/$OBJ_ID" \
  --headers "Content-Type=application/json" \
  --body @"$CUERPO" --output none

echo "Listo. Configuración que quedó en la app:"
az ad app show --id "$APP_ID" \
  --query "{uri:identifierUris, version:api.requestedAccessTokenVersion, scope:api.oauth2PermissionScopes[].value}" -o json
