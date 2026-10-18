#!/usr/bin/env bash
# Respaldo de la base de datos de GCP (Cloud SQL) y conteo de filas por tabla.
# Requiere el proxy abierto en otra terminal:
#   cloud-sql-proxy incrementa-gestion-dev:us-central1:incrementa-db --port 5433
#
#   ./infra/azure/scripts/respaldo-bd-gcp.sh [carpeta]     # por defecto ~/Workspaces/respaldo-gcp
#
# Usuario, clave y base los toma del secreto DATABASE_URL de Secret Manager (el mismo que usa
# Cloud Run). Si no puede leerlo, los pide (la clave no se muestra ni queda en el historial).
# Deja: incrementa-gcp-<fecha>.dump y conteos-gcp.txt en la carpeta.
set -euo pipefail

CARPETA="${1:-$HOME/Workspaces/respaldo-gcp}"
PUERTO="${PUERTO_PROXY:-5433}"
FECHA="$(date +%Y-%m-%d)"
ARCHIVO="$CARPETA/incrementa-gcp-$FECHA.dump"
CONTEOS="$CARPETA/conteos-gcp.txt"

# Que no se cuelen las credenciales de Azure si se cargaron en esta terminal.
unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSSLMODE

mkdir -p "$CARPETA"

PROYECTO_GCP="${PROYECTO_GCP:-incrementa-gestion-dev}"
URL_GCP="$(gcloud secrets versions access latest --secret DATABASE_URL --project "$PROYECTO_GCP" 2>/dev/null || true)"

if [[ -n "$URL_GCP" ]]; then
  # Separa usuario, clave y base de la URL (la clave puede venir codificada con %xx).
  { IFS= read -r U; IFS= read -r P; IFS= read -r D; } < <(python3 -c '
import sys, urllib.parse as u
r = u.urlparse(sys.argv[1])
print(u.unquote(r.username or "")); print(u.unquote(r.password or "")); print(r.path.lstrip("/"))
' "$URL_GCP")
  unset URL_GCP
  echo "Credenciales tomadas de Secret Manager: usuario '$U', base '$D'."
else
  echo "No pude leer DATABASE_URL de Secret Manager; ingrésalas a mano."
  read -r -p "Usuario GCP: " U
  read -r -s -p "Clave GCP: " P; echo
  read -r -p "Base de datos GCP: " D
fi

export PGHOST=127.0.0.1 PGPORT="$PUERTO" PGUSER="$U" PGPASSWORD="$P" PGDATABASE="$D"

if ! pg_isready -q; then
  echo "No hay conexión en 127.0.0.1:$PUERTO. ¿Está abierto el cloud-sql-proxy?" >&2
  exit 1
fi

echo "Respaldando $D …"
pg_dump -Fc --no-owner --no-acl -f "$ARCHIVO"
ls -lh "$ARCHIVO"

echo "Contando filas por tabla …"
psql -At -F ' ' -c "
select table_name,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::int
from information_schema.tables
where table_schema='public' and table_type='BASE TABLE'
order by 1;" | tee "$CONTEOS"

echo
echo "Listo: $ARCHIVO"
echo "       $CONTEOS ($(wc -l < "$CONTEOS" | tr -d ' ') tablas)"
