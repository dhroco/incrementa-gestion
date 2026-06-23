## Why

El backend valida hoy tokens OIDC (Keycloak) y resuelve al usuario interno por `sub` del JWT, que debe coincidir con `user_profile.user_id`. Al migrar a Microsoft Entra ID — y a futuro entre tenants — ese acoplamiento impide que el mismo usuario interno siga funcionando si cambia el IdP o el identificador externo. La vinculación por email desacopla identidad externa de identidad interna sin reescribir la cadena de autorización existente.

## What Changes

- Nuevo middleware `backend/middleware/resolveInternalIdentity.js` que, tras validar el token, busca `user_profile` por email normalizado y sobrescribe `req.auth.userId` con el `user_id` almacenado cuando hay match.
- Cableado en `backend/app.js` entre `requireAuth` y `attachAbilityMiddleware`.
- Extracción robusta del email en `requireOidcAuth.js`: `payload.email ?? payload.preferred_username`, normalizado con `normalizeAuthEmail`.
- Defaults OIDC de Entra ID en `backend/config.js` para entorno `local` (`OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, `OIDC_CLIENT_ID`); `process.env` mantiene prioridad.
- Migración Knex: índice único parcial case-insensitive sobre `user_profile.email`, con fallo explícito si existen duplicados previos.
- Tests del nuevo middleware y ajustes en tests de auth que asuman vinculación por `sub`.

**Sin cambios en esta etapa:**

- `buildPackedRulesForUser`, `loadSessionMetaForUser`, `getUserProfileIdByUserId`.
- Frontend y flujos ROPC (`/api/auth/login|refresh|logout`, `oidcAuthService`, `authController`).
- Tipo de columna `user_profile.user_id` (sigue siendo UUID).

## Capabilities

### New Capabilities

- `backend-email-identity-resolution`: Middleware de resolución de identidad interna por email, índice único en BD y cableado en la cadena Express post-autenticación.

### Modified Capabilities

- `backend-oidc-auth-middleware`: Extracción de email desde `email` o `preferred_username` (Entra), normalización consistente, y defaults de configuración OIDC para Entra ID en entorno local.

## Impact

- **Backend**: `middleware/resolveInternalIdentity.js` (nuevo), `middleware/requireOidcAuth.js`, `config.js`, `app.js`, migración Knex, tests.
- **Base de datos**: índice único parcial `user_profile_email_lower_unique` en `user_profile (LOWER(email)) WHERE email IS NOT NULL`.
- **API**: comportamiento HTTP sin cambios en códigos; usuarios con email en token y perfil asignado acceden aunque `sub` ≠ `user_id`. Sin match → flujo natural `PROFILE_NOT_ASSIGNED` (404).
- **Fuera de alcance**: frontend, ROPC, eliminación de Keycloak/ROPC, cambio de tenant en producción.

## Consideraciones de seguridad

- La vinculación por email exige unicidad case-insensitive en BD; la migración debe rechazar duplicados antes de crear el índice.
- El email del token y el de `user_profile` deben normalizarse con el mismo util (`normalizeAuthEmail`) para evitar bypass por variaciones de mayúsculas o espacios.
- Validación de `iss` y `aud` sigue en `requireOidcAuth`; con Entra v2 el `aud` esperado es el client ID GUID, no el URI `api://…`.
- Si no hay fila en `user_profile` para el email, no se altera `req.auth.userId` — el acceso queda denegado por la cadena existente, no por lógica nueva permisiva.
- JWKS cacheado por proceso: al cambiar `OIDC_ISSUER_URL` (Keycloak → Entra) se requiere reinicio del proceso para cargar claves del nuevo emisor.
