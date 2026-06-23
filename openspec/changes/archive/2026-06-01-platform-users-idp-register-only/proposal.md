## Why

La plataforma hoy crea usuarios, contraseñas temporales y rotaciones obligatorias en Keycloak desde el backend. Eso duplica responsabilidades con el IdP, aumenta superficie de error (rollback en Keycloak, `must_change_password` en BD) y obliga a flujos UX propios (`MandatoryPasswordChangePage`) que Keycloak ya puede cubrir. El principio acordado es: **la plataforma solo registra acceso en `user_profile`; la autenticación y las credenciales son 100% responsabilidad de Keycloak**.

## What Changes

- **BREAKING**: `POST /api/platform/users` deja de crear identidades en Keycloak; solo verifica email existente vía `findUserIdByEmail` y persiste `user_profile` con el UUID del IdP.
- **BREAKING**: Eliminación de `PUT /api/me/password` y `POST /api/me/password-rotation-complete`.
- **BREAKING**: Columna `user_profile.must_change_password` eliminada por migración Knex.
- Eliminación en backend: `createUser`, `resetUserPassword`, `deleteUser` del cliente admin Keycloak (referencia comentada durante la sesión); `generateTempPassword` y lógica de contraseña temporal en `platformUsersAdminService.js`.
- Eliminación en frontend: `MandatoryPasswordChangePage`, guard de router por `mustChangePassword`, pantalla/campos de contraseña temporal en `PlatformUserCreatePage.jsx`, estado `mustChangePassword` en `authSlice`.
- **Se conserva**: `findUserIdByEmail`, `updateUserEmail`, CRUD de `user_profile`, flag `is_active`, flujo de login OIDC sin cambios, edición de usuario (`PlatformUserEditPage` / `updatePlatformUser`) salvo referencias a `must_change_password`.

## Capabilities

### New Capabilities

- `platform-users-idp-register-only`: Registro de usuarios plataforma vinculando email preexistente en Keycloak; errores 422/409 en español; UI de creación sin contraseña; migración que elimina `must_change_password`.

### Modified Capabilities

- `backend-keycloak-admin-client`: Dejar de exigir creación/borrado/reset de credenciales; provisioning solo con lookup por email y actualización de email.
- `backend-me-password`: Retirar por completo el capability (endpoints de contraseña desde la app).
- `backend-auth-session-endpoints`: Sesión enriquecida sin `mustChangePassword`.
- `frontend-backend-auth-session`: Redux y guards sin `mustChangePassword` ni flujo de rotación obligatoria.
- `drop-contador-empresa-profiles`: Quitar requisitos que obligan `POST /api/me/password-rotation-complete`.

## Impact

- **Base de datos**: migración `DROP COLUMN must_change_password` en `user_profile`.
- **API**: comportamiento nuevo en creación de usuario plataforma; rutas `/api/me/password*` eliminadas.
- **Backend**: `keycloakAdminClient.js`, `platformUsersAdminService.js`, `meController.js`, `app.js`, `userSessionMetaService.js`, `sessionResponses.js`, tests asociados.
- **Frontend**: `PlatformUserCreatePage`, router/guards, `authSlice`, `meApi`, páginas y tests de contraseña obligatoria.
- **Keycloak**: administradores crean usuarios y contraseñas solo en Admin Console; el backend solo lee UUID por email.
- **Fuera de alcance**: login OIDC, middleware `requireOidcAuth`, edición de usuario salvo limpieza de `must_change_password`.

## Consideraciones de seguridad

- El backend sigue necesitando credenciales admin de Keycloak solo para **lookup** (`findUserIdByEmail`) y **cambio de email** (`updateUserEmail`); no almacena ni transmite contraseñas de usuarios finales.
- Mensajes de error no deben filtrar detalles internos de Keycloak; distinguir “usuario no encontrado” vs error de red/IdP no disponible.
- `is_active` en `user_profile` permanece como control de acceso a la plataforma independiente del estado en Keycloak.
- Tras el cambio, la rotación y políticas de contraseña se configuran únicamente en Keycloak (realm policies, required actions).
- Validar email en backend y frontend; respuestas en español (es-CL).
