## Why

El producto consolidó la operación en un único rol operativo: **ADMINISTRADOR_PLATAFORMA**. Los perfiles **CONTADOR** y **USUARIO_EMPRESA_ADMINISTRADOR** introducen tablas dedicadas (`accountant`, `accountant_company`, `company_internal_user`), rutas API, páginas de administración, grants de navegación, roles Keycloak y lógica de sesión que ya no se usan ni se mantendrán. Eliminarlos reduce superficie de ataque, complejidad de seeds/migraciones futuras y deuda en frontend/backend.

## What Changes

- **BREAKING**: Nueva migración destructiva que elimina tablas `accountant_company`, `accountant`, `company_internal_user` y filas de `profile` / `user_profile` para códigos `CONTADOR` y `USUARIO_EMPRESA_ADMINISTRADOR` (grants en `profile_navigation_grant` vía `ON DELETE CASCADE` en FK `profile_id`).
- **BREAKING**: Eliminación de endpoints `/api/platform/accountants`, `/api/accountants`, `/api/companies/:id/accountants`, `/api/company-internal-users` y rutas internas de empresa asociadas.
- **Seeds**: `001_profiles_seed.js`, `002_navigation_authorization_seed.js`, `010_gfa_user_profile_and_inheritance_seed.js` dejan de insertar esos perfiles, grants y usuarios de prueba (`contador@`, `empresa@`).
- **Backend**: Borrado de controllers/servicios/scripts/tests dedicados; limpieza de `app.js`, libs de scope, `userSessionMetaService`, `sessionResponses`, `companyService`/`companyController` (métodos de asignación contador), tests que asumen esos perfiles.
- **Relocalización**: `POST /api/me/password-rotation-complete` pasa de `accountantPlatformController` a `meController` (sigue siendo necesario para `MandatoryPasswordChangePage` y admin).
- **Frontend**: Borrado de 9 páginas, `accountantsPlatformApi.js`, hook `useEmployeeCompanyScope.js` si queda huérfano; limpieza de `AppRouter`, `authSlice`, navegación, tests y `MandatoryPasswordChangePage` (mover llamada API a cliente genérico).
- **Keycloak**: Quitar roles realm `CONTADOR`, `USUARIO_EMPRESA_ADMINISTRADOR` y usuarios de prueba del realm import.
- **Limpieza**: Grep residual en `frontend/src` y `backend` (excl. `node_modules` y migraciones históricas).

**No se modifica**: migraciones existentes (solo se agrega la nueva); tabla `company`; perfil `ADMINISTRADOR_PLATAFORMA` ni flujos de usuarios plataforma (`/api/platform/users`). **Nota**: no existe perfil `USUARIO_PLATAFORMA` en seeds actuales — solo `ADMINISTRADOR_PLATAFORMA` permanece tras este change.

## Capabilities

### New Capabilities

- `drop-contador-empresa-profiles`: El sistema ya no define ni opera perfiles `CONTADOR` ni `USUARIO_EMPRESA_ADMINISTRADOR` en BD, API, UI, seeds ni Keycloak; sesión enriquecida y navegación reflejan únicamente `ADMINISTRADOR_PLATAFORMA` (y usuarios plataforma gestionados por rutas existentes).

### Modified Capabilities

- `backend-auth-session-endpoints`: Eliminar campos y ramas de sesión específicas de contador (`accountantIsActive`, `assignedCompanies`, `buildAccountantInactiveBody`, company context automático para empresa admin).
- `frontend-backend-auth-session`: Eliminar estado `accountant_inactive`, hidratación de `assignedCompanies` y selectores `enrichedAccountantIsActive`.
- `backend-keycloak-admin-client`: Eliminar requisitos que obligan `accountantAdminService` e `internalCompanyUsersService`; scripts de borrado solo para perfiles restantes.

## Impact

- **Base de datos**: tablas eliminadas; datos de perfiles/usuarios asociados borrados irreversiblemente en `up`.
- **API**: rutas de contadores y usuarios internos dejan de existir (404); sesión `/api/me/session` simplificada.
- **Frontend**: menú sin entradas de contadores ni usuarios internos empresa; Redux sin estado de inactividad contador.
- **Keycloak**: realm import y usuarios de prueba alineados.
- **Prerequisito**: auth OIDC/Keycloak operativo; ningún usuario productivo debe depender de los perfiles eliminados.

## Consideraciones de seguridad

- Migración destructiva: ejecutar primero en entornos no productivos; respaldar BD antes de `migrate:latest` en GCP.
- Eliminar roles Keycloak evita asignación accidental de realm roles obsoletos.
- Usuarios huérfanos en Keycloak sin fila `user_profile` válida ya reciben 404 en sesión — verificar que no queden tokens activos de cuentas eliminadas.
- `completePasswordRotation` debe seguir validando `is_active` solo para `ADMINISTRADOR_PLATAFORMA` tras el cambio.
- Mensajes de error al admin permanecen en español (es-CL).
