## Why

La autenticación y el aprovisionamiento de usuarios ya migraron a Keycloak/OIDC (changes previos); el frontend ya no usa Supabase (Change 5). El backend conserva dependencias npm, variables de entorno, defaults de `DATABASE_URL` y un cliente admin huérfano que ya no tienen consumidores. Mantener ese vestigio aumenta superficie de configuración errónea, expone secretos legacy en `config.js` y confunde el onboarding local.

## What Changes

- **Eliminar** `backend/lib/supabaseAdminClient.js` (sin importadores activos).
- **Eliminar** `backend/middleware/requireSupabaseAuth.js` (código muerto; ninguna ruta lo importa).
- **Dependencias**: quitar `@supabase/supabase-js` de `backend/package.json` y actualizar `package-lock.json` vía `npm uninstall`.
- **Config**: en `backend/config.js`, eliminar `SUPABASE_URL`, `SUPABASE_JWT_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` en todos los ambientes (`local`, `dev`, `prod`). En `local`, reemplazar el default de `DATABASE_URL` que apunta al pooler Supabase por la URL de GCP Postgres.
- **Script local**: en `backend/SET_VARS_AMBIENTE_LOCAL.cmd`, eliminar asignaciones y ecos de verificación de variables Supabase; limpiar comentarios que referencien Supabase Postgres/SSL donde aplique.
- **Sin lógica nueva**: no se agregan endpoints, middlewares ni servicios.
- **Fuera de alcance explícito**: frontend; controllers; servicios. Comentarios en migraciones/seeds que mencionen Supabase pueden permanecer (no son código ejecutable).

## Capabilities

### New Capabilities

- `backend-supabase-cleanup`: El backend no declara variables Supabase en config ni scripts locales, no incluye el paquete `@supabase/supabase-js`, y no contiene el cliente admin ni el middleware `requireSupabaseAuth` eliminados; verificación por grep y arranque del servidor.

### Modified Capabilities

<!-- Sin cambios de requisitos en specs existentes de auth/OIDC -->

## Impact

- **Backend**: `lib/supabaseAdminClient.js`, `middleware/requireSupabaseAuth.js` (borrados), `package.json`, `package-lock.json`, `config.js`, `SET_VARS_AMBIENTE_LOCAL.cmd`.
- **APIs**: ningún cambio de contrato; `POST /api/auth/login` y el resto de rutas OIDC deben seguir operativos.
- **Dependencias npm**: se elimina `@supabase/supabase-js` y sus transitivas del lockfile.
- **Despliegue**: ambientes `dev`/`prod` deben depender solo de `DATABASE_URL` y variables OIDC/Keycloak ya definidas; no requieren `SUPABASE_*`.
- **Prerequisito**: Change 5 (frontend) y migración OIDC/Keycloak en backend completados.

## Consideraciones de seguridad

- Al eliminar defaults hardcodeados de `SUPABASE_JWT_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` en `config.js` (especialmente `dev`), se reduce la exposición de secretos legacy en el repositorio.
- `DATABASE_URL` local pasa a apuntar por defecto a GCP; el script `SET_VARS_AMBIENTE_LOCAL.cmd` sigue siendo la fuente preferida en desarrollo y no debe versionarse con credenciales de producción.
- No se modifican flujos de autenticación; la validación de tokens sigue en `requireOidcAuth` y sesión vía Keycloak.
- Verificación post-cleanup: grep en `backend/` (excl. `node_modules`) sin referencias activas a `supabase` en código ejecutable y config; comentarios en migraciones/seeds excluidos; arranque con `node index.js` y smoke test de login.
