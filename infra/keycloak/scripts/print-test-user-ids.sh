#!/bin/sh
# Imprime UUID (sub) de usuarios de prueba — ejecutar con Keycloak en marcha.
set -eu

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM="${KEYCLOAK_REALM:-incrementa}"

token=$(curl -sf -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=admin-cli" \
  -d "username=${KEYCLOAK_ADMIN}" \
  -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
  -d "grant_type=password" \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

for email in admin@incrementa.la contador@incrementa.la empresa@incrementa.la; do
  id=$(curl -sf -G "${KEYCLOAK_URL}/admin/realms/${REALM}/users" \
    -H "Authorization: Bearer ${token}" \
    --data-urlencode "email=${email}" \
    --data-urlencode "exact=true" \
    | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -n 1)
  echo "${email}  sub=${id}"
done
