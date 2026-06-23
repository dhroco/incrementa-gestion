## Why

Con Keycloak ya disponible como emisor OIDC local, el backend sigue validando JWTs contra Supabase (JWKS o HS256). Hay que desacoplar la autenticación del proveedor concreto y validar tokens OIDC genéricos (Keycloak hoy, Microsoft Entra ID después), sin tocar frontend ni la capa de autorización por perfiles en BD.

## What Changes

- Nuevo middleware `backend/middleware/requireOidcAuth.js` que valida Bearer JWT con **jose** (`createRemoteJWKSet` + `jwtVerify`), resolviendo JWKS desde el discovery document de `OIDC_ISSUER_URL` (sin URLs hardcodeadas).
- Misma interfaz de salida que el middleware actual: `req.auth = { userId, email }` (`sub` y `email` del JWT).
- `backend/config.js`: variables `OIDC_ISSUER_URL` (requerida) y `OIDC_AUDIENCE` (opcional, default `incrementa-backend`). `SUPABASE_JWT_SECRET` y demás vars Supabase se conservan por ahora.
- `backend/app.js`: importar `requireOidcAuth` en lugar de `requireSupabaseAuth` (solo el import; sin otros cambios en el archivo).
- `backend/SET_VARS_AMBIENTE_LOCAL.cmd`: `OIDC_ISSUER_URL` y `OIDC_AUDIENCE` apuntando a Keycloak local.
- **Limpieza infra Docker** (Keycloak corre como app Java standalone en Windows, no Docker):
  - Eliminar `docker-compose.yml` de la raíz.
  - Eliminar `infra/keycloak/scripts/bootstrap-test-users.sh`.
  - Conservar `infra/keycloak/import/incrementa-realm.json`.
  - Actualizar `infra/keycloak/README.md` para arranque standalone (`kc.bat start-dev --import-realm`).
  - Actualizar `infra/keycloak/.env.example`: quitar variables `TEST_USER_*` del bootstrap Docker.
- **No eliminar** `backend/middleware/requireSupabaseAuth.js` (limpieza en cambio posterior).
- **Sin cambios** en frontend, `requireNavigationGrant`, seeds de BD ni lógica de roles en el middleware.

## Capabilities

### New Capabilities

- `backend-oidc-auth-middleware`: Validación OIDC/JWKS del Bearer JWT en Express, configuración `OIDC_ISSUER_URL`/`OIDC_AUDIENCE`, integración en `app.js`, variables locales de desarrollo y documentación/limpieza de infra Keycloak standalone (sin Docker).

### Modified Capabilities

- _(Ninguno en `openspec/specs/`; el cambio previo `keycloak-local-oidc-infra` vive solo bajo `openspec/changes/` y este propose actualiza la documentación operativa en el repo, no un spec archivado global.)_

## Impact

- **Backend**: `middleware/requireOidcAuth.js` (nuevo), `config.js`, `app.js`, `SET_VARS_AMBIENTE_LOCAL.cmd`.
- **Infra**: eliminación de `docker-compose.yml` y script bootstrap Docker; README y `.env.example` de Keycloak.
- **API**: comportamiento HTTP 401 ante token ausente/inválido/expirado sin cambios; `/api/me/session` puede devolver 404 si `sub` no existe en `user_profile` (seeds Supabase pendientes de otro cambio).
- **Dependencias**: `jose` (ya instalada).
- **Fuera de alcance**: frontend, autorización por navegación/perfiles, alineación de UUIDs en seeds, eliminación de `requireSupabaseAuth.js`.

## Consideraciones de seguridad

- Validar `iss` (issuer) y, cuando aplique, `aud` (`OIDC_AUDIENCE`) en `jwtVerify` para rechazar tokens de otros emisores o audiencias.
- Cachear `RemoteJWKSet` a nivel de módulo; discovery JWKS lazy (primer request) para no bloquear el arranque si Keycloak está apagado.
- Errores de red al JWKS o tokens inválidos: **401** con mensajes en español (es-CL), no 500.
- Credenciales de Keycloak en README y `.env.example` siguen siendo solo desarrollo local; no exponer 8080 fuera del entorno del desarrollador.
