#!/usr/bin/env bash
# Da a la identidad del backend el permiso de aplicación User.Read.All sobre Microsoft Graph
# (reemplaza a GRAPH_CLIENT_SECRET). Lo corre un administrador del tenant del entorno.
#
#   ./infra/azure/scripts/permiso-graph-backend.sh            # pre-prod
#   ./infra/azure/scripts/permiso-graph-backend.sh prod       # prod
set -euo pipefail

ENTORNO="${1:-preprod}"
RG="rg-incrementa-${ENTORNO}"
IDENTIDAD="id-incrementa-backend-${ENTORNO}"
GRAPH_APP_ID="00000003-0000-0000-c000-000000000000"   # Microsoft Graph, igual en todos los tenants

BACKEND="$(az identity show -g "$RG" -n "$IDENTIDAD" --query principalId -o tsv)"
GRAPH_SP="$(az ad sp show --id "$GRAPH_APP_ID" --query id -o tsv)"
ROL="$(az ad sp show --id "$GRAPH_APP_ID" --query "appRoles[?value=='User.Read.All'].id" -o tsv)"

YA="$(az rest --method GET \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$BACKEND/appRoleAssignments" \
  --query "value[?appRoleId=='$ROL'] | length(@)" -o tsv)"
if [[ "$YA" != "0" ]]; then
  echo "$IDENTIDAD ya tiene User.Read.All sobre Microsoft Graph. Nada que hacer."
  exit 0
fi

az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$BACKEND/appRoleAssignments" \
  --body "{\"principalId\":\"$BACKEND\",\"resourceId\":\"$GRAPH_SP\",\"appRoleId\":\"$ROL\"}" \
  --output none
echo "Listo: $IDENTIDAD tiene User.Read.All sobre Microsoft Graph."
