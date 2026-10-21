#!/usr/bin/env bash
# Crea las dos identidades que usa GitHub Actions para entrar a Azure sin claves (OIDC federado):
#   - deploy: sube imágenes y actualiza las apps.
#       pre-prod: solo desde un push a la rama preprod.
#       prod:     solo desde el environment de GitHub «produccion» (con aprobación de David y
#                 limitado a la rama prod). Un job con environment presenta ese subject en el token.
#   - infra:  solo desde el environment de GitHub «infra-<entorno>» (con aprobación); aplica el Bicep.
#             En prod no se crea todavía: el Bicep de prod se aplica a mano.
#
#   ./infra/azure/scripts/identidades-github.sh            # pre-prod (rama preprod)
#   ./infra/azure/scripts/identidades-github.sh prod       # prod (rama prod)
set -euo pipefail

ENTORNO="${1:-preprod}"
REPO="dhroco/incrementa-gestion"
# El resource group de prod lleva el nombre del sistema (rg-incrementa-gestion-prod).
if [[ "$ENTORNO" == "prod" ]]; then RG="rg-incrementa-gestion-prod"; else RG="rg-incrementa-${ENTORNO}"; fi
RAMA="${ENTORNO}"
ID_DEPLOY="id-incrementa-github-deploy-${ENTORNO}"
ID_INFRA="id-incrementa-github-infra-${ENTORNO}"
ISSUER="https://token.actions.githubusercontent.com"

RG_ID="$(az group show -n "$RG" --query id -o tsv)"
LOC="$(az group show -n "$RG" --query location -o tsv)"
ACR_ID="$(az acr show -g "$RG" -n "acrincrementa${ENTORNO}" --query id -o tsv)"
SWA_ID="$(az staticwebapp show -g "$RG" -n "swa-incrementa-${ENTORNO}" --query id -o tsv)"
APP_IDS=("$(az containerapp show -g "$RG" -n ca-incrementa-backend --query id -o tsv)")
MCP_ID="$(az containerapp show -g "$RG" -n ca-incrementa-mcp --query id -o tsv 2>/dev/null || true)"
[[ -n "$MCP_ID" ]] && APP_IDS+=("$MCP_ID")

crear_identidad() {
  local nombre="$1" subject="$2" credencial="$3"
  az identity create -g "$RG" -n "$nombre" -l "$LOC" --output none
  if ! az identity federated-credential show -g "$RG" --identity-name "$nombre" -n "$credencial" --output none 2>/dev/null; then
    az identity federated-credential create -g "$RG" --identity-name "$nombre" -n "$credencial" \
      --issuer "$ISSUER" --subject "$subject" --audiences "api://AzureADTokenExchange" --output none
  fi
  az identity show -g "$RG" -n "$nombre" --query principalId -o tsv
}

asignar() {
  local principal="$1" rol="$2" scope="$3"
  local hay
  hay="$(az role assignment list --assignee "$principal" --role "$rol" --scope "$scope" --query "length(@)" -o tsv)"
  [[ "$hay" != "0" ]] && return 0
  # Una identidad recién creada puede tardar unos segundos en verse; se reintenta.
  local error
  error="$(mktemp)"
  for intento in 1 2 3 4 5; do
    if az role assignment create --assignee-object-id "$principal" --assignee-principal-type ServicePrincipal \
      --role "$rol" --scope "$scope" --output none 2>"$error"; then
      echo "  $rol en ${scope##*/}"
      rm -f "$error"
      return 0
    fi
    sleep 10
  done
  echo "No se pudo asignar '$rol' en $scope. Último error:" >&2
  cat "$error" >&2
  rm -f "$error"
  return 1
}

if [[ "$ENTORNO" == "prod" ]]; then
  echo "Creando $ID_DEPLOY (solo desde el environment produccion)…"
  P_DEPLOY="$(crear_identidad "$ID_DEPLOY" "repo:${REPO}:environment:produccion" "github-environment-produccion")"
else
  echo "Creando $ID_DEPLOY (solo desde la rama $RAMA)…"
  P_DEPLOY="$(crear_identidad "$ID_DEPLOY" "repo:${REPO}:ref:refs/heads/${RAMA}" "github-rama-${RAMA}")"
fi
asignar "$P_DEPLOY" "AcrPush" "$ACR_ID"
for id in "${APP_IDS[@]}"; do asignar "$P_DEPLOY" "Contributor" "$id"; done
asignar "$P_DEPLOY" "Contributor" "$SWA_ID"

if [[ "$ENTORNO" != "prod" ]]; then
  echo "Creando $ID_INFRA (solo desde el environment infra-${ENTORNO})…"
  P_INFRA="$(crear_identidad "$ID_INFRA" "repo:${REPO}:environment:infra-${ENTORNO}" "github-environment-infra-${ENTORNO}")"
  asignar "$P_INFRA" "Contributor" "$RG_ID"
  asignar "$P_INFRA" "Role Based Access Control Administrator" "$RG_ID"
fi

echo
if [[ "$ENTORNO" == "prod" ]]; then
  echo "Listo. Valores para las variables del environment «produccion» en GitHub (no son secretos):"
else
  echo "Listo. Valores para las variables de GitHub (no son secretos):"
fi
echo "  AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "  AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)"
echo "  AZURE_CLIENT_ID_DEPLOY=$(az identity show -g "$RG" -n "$ID_DEPLOY" --query clientId -o tsv)"
[[ "$ENTORNO" != "prod" ]] && echo "  AZURE_CLIENT_ID_INFRA=$(az identity show -g "$RG" -n "$ID_INFRA" --query clientId -o tsv)"
exit 0
