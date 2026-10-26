#!/usr/bin/env bash
# Deja la regla de firewall «administrador» de PostgreSQL con la IP pública actual de este equipo.
# Correr cada vez que la IP cambie (reinicio del router, otra red, etc.).
#
#   ./infra/azure/scripts/firewall-mi-ip.sh            # pre-prod
#   ./infra/azure/scripts/firewall-mi-ip.sh prod       # prod
set -euo pipefail

ENTORNO="${1:-preprod}"
if [[ "$ENTORNO" == "prod" ]]; then RG="rg-incrementa-gestion-prod"; else RG="rg-incrementa-${ENTORNO}"; fi
SERVIDOR="psql-incrementa-${ENTORNO}"
REGLA="administrador"

IP="$(curl -fsS https://ifconfig.me)"
if [[ ! "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "No se pudo obtener una IP pública válida (recibí: '$IP')." >&2
  exit 1
fi

ACTUAL="$(az postgres flexible-server firewall-rule show -g "$RG" --server-name "$SERVIDOR" --name "$REGLA" \
  --query startIpAddress -o tsv 2>/dev/null || true)"

if [[ "$ACTUAL" == "$IP" ]]; then
  echo "La regla '$REGLA' ya tiene tu IP actual ($IP). Nada que cambiar."
  exit 0
fi

echo "IP actual: $IP (en la regla: ${ACTUAL:-ninguna}). Actualizando…"
az postgres flexible-server firewall-rule create -g "$RG" --server-name "$SERVIDOR" --name "$REGLA" \
  --start-ip-address "$IP" --end-ip-address "$IP" --output none
echo "Listo: $SERVIDOR acepta conexiones desde $IP."
