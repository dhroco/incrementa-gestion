#!/usr/bin/env bash
# Deja en la base de prod solo los usuarios iniciales: David y Marcela (decisión del 21-oct).
#   - La fila de dvd.roco@gmail.com (pre-prod) pasa a ser la cuenta de David en el tenant de
#     Incrementa: conserva su perfil, cambia su email y su user_id (object id de Entra).
#   - Marcela conserva su perfil; su user_id pasa a su object id en el tenant de Incrementa.
#   - Las demás filas de pre-prod (droco@engineer.com, mcp@incrementa.la, …) se borran.
# El backend reconoce a cada persona por el email del token, y user_id debe ser su object id.
#
# Requiere: az con la sesión en el tenant de Incrementa y tu IP en el firewall de prod.
#
#   ./infra/azure/scripts/usuarios-iniciales-prod.sh
set -euo pipefail

RAIZ="$(git rev-parse --show-toplevel)"
DAVID_ANTES="dvd.roco@gmail.com"
MARCELA="marcela.fuentes@incrementa.la"

DAVID_EMAIL="$(az ad signed-in-user show --query userPrincipalName -o tsv | tr 'A-Z' 'a-z')"
DAVID_OID="$(az ad signed-in-user show --query id -o tsv)"
MARCELA_OID="$(az ad user show --id "$MARCELA" --query id -o tsv)"
echo "David:   $DAVID_EMAIL ($DAVID_OID)"
echo "Marcela: $MARCELA ($MARCELA_OID)"
[[ "$DAVID_EMAIL" == *@incrementa.* ]] || { echo "La sesión de az no es la de Incrementa ($DAVID_EMAIL)." >&2; exit 1; }

unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSSLMODE
set -a; . "$RAIZ/postgresql-credenciales-prod.txt"; set +a

psql -X -v ON_ERROR_STOP=1 -q \
  -v david_antes="$DAVID_ANTES" -v david_email="$DAVID_EMAIL" -v david_oid="$DAVID_OID" \
  -v marcela="$MARCELA" -v marcela_oid="$MARCELA_OID" <<'SQL'
BEGIN;
DELETE FROM user_profile
 WHERE lower(email) NOT IN (lower(:'david_antes'), lower(:'david_email'), lower(:'marcela'));
UPDATE user_profile SET email = :'david_email', user_id = :'david_oid', updated_at = now()
 WHERE lower(email) IN (lower(:'david_antes'), lower(:'david_email'));
UPDATE user_profile SET user_id = :'marcela_oid', updated_at = now()
 WHERE lower(email) = lower(:'marcela');
DO $$ BEGIN
  IF (SELECT count(*) FROM user_profile) <> 2 THEN
    RAISE EXCEPTION 'Quedarían % usuarios, se esperaban 2: no se guarda nada.', (SELECT count(*) FROM user_profile);
  END IF;
END $$;
COMMIT;
SQL

echo "Usuarios en prod:"
psql -X -At -F ' · ' -c "select up.email, p.code, up.is_active from user_profile up join profile p on p.id = up.profile_id order by 1" | sed 's/^/  /'
