## Why

El módulo de gestión de usuarios de plataforma aún pide y persiste datos personales (nombre, teléfono, RUT) que no corresponden a su propósito real: registrar qué usuarios del IdP tienen acceso y con qué rol. La identidad (nombre) ya vive en Keycloak; duplicarla en formularios admin genera inconsistencias y carga operativa innecesaria. Tras el refactor IdP-only (`platform-users-idp-register-only`), este cambio completa el modelo: la plataforma solo vincula email → rol → activo; el nombre se obtiene de Keycloak al crear.

## What Changes

- **BREAKING**: `POST /api/platform/users` deja de aceptar `full_name`, `phone`, `rut` / `rut_body` / `rut_dv`; el payload válido es `email`, `profile_code`, `is_active` (opcional, default `true`).
- **BREAKING**: `PATCH /api/platform/users/:id` deja de aceptar ni actualizar `full_name`, `phone`, `rut_body`, `rut_dv`.
- **BREAKING**: Respuestas de listado/detalle de usuarios plataforma dejan de incluir `phone`, `rut_body`, `rut_dv`.
- `findUserIdByEmail` en `keycloakAdminClient.js` retorna `{ id, fullName } | null` en lugar de solo UUID; `fullName` se construye desde `firstName` + `lastName` de Keycloak, con fallback al email si ambos están vacíos.
- Al crear usuario, `user_profile.full_name` se persiste con el `fullName` retornado por Keycloak (no lo ingresa el admin).
- Migración Knex idempotente: `DROP COLUMN phone`, `rut_body`, `rut_dv` en `user_profile` (con `down` que las recrea nullable).
- Frontend: formularios de crear/editar usuarios plataforma reducidos a email, rol y activo; listado y vista detalle sin teléfono ni RUT; nombre no editable (solo lectura en detalle o omitido en formularios).
- **Sin cambios**: flujo OIDC/login, middleware de auth, campos `avatar_gcs_path`, `contact_email`, `widget_preferences` (módulo Mi Perfil), columna `full_name` (sigue usándose, poblada desde Keycloak).

## Capabilities

### New Capabilities

- `platform-users-admin`: Gestión de usuarios plataforma como registro de acceso IdP — payload mínimo (email, rol, activo), nombre desde Keycloak al crear, sin teléfono/RUT en BD ni UI.

### Modified Capabilities

- `backend-keycloak-admin-client`: `findUserIdByEmail` retorna objeto `{ id, fullName }` además del UUID; callers actualizados.

## Impact

- **Base de datos**: migración `202606030002` (aprox.) que elimina `phone`, `rut_body`, `rut_dv` de `user_profile`.
- **Backend**: `keycloakAdminClient.js`, `platformUsersAdminService.js`, `delete-app-user.js` (caller de `findUserIdByEmail`), tests de API y servicio.
- **Frontend**: `PlatformUserCreatePage.jsx`, `PlatformUserEditPage.jsx`, `PlatformUserViewPage.jsx`, `PlatformUsersListPage.jsx`.
- **Fuera de alcance**: login OIDC, `requireOidcAuth`, Mi Perfil, seeds históricos salvo ajustes mínimos si rompen tests.
- **Referencias a verificar**: grep de `phone`, `rut_body`, `rut_dv` en contexto `user_profile` antes de eliminar columnas.

## Consideraciones de seguridad

- No se almacenan ni solicitan datos personales adicionales (teléfono, RUT) en el módulo admin; reduce superficie de datos sensibles en la aplicación.
- El backend sigue usando credenciales admin de Keycloak solo para lookup y cambio de email; mensajes de error en español (es-CL) sin filtrar detalles internos del IdP.
- `full_name` en BD es caché de display derivada de Keycloak al crear; no es fuente de verdad — la identidad canonical sigue en el IdP.
- Validación de email en backend y frontend; `is_active` permanece como control de acceso independiente del estado en Keycloak.
