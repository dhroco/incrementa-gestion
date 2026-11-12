#!/usr/bin/env bash
# Guarda en el Key Vault del entorno los secretos de Firme: FIRME-API-TOKEN y FIRME-LEGAL-ENTITY-ID.
# Pide el token sin mostrarlo (no queda en pantalla ni en el historial), consulta GET /legal-entities
# para que elijas la empresa (Dynamics Corp SPA, no tu cuenta personal) y guarda los dos secretos.
# Usa la suscripción de cada entorno de forma explícita: no cambia la suscripción activa de az.
#
#   ./infra/azure/scripts/cargar-secreto-firme.sh prod       # token de producción (api.documentos.firme.cl)
#   ./infra/azure/scripts/cargar-secreto-firme.sh preprod    # token de staging (staging.api.documentos.firme.cl)
set -euo pipefail

ENTORNO="${1:?Falta el entorno. Ejemplo: ./infra/azure/scripts/cargar-secreto-firme.sh prod}"
case "$ENTORNO" in
  prod)    SUB="2fdd7c0a-664d-46ea-863d-73f96627f217"; URL="https://api.documentos.firme.cl" ;;
  preprod) SUB="8460e93a-bbda-4707-8b6c-a5fb5d1c2d80"; URL="https://staging.api.documentos.firme.cl" ;;
  *) echo "Entorno desconocido: $ENTORNO (prod o preprod)." >&2; exit 1 ;;
esac
KV="kv-incrementa-$ENTORNO"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"

read -rsp "Token de Firme ($ENTORNO): " TOKEN; echo
[ -n "$TOKEN" ] || { echo "El token está vacío." >&2; exit 1; }

# El token viaja por stdin hacia curl (no aparece en la lista de procesos).
printf 'header = "Authorization: Bearer %s"\nheader = "User-Agent: Incrementa-Contratos/1.0"\n' "$TOKEN" > "$TMP/curl.cfg"
chmod 600 "$TMP/curl.cfg"
HTTP="$(curl -sS -o "$TMP/entidades.json" -w '%{http_code}' -K "$TMP/curl.cfg" "$URL/legal-entities")"
[ "$HTTP" = "200" ] || { echo "Firme respondió $HTTP: revisa que el token sea de $ENTORNO y no haya vencido." >&2; exit 1; }

python3 - "$TMP/entidades.json" > "$TMP/lista.txt" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
items = d if isinstance(d, list) else next((d[k] for k in ('data', 'items', 'legalEntities', 'results') if isinstance(d.get(k), list)), [])
for i, e in enumerate(items, 1):
    eid = e.get('id') or e.get('_id') or ''
    nombre = e.get('name') or e.get('razonSocial') or e.get('businessName') or '(sin nombre)'
    rut = e.get('documentNumber') or e.get('rut') or ''
    print(f"{i}\t{eid}\t{nombre}\t{rut}")
PY
[ -s "$TMP/lista.txt" ] || { echo "No encontré empresas en la respuesta de Firme." >&2; exit 1; }

echo; echo "Empresas de este token:"
awk -F'\t' '{printf "  %s) %s  (RUT %s)\n", $1, $3, $4}' "$TMP/lista.txt"
read -rp "¿Cuál es la empresa de Incrementa (Dynamics Corp SPA)? Número: " N
ID="$(awk -F'\t' -v n="$N" '$1==n {print $2}' "$TMP/lista.txt")"
NOMBRE="$(awk -F'\t' -v n="$N" '$1==n {print $3}' "$TMP/lista.txt")"
[ -n "$ID" ] || { echo "Número inválido." >&2; exit 1; }
read -rp "Se guardará la empresa «${NOMBRE}» en $KV. ¿Confirmas? (s/N): " OK
[ "$OK" = "s" ] || { echo "Cancelado, no se guardó nada."; exit 1; }

printf '%s' "$TOKEN" > "$TMP/token"; printf '%s' "$ID" > "$TMP/entidad"
chmod 600 "$TMP/token" "$TMP/entidad"
guardar() {
  # El permiso de Key Vault recién asignado puede tardar unos minutos en propagarse: se reintenta.
  for intento in 1 2 3 4 5 6; do
    if az keyvault secret set --subscription "$SUB" --vault-name "$KV" -n "$1" --file "$2" --encoding utf-8 --output none 2>"$TMP/error"; then
      echo "  $1 guardado en $KV."; return 0
    fi
    echo "  Intento $intento: Key Vault todavía no acepta. Reintento en 30 s…"; sleep 30
  done
  cat "$TMP/error" >&2; return 1
}
guardar FIRME-API-TOKEN "$TMP/token"
guardar FIRME-LEGAL-ENTITY-ID "$TMP/entidad"
echo "Listo. Secretos de Firme en $KV:"
az keyvault secret list --subscription "$SUB" --vault-name "$KV" --query "[?starts_with(name,'FIRME')].name" -o tsv
