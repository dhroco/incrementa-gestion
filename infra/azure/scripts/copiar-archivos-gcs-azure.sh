#!/usr/bin/env bash
# Copia los archivos del bucket de GCP a Blob Storage de Azure, con las mismas rutas, y
# verifica que lleguen idénticos (SHA-256 de cada archivo).
#
#   ./infra/azure/scripts/copiar-archivos-gcs-azure.sh [entorno]     # por defecto preprod
#
#   contratos-firmados/…  → contenedor «firmados»  (WORM)
#   todo lo demás         → contenedor «documentos»
#   migration/            → no se sube (dumps SQL viejos); queda solo en la copia local
#
# Usa tu sesión de gcloud para leer el bucket y tu sesión de az (Entra ID) para escribir:
# la cuenta de Azure no acepta claves compartidas.
set -euo pipefail

ENTORNO="${1:-preprod}"
BUCKET="${BUCKET_GCS:-incrementa-contratos-dev}"
CUENTA="stincrementa${ENTORNO}"
CARPETA="$HOME/Workspaces/respaldo-gcp"
FECHA="$(date +%Y-%m-%d)"
LOCAL="$CARPETA/bucket-gcs-$FECHA"
VUELTA="$CARPETA/bucket-azure-$ENTORNO-$FECHA"
EXCLUIR="migration"

az_blob() { az storage blob "$@" --account-name "$CUENTA" --auth-mode login --only-show-errors; }

manifiesto() {   # sha256 de cada archivo (sin migration/), rutas relativas, ordenado
  (cd "$1" && find . -type f ! -path "./$EXCLUIR/*" -print0 | sort -z | xargs -0 shasum -a 256)
}

# 1. Los contenedores de Azure tienen que estar vacíos (firmados es WORM: no se puede sobrescribir).
for c in documentos firmados; do
  n="$(az_blob list -c "$c" --num-results 1 --query 'length(@)' -o tsv)"
  if [[ "$n" != "0" ]]; then
    echo "El contenedor '$c' de $CUENTA ya tiene archivos. No copio encima." >&2
    exit 1
  fi
done

# 2. Bajar el bucket completo (gcloud verifica el hash de cada objeto al bajarlo).
echo "Bajando gs://$BUCKET → $LOCAL"
mkdir -p "$LOCAL"
gcloud storage rsync -r "gs://$BUCKET" "$LOCAL" --quiet
echo "  $(find "$LOCAL" -type f | wc -l | tr -d ' ') archivos bajados."

SUELTOS="$(find "$LOCAL" -maxdepth 1 -type f | wc -l | tr -d ' ')"
if [[ "$SUELTOS" != "0" ]]; then
  echo "Hay $SUELTOS archivos en la raíz del bucket, fuera de carpetas. Revisar antes de seguir." >&2
  exit 1
fi

# 3. Subir carpeta por carpeta, con la misma ruta.
for dir in "$LOCAL"/*/; do
  prefijo="$(basename "$dir")"
  [[ "$prefijo" == "$EXCLUIR" ]] && { echo "  $prefijo/: no se sube (queda en la copia local)."; continue; }
  [[ -z "$(find "$dir" -type f -print -quit)" ]] && { echo "  $prefijo/: vacía."; continue; }
  if [[ "$prefijo" == "contratos-firmados" ]]; then c=firmados; else c=documentos; fi
  echo "  $prefijo/ → $c"
  az storage blob upload-batch --account-name "$CUENTA" --auth-mode login --only-show-errors \
    -d "$c" -s "$LOCAL" --pattern "$prefijo/*" --no-progress --output none
done

# 4. Volver a bajar desde Azure y comparar archivo por archivo.
echo "Verificando: bajando desde Azure → $VUELTA"
rm -rf "$VUELTA"; mkdir -p "$VUELTA"
for c in documentos firmados; do
  az storage blob download-batch --account-name "$CUENTA" --auth-mode login --only-show-errors \
    -s "$c" -d "$VUELTA" --no-progress --output none
done

manifiesto "$LOCAL" > "$CARPETA/hashes-gcs.txt"
manifiesto "$VUELTA" > "$CARPETA/hashes-azure-$ENTORNO.txt"

echo
echo "Por carpeta (GCS → Azure):"
for dir in "$LOCAL"/*/; do
  p="$(basename "$dir")"; [[ "$p" == "$EXCLUIR" ]] && continue
  printf "  %-24s %3s → %3s\n" "$p/" \
    "$(find "$LOCAL/$p" -type f | wc -l | tr -d ' ')" \
    "$(find "$VUELTA/$p" -type f 2>/dev/null | wc -l | tr -d ' ')"
done

if diff -u "$CARPETA/hashes-gcs.txt" "$CARPETA/hashes-azure-$ENTORNO.txt" > /dev/null; then
  echo
  echo "Los $(wc -l < "$CARPETA/hashes-gcs.txt" | tr -d ' ') archivos llegaron idénticos (SHA-256). ✔"
else
  echo
  echo "Hay diferencias entre GCS y Azure:" >&2
  diff -u "$CARPETA/hashes-gcs.txt" "$CARPETA/hashes-azure-$ENTORNO.txt" || true
  exit 1
fi
