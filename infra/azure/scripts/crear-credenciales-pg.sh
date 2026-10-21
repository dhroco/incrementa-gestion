#!/usr/bin/env bash
# Genera la clave del administrador de PostgreSQL de un entorno y la deja en
# postgresql-credenciales-<entorno>.txt, en la raíz del repo (está en .gitignore).
# No pisa un archivo que ya exista: la clave se crea una sola vez.
#
#   ./infra/azure/scripts/crear-credenciales-pg.sh prod
set -euo pipefail

ENTORNO="${1:?Falta el entorno. Ejemplo: ./infra/azure/scripts/crear-credenciales-pg.sh prod}"
RAIZ="$(git rev-parse --show-toplevel)"
ARCHIVO="$RAIZ/postgresql-credenciales-$ENTORNO.txt"

if [ -e "$ARCHIVO" ]; then
  echo "Ya existe $ARCHIVO: no se toca." >&2
  exit 1
fi
if ! git -C "$RAIZ" check-ignore -q "$ARCHIVO"; then
  echo "$ARCHIVO no está en .gitignore: no se crea." >&2
  exit 1
fi

# 28 caracteres de letras y números, más un sufijo que asegura mayúscula, minúscula, número
# y símbolo (PostgreSQL de Azure exige 3 de esas 4 categorías).
CLAVE="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-28)Aa1-"

umask 077
cat > "$ARCHIVO" <<EOF
PGHOST=psql-incrementa-$ENTORNO.postgres.database.azure.com
PGPORT=5432
PGDATABASE=incrementa
PGUSER=incrementa_admin
PGPASSWORD=$CLAVE
PGSSLMODE=require
EOF

echo "Listo: $ARCHIVO (solo lectura para ti, fuera de git)."
