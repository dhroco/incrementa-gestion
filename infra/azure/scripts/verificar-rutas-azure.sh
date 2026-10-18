#!/usr/bin/env bash
# Verifica que cada ruta de archivo guardada en la base de Azure exista en Blob Storage,
# y lista los archivos que ninguna fila referencia.
#
#   ./infra/azure/scripts/verificar-rutas-azure.sh [entorno]     # por defecto preprod
#
# Compara contra la lista real de blobs de los contenedores documentos y firmados.
set -euo pipefail

ENTORNO="${1:-preprod}"
RAIZ="$(cd "$(dirname "$0")/../../.." && pwd)"
CUENTA="stincrementa${ENTORNO}"
CARPETA="$HOME/Workspaces/respaldo-gcp"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSSLMODE
set -a; source "$RAIZ/postgresql-credenciales-$ENTORNO.txt"; set +a

# Rutas en la base, con su origen.
psql -At -F ' ' -c "
select 'draft_document', gcs_path from draft_document where gcs_path is not null
union all select 'document', gcs_path from document where gcs_path is not null
union all select 'user_profile', avatar_gcs_path from user_profile where avatar_gcs_path is not null
union all select 'legal_rep_signature', gcs_path from legal_rep_signature where gcs_path is not null
order by 1, 2;" > "$TMP/bd.txt"
cut -d' ' -f2- "$TMP/bd.txt" | sort -u > "$TMP/rutas-bd.txt"

# Blobs reales en Azure.
for c in documentos firmados; do
  az storage blob list --account-name "$CUENTA" --auth-mode login --only-show-errors \
    -c "$c" --query '[].name' -o tsv
done | sort -u > "$TMP/blobs.txt"

echo "Rutas en la base, por tabla:"
cut -d' ' -f1 "$TMP/bd.txt" | sort | uniq -c | sed 's/^/  /'
echo "Blobs en Azure: $(wc -l < "$TMP/blobs.txt" | tr -d ' ')"
echo

FALTAN="$(comm -23 "$TMP/rutas-bd.txt" "$TMP/blobs.txt")"
HUERFANOS="$(comm -13 "$TMP/rutas-bd.txt" "$TMP/blobs.txt")"

if [[ -n "$FALTAN" ]]; then
  echo "Rutas de la base SIN archivo en Azure ($(echo "$FALTAN" | wc -l | tr -d ' ')):"
  echo "$FALTAN" | sed 's/^/  /'
else
  echo "Todas las rutas de la base tienen su archivo en Azure. ✔"
fi
echo
if [[ -n "$HUERFANOS" ]]; then
  echo "Archivos en Azure que ninguna fila referencia ($(echo "$HUERFANOS" | wc -l | tr -d ' ')):"
  echo "$HUERFANOS" | sed 's/^/  /'
else
  echo "No hay archivos huérfanos. ✔"
fi

{ echo "# rutas en BD"; cat "$TMP/bd.txt"; echo "# blobs"; cat "$TMP/blobs.txt"; } > "$CARPETA/rutas-azure-$ENTORNO.txt"
[[ -z "$FALTAN" ]]
