#!/usr/bin/env bash
# Crea la ruta secreta del MCP (MCP-RUTA-SECRETA) en el Key Vault del entorno, si no existe.
# No la muestra. Para ver la URL del conector: ./infra/azure/scripts/url-conector-mcp.sh <entorno>
# Para cambiarla (si se filtró): --rotar, y luego reiniciar el MCP (ver url-conector-mcp.sh).
#
#   ./infra/azure/scripts/crear-secreto-mcp.sh prod [--rotar]
set -euo pipefail

ENTORNO="${1:?Falta el entorno. Ejemplo: ./infra/azure/scripts/crear-secreto-mcp.sh prod}"
KV="kv-incrementa-$ENTORNO"

if [[ "${2:-}" != "--rotar" ]] && az keyvault secret show --vault-name "$KV" -n MCP-RUTA-SECRETA --query id -o tsv >/dev/null 2>&1; then
  echo "MCP-RUTA-SECRETA ya existe en $KV. No se toca (usa --rotar para cambiarla)."
  exit 0
fi

# 48 caracteres [A-Za-z0-9] (~285 bits): imposible de adivinar.
SECRETO="$(openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | cut -c1-48)"
[[ ${#SECRETO} -eq 48 ]] || { echo "No se pudo generar el secreto." >&2; exit 1; }
az keyvault secret set --vault-name "$KV" -n MCP-RUTA-SECRETA --value "$SECRETO" --output none
echo "Listo: MCP-RUTA-SECRETA guardada en $KV."
