#!/usr/bin/env bash
# Muestra la URL completa del conector MCP (incluye la ruta secreta: no la pegues en chats,
# correos ni documentos; solo en Configuración › Conectores de Claude).
#   ./infra/azure/scripts/url-conector-mcp.sh prod
set -euo pipefail
ENTORNO="${1:?Falta el entorno. Ejemplo: ./infra/azure/scripts/url-conector-mcp.sh prod}"
if [[ "$ENTORNO" == "prod" ]]; then RG="rg-incrementa-gestion-prod"; else RG="rg-incrementa-${ENTORNO}"; fi
FQDN="$(az containerapp show -g "$RG" -n ca-incrementa-mcp --query properties.configuration.ingress.fqdn -o tsv)"
SECRETO="$(az keyvault secret show --vault-name "kv-incrementa-$ENTORNO" -n MCP-RUTA-SECRETA --query value -o tsv 2>/dev/null || true)"
if [[ -n "$SECRETO" ]]; then echo "https://$FQDN/mcp/$SECRETO"; else echo "https://$FQDN/mcp"; fi
