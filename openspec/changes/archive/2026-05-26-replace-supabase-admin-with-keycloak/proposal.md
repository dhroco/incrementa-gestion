## Why

Con OIDC/Keycloak ya validando sesiones en el backend, el aprovisionamiento de usuarios (contadores, usuarios de plataforma, usuarios internos de empresa y contraseñas temporales) sigue dependiendo de `supabaseAdminClient` y `admin.createUser()` de Supabase Auth. Eso impide operar en local sin Supabase, desalinea el `user_id` de `user_profile` con el `sub` del IdP real y bloquea la migración completa a Keycloak.

## What Changes

- Nuevo `backend/lib/keycloakAdminClient.js` con `createUser`, `deleteUser` y `updateUserEmail`, usando **fetch** nativo contra Keycloak Admin REST API (sin `@supabase/supabase-js`). `createUser` crea credencial **activa** en Keycloak (sin `requiredActions` ni contraseña temporal en el IdP).
- Token de admin del realm **master** vía ROPC (`KEYCLOAK_ADMIN_USER` / `KEYCLOAK_ADMIN_PASSWORD`), con caché en memoria y renovación si quedan menos de 10 s de vida.
- `backend/config.js`: `KEYCLOAK_ADMIN_URL`, `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD` (requerida), `KEYCLOAK_REALM` (default `incrementa`).
- `backend/SET_VARS_AMBIENTE_LOCAL.cmd`: agregar `KEYCLOAK_ADMIN_PASSWORD=admin` (y vars admin relacionadas si faltan).
- Reemplazar `getSupabaseAdminClient()` en:
  - `backend/services/accountantAdminService.js`
  - `backend/services/platformUsersAdminService.js`
  - `backend/services/internalCompanyUsersService.js`
- Revisar `backend/controllers/accountantPlatformController.js` / `completePasswordRotation`: sin cambio de semántica; `must_change_password` sigue controlado **solo en BD** (igual que con Supabase), no en Keycloak.
- Comentario de deuda técnica en `keycloakAdminClient.js`: migración futura a Microsoft Entra ID reemplazará `must_change_password` por políticas nativas del IdP.
- Actualizar scripts `backend/scripts/delete-accountant-user.js` y `delete-app-user.js`: sin referencias a `auth.users` (la BD GCP no tiene esquema `auth`); borrar por `user_profile.user_id` + Keycloak Admin API.
- Rollback compensatorio: si falla la transacción en BD tras crear el usuario en Keycloak, llamar `deleteUser(keycloakUserId)`.
- **No eliminar** `backend/lib/supabaseAdminClient.js` (limpieza en cambio posterior).
- **Sin cambios** en frontend, `requireOidcAuth.js`, endpoints de sesión OIDC ya implementados.

## Capabilities

### New Capabilities

- `backend-keycloak-admin-client`: Cliente servidor para Keycloak Admin API (token master, CRUD mínimo de usuarios, credencial activa en alta, `must_change_password` solo en BD, configuración y mensajes de error en es-CL).

### Modified Capabilities

- _(Ninguno en `openspec/specs/`; los flujos de admin de usuarios no tienen spec archivado global; el contrato nuevo vive en este change.)_

## Impact

- **Backend**: nuevo `keycloakAdminClient.js`, `config.js`, tres servicios admin de usuarios, scripts de borrado, variables locales.
- **IdP**: usuarios creados en realm `incrementa` de Keycloak; `username` = email; `emailVerified: true`; UUID del header `Location` como `user_profile.user_id`.
- **API**: mismos endpoints y códigos de error orientativos (`ADMIN_CLIENT_UNAVAILABLE`, `AUTH_CREATE_FAILED`, etc.) con mensajes actualizados cuando falte config de Keycloak admin.
- **Dependencias**: sin nuevas npm; solo `fetch`.
- **Fuera de alcance**: frontend, middleware OIDC/sesión, eliminación de `supabaseAdminClient.js` y tablas `auth.*` de Supabase.

## Consideraciones de seguridad

- `KEYCLOAK_ADMIN_PASSWORD` solo en servidor; nunca en frontend ni en commits (local vía `SET_VARS_AMBIENTE_LOCAL.cmd` gitignored).
- Token de admin del realm master con TTL corto; caché en proceso sin persistir en disco.
- Credenciales de usuario final (contraseña temporal) solo en tránsito servidor→Keycloak; no loguear passwords.
- Validación de email y payload sigue en servicios existentes antes de llamar a Keycloak.
- Errores al usuario en español (es-CL); no exponer stack traces de Keycloak.
