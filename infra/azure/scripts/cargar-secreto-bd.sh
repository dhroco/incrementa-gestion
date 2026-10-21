#!/usr/bin/env bash
# Arma DATABASE-URL desde postgresql-credenciales-<entorno>.txt y la guarda en el Key Vault del
# entorno. La clave no se muestra en pantalla ni queda en el historial de la terminal.
#
#   ./infra/azure/scripts/cargar-secreto-bd.sh prod
set -euo pipefail

ENTORNO="${1:?Falta el entorno. Ejemplo: ./infra/azure/scripts/cargar-secreto-bd.sh prod}"
RAIZ="$(git rev-parse --show-toplevel)"
ARCHIVO="$RAIZ/postgresql-credenciales-$ENTORNO.txt"
KV="kv-incrementa-$ENTORNO"

[ -r "$ARCHIVO" ] || { echo "No encuentro $ARCHIVO." >&2; exit 1; }
leer() { grep "^$1=" "$ARCHIVO" | cut -d= -f2-; }

URL="$(python3 -c 'import sys,urllib.parse as u; h,p,d,us,pw=sys.argv[1:]; print(f"postgres://{u.quote(us,safe="")}:{u.quote(pw,safe="")}@{h}:{p}/{d}?sslmode=require")' \
  "$(leer PGHOST)" "$(leer PGPORT)" "$(leer PGDATABASE)" "$(leer PGUSER)" "$(leer PGPASSWORD)")"

# El permiso de Key Vault recién asignado puede tardar unos minutos en propagarse: se reintenta.
for intento in 1 2 3 4 5 6; do
  if az keyvault secret set --vault-name "$KV" -n DATABASE-URL --value "$URL" --output none 2>/tmp/kv-error.$$; then
    rm -f /tmp/kv-error.$$
    echo "Listo: DATABASE-URL cargada en $KV."
    az keyvault secret list --vault-name "$KV" --query "[].name" -o tsv
    exit 0
  fi
  echo "Intento $intento: Key Vault todavía no acepta (permiso propagándose). Reintento en 30 s…"
  sleep 30
done
cat /tmp/kv-error.$$ >&2; rm -f /tmp/kv-error.$$
exit 1
