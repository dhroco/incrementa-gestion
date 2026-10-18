#!/usr/bin/env bash
# Restaura en Azure el respaldo de GCP y compara filas por tabla con conteos-gcp.txt.
#
#   ./infra/azure/scripts/restaurar-bd-azure.sh [respaldo.dump] [entorno]
#     respaldo: por defecto el .dump más reciente de ~/Workspaces/respaldo-gcp
#     entorno:  preprod (usa postgresql-credenciales-<entorno>.txt de la raíz del repo)
#
# Se niega a restaurar si la base de Azure ya tiene tablas (para no mezclar datos).
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/../../.." && pwd)"
CARPETA="$HOME/Workspaces/respaldo-gcp"
RESPALDO="${1:-$(ls -t "$CARPETA"/incrementa-gcp-*.dump 2>/dev/null | head -1)}"
ENTORNO="${2:-preprod}"
CREDENCIALES="$RAIZ/postgresql-credenciales-$ENTORNO.txt"
CONTEOS_GCP="$(dirname "$RESPALDO")/conteos-gcp.txt"
CONTEOS_AZURE="$(dirname "$RESPALDO")/conteos-azure-$ENTORNO.txt"
LOG="$(dirname "$RESPALDO")/restauracion-azure-$ENTORNO.log"

[[ -f "$RESPALDO" ]]     || { echo "No encuentro el respaldo ($RESPALDO)." >&2; exit 1; }
[[ -f "$CREDENCIALES" ]] || { echo "No encuentro $CREDENCIALES." >&2; exit 1; }
[[ -f "$CONTEOS_GCP" ]]  || { echo "No encuentro $CONTEOS_GCP." >&2; exit 1; }

unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSSLMODE
set -a; source "$CREDENCIALES"; set +a

echo "Respaldo: $RESPALDO"
echo "Destino:  $PGUSER@$PGHOST/$PGDATABASE"

# 1. La base de destino tiene que estar vacía.
TABLAS="$(psql -At -c "select count(*) from information_schema.tables where table_schema='public'")"
if [[ "$TABLAS" != "0" ]]; then
  echo "La base de Azure ya tiene $TABLAS tablas en 'public'. No restauro encima." >&2
  exit 1
fi

# 2. Extensiones que pide el respaldo (plpgsql viene siempre).
EXTENSIONES="$(pg_restore -l "$RESPALDO" | awk '$4=="EXTENSION" {print $6}' | grep -v '^plpgsql$' | sort -u || true)"
if [[ -n "$EXTENSIONES" ]]; then
  PERMITIDAS="$(psql -At -c "show azure.extensions" | tr '[:upper:]' '[:lower:]')"
  FALTAN=""
  for e in $EXTENSIONES; do
    [[ ",$PERMITIDAS," == *",$e,"* ]] || FALTAN="$FALTAN $e"
  done
  if [[ -n "$FALTAN" ]]; then
    echo "El respaldo usa extensiones que Azure aún no permite:$FALTAN" >&2
    echo "Hay que habilitarlas en el servidor (parámetro azure.extensions) antes de restaurar." >&2
    exit 1
  fi
  echo "Extensiones: $(echo $EXTENSIONES) (permitidas)."
fi

# 3. Restaurar. pg_restore 18 sobre PostgreSQL 16 puede quejarse de parámetros nuevos
#    (p. ej. transaction_timeout); esos avisos no afectan los datos. El log queda guardado.
echo "Restaurando …"
set +e
pg_restore --no-owner --no-acl -d "$PGDATABASE" "$RESPALDO" 2> "$LOG"
set -e
ERRORES="$(grep -c '^pg_restore: error' "$LOG" || true)"
OTROS="$(grep '^pg_restore: error' "$LOG" | grep -vc 'transaction_timeout' || true)"
echo "Errores de pg_restore: $ERRORES (fuera de transaction_timeout: $OTROS). Detalle en $LOG"

# 4. Contar y comparar.
psql -At -F ' ' -c "
select table_name,
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::int
from information_schema.tables
where table_schema='public' and table_type='BASE TABLE'
order by 1;" > "$CONTEOS_AZURE"

echo
if diff -u "$CONTEOS_GCP" "$CONTEOS_AZURE" > /dev/null; then
  echo "Conteos idénticos en las $(wc -l < "$CONTEOS_AZURE" | tr -d ' ') tablas. ✔"
else
  echo "Los conteos NO coinciden (GCP a la izquierda, Azure a la derecha):"
  diff -y "$CONTEOS_GCP" "$CONTEOS_AZURE" || true
  exit 1
fi
