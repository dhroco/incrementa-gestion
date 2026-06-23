## 1. Configuración backend

- [x] 1.1 Agregar `OIDC_ISSUER_URL` y `OIDC_AUDIENCE` (default `incrementa-backend`) en `backend/config.js` para `local`, `dev` y `prod` vía `process.env`, sin eliminar variables Supabase existentes
- [x] 1.2 Actualizar `backend/SET_VARS_AMBIENTE_LOCAL.cmd` con `OIDC_ISSUER_URL=http://localhost:8080/realms/incrementa` y `OIDC_AUDIENCE=incrementa-backend` (incluir echo de verificación si el script ya lo hace para otras vars)

## 2. Middleware OIDC

- [x] 2.1 Crear `backend/middleware/requireOidcAuth.js` con `getBearerToken`, lazy fetch de discovery (`{OIDC_ISSUER_URL}/.well-known/openid-configuration`), `createRemoteJWKSet` cacheado a nivel módulo, y `jwtVerify` con `issuer` y `audience`
- [x] 2.2 Implementar `req.auth = { userId, email }` y respuestas 401 en español con los mismos códigos que `requireSupabaseAuth` (`AUTH_MISSING_TOKEN`, `AUTH_INVALID_TOKEN`, `AUTH_INVALID_OR_EXPIRED_TOKEN`, `AUTH_SERVER_MISCONFIG` si falta issuer)
- [x] 2.3 Asegurar que errores de red JWKS y tokens inválidos respondan 401, no 500

## 3. Integración Express

- [x] 3.1 En `backend/app.js`, cambiar únicamente el import y el default `requireAuth = requireOidcAuth` (dejar `requireSupabaseAuth.js` sin borrar)

## 4. Limpieza infra Keycloak (standalone)

- [x] 4.1 Eliminar `docker-compose.yml` de la raíz del proyecto
- [x] 4.2 Eliminar `infra/keycloak/scripts/bootstrap-test-users.sh`
- [x] 4.3 Actualizar `infra/keycloak/.env.example`: quitar variables `TEST_USER_*`; conservar admin y `KEYCLOAK_CLIENT_SECRET`
- [x] 4.4 Reescribir `infra/keycloak/README.md` para Keycloak Java standalone (comando `kc.bat start-dev --import-realm`, paths Windows, discovery URL, sin instrucciones Docker Compose)
- [x] 4.5 Verificar que `infra/keycloak/import/incrementa-realm.json` se mantiene sin cambios funcionales requeridos por este change

## 5. Verificación manual

- [x] 5.1 Arrancar backend con `OIDC_ISSUER_URL` configurada y Keycloak en marcha — confirmar que el proceso inicia sin error aunque el IdP se haya iniciado después del backend
- [x] 5.2 `GET /api/me/session` sin token → **401**
- [x] 5.3 `GET /api/me/session` con access token válido de Keycloak (ROPC o client credentials de prueba) → **200** o **404** (404 aceptable por seeds)
- [x] 5.4 Token expirado o manipulado → **401**
