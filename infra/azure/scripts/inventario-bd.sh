#!/usr/bin/env bash
# Muestra las tablas de la base de un entorno con su cantidad de filas (solo lectura).
# Usa postgresql-credenciales-<entorno>.txt; tu IP tiene que estar en el firewall
# (./infra/azure/scripts/firewall-mi-ip.sh <entorno>).
#
#   ./infra/azure/scripts/inventario-bd.sh preprod
set -euo pipefail

ENTORNO="${1:?Falta el entorno. Ejemplo: ./infra/azure/scripts/inventario-bd.sh preprod}"
RAIZ="$(git rev-parse --show-toplevel)"
ARCHIVO="$RAIZ/postgresql-credenciales-$ENTORNO.txt"
[ -r "$ARCHIVO" ] || { echo "No encuentro $ARCHIVO." >&2; exit 1; }

set -a; . "$ARCHIVO"; set +a

psql -X -v ON_ERROR_STOP=1 -At -F $'\t' <<'SQL' | column -t -s $'\t'
SELECT 'tabla', 'filas'
UNION ALL
SELECT * FROM (
  SELECT c.relname::text,
         (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'r' AND n.nspname = 'public'
  ORDER BY c.relname
) t;
SQL
