#!/usr/bin/env bash
# Lleva a la base de PROD (vacía) el esquema completo de pre-prod y SOLO los datos de
# configuración. Los clientes, proveedores, contratos y respaldos de migraciones de pre-prod
# son de prueba y no se copian (decisión de David, 21-oct): esas tablas quedan vacías.
#
# Requisitos: tu IP en el firewall de los dos servidores
#   (az account set … ; ./infra/azure/scripts/firewall-mi-ip.sh preprod|prod)
# y los archivos postgresql-credenciales-preprod.txt y -prod.txt en la raíz del repo.
#
#   ./infra/azure/scripts/copiar-datos-base-a-prod.sh
#
# Se niega a seguir si la base de prod ya tiene tablas. El respaldo queda en
# ~/Workspaces/respaldo-azure/ (tiene datos de prueba: no subirlo a ningún lado).
set -euo pipefail

RAIZ="$(git rev-parse --show-toplevel)"
CARPETA="$HOME/Workspaces/respaldo-azure"
FECHA="$(date +%Y%m%d-%H%M%S)"
RESPALDO="$CARPETA/preprod-$FECHA.dump"
LISTA="$CARPETA/preprod-$FECHA.lista-prod"
LOG="$CARPETA/restauracion-prod-$FECHA.log"

# Tablas cuyos DATOS sí van a prod. Todo lo demás llega solo como estructura (vacío).
CONFIGURACION=(company document_type identity_document_type knex_migrations knex_migrations_lock
  profile role_permissions social_network_catalog template template_standard user_profile)

con() { # con <entorno> -- comando…   (corre el comando con las credenciales de ese entorno)
  local entorno="$1"; shift
  ( unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSSLMODE
    set -a; . "$RAIZ/postgresql-credenciales-$entorno.txt"; set +a
    "$@" )
}

mkdir -p "$CARPETA"; chmod 700 "$CARPETA"

echo "1/5 La base de prod tiene que estar vacía…"
TABLAS="$(con prod psql -X -At -c "select count(*) from information_schema.tables where table_schema='public'")"
if [[ "$TABLAS" != "0" ]]; then
  echo "La base de prod ya tiene $TABLAS tablas. No restauro encima." >&2
  exit 1
fi

echo "2/5 Respaldo completo de pre-prod → $RESPALDO"
con preprod pg_dump -Fc --no-owner --no-acl -f "$RESPALDO"
chmod 600 "$RESPALDO"

echo "3/5 Lista de restauración: estructura de todo, datos solo de configuración…"
pg_restore -l "$RESPALDO" | awk -v keep="$(IFS=,; echo "${CONFIGURACION[*]}")" '
  BEGIN { n = split(keep, k, ","); for (i = 1; i <= n; i++) ok[k[i]] = 1 }
  / TABLE DATA public / {
    for (i = 1; i <= NF; i++) if ($i == "DATA") { tabla = $(i + 2); break }
    if (!(tabla in ok)) { print ";" $0; next }
  }
  { print }' > "$LISTA"
echo "   Datos que se copian: $(grep -c '^[0-9].* TABLE DATA public ' "$LISTA") tablas · se omiten: $(grep -c '^;.* TABLE DATA public ' "$LISTA")"

echo "4/5 Restaurando en prod…"
set +e
con prod pg_restore --no-owner --no-acl -L "$LISTA" -d incrementa "$RESPALDO" 2> "$LOG"
set -e
OTROS="$(grep '^pg_restore: error' "$LOG" | grep -vc 'transaction_timeout' || true)"
if [[ "$OTROS" != "0" ]]; then
  echo "pg_restore tuvo $OTROS errores (fuera de transaction_timeout). Detalle en $LOG:" >&2
  grep '^pg_restore: error' "$LOG" | grep -v 'transaction_timeout' | head -20 >&2
  exit 1
fi
echo "   Sin errores (detalle en $LOG)."

echo "5/5 Resultado en prod:"
"$RAIZ/infra/azure/scripts/inventario-bd.sh" prod | sed 's/^/   /'
echo
echo "   Usuarios copiados (se ajustan en el paso siguiente):"
con prod psql -X -At -F ' · ' -c "select email, is_active from user_profile order by email" | sed 's/^/     /'
