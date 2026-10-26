#!/usr/bin/env bash
# Borra plantillas de la base de PROD por su código (template_standard se va en cascada).
# Primero muestra lo que va a borrar y pide confirmación; todo en una transacción.
# Las plantillas siguen existiendo en pre-prod y en el respaldo de ~/Workspaces/respaldo-azure/.
#
#   ./infra/azure/scripts/borrar-plantillas-prod.sh PL0001 PL0002 PL0003 PL0004
set -euo pipefail

[[ $# -gt 0 ]] || { echo "Uso: $0 <código> [código…]   (ej.: PL0001 PL0002)" >&2; exit 1; }
RAIZ="$(git rev-parse --show-toplevel)"
CODIGOS="$(printf "'%s'," "$@" | sed 's/,$//')"
for c in "$@"; do [[ "$c" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "Código inválido: $c" >&2; exit 1; }; done

unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSSLMODE
set -a; . "$RAIZ/postgresql-credenciales-prod.txt"; set +a

echo "Plantillas en PROD que coinciden:"
psql -X -At -F ' · ' -c "select code, name from template where code in ($CODIGOS) order by code" | sed 's/^/  /'
N="$(psql -X -At -c "select count(*) from template where code in ($CODIGOS)")"
if [[ "$N" != "$#" ]]; then
  echo "Encontré $N de $# códigos. Revisa los códigos (son de 4 dígitos: PL0001…). No borro nada." >&2
  exit 1
fi
EN_USO="$(psql -X -At -c "select count(*) from draft_document d join template t on t.id = d.template_id where t.code in ($CODIGOS)" 2>/dev/null || echo 0)"
[[ "$EN_USO" == "0" ]] || { echo "Hay $EN_USO borradores que usan estas plantillas. No borro nada." >&2; exit 1; }

read -r -p "¿Borrar estas $N plantillas de PROD? Escribe 'si' para confirmar: " R
[[ "$R" == "si" ]] || { echo "Cancelado. No se borró nada."; exit 0; }

psql -X -v ON_ERROR_STOP=1 -q <<SQL
BEGIN;
DELETE FROM template WHERE code IN ($CODIGOS);
COMMIT;
SQL
echo "Listo. Quedan $(psql -X -At -c 'select count(*) from template') plantillas en prod:"
psql -X -At -F ' · ' -c "select code, name from template order by code" | sed 's/^/  /'
