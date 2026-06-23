## Why

Tras migrar la autorización a CASL, los permisos viven en `role_permissions` pero no existe una interfaz para administrarlos. Los administradores de plataforma necesitan crear perfiles, asignar permisos granulares y mantener el catálogo de acciones sin tocar la base de datos directamente.

## What Changes

- Catálogo compartido de subjects y actions (`permissionsCatalog.js`) como fuente de verdad en backend y frontend.
- API REST `/api/roles` para listar, crear, editar label, eliminar perfiles y reemplazar permisos CASL.
- Service `rolesService.js` con validaciones de negocio (code inmutable, rol protegido, usuarios asignados, pares action/subject válidos).
- Pantallas frontend bajo **Administración Global → Roles y permisos**: listado, creación y detalle con matriz de permisos.
- Componente `PermissionMatrix` para renderizar subjects × actions con checkboxes.
- Caso especial `manage/all` para `ADMINISTRADOR_PLATAFORMA`: badge "Acceso total" sin matriz editable.
- Rutas protegidas con `authorize('…', 'RolePermission')` en backend y `RequireCan` en frontend.

## Capabilities

### New Capabilities

- `roles-permissions-admin`: CRUD de perfiles (`profile`) y gestión de permisos CASL (`role_permissions`) vía API y UI, incluyendo catálogo de permisos, matriz visual y reglas de negocio (code inmutable, rol admin no eliminable, validación de pares action/subject).

### Modified Capabilities

- `casl-authorization`: Se extiende el contrato de autorización con endpoints y subject `RolePermission` ya referenciado en menú; la spec delta documentará las rutas `/api/roles/*` y el catálogo de permisos como contrato de validación al guardar.

## Impact

- **Backend**: `backend/config/permissionsCatalog.js`, `backend/services/rolesService.js`, `backend/controllers/rolesController.js`, rutas en `backend/app.js`, tests de API.
- **Frontend**: `frontend/src/config/permissionsCatalog.js`, `frontend/src/api/rolesApi.js`, páginas `RolesListPage`, `RoleCreatePage`, `RoleDetailPage`, componente `PermissionMatrix`, rutas en `AppRouter.jsx`.
- **Base de datos**: Sin migraciones nuevas; opera sobre tablas existentes `profile`, `role_permissions` y `user_profile`.
- **Seguridad**: Solo usuarios con permiso `RolePermission` acceden al módulo. Validación server-side de todos los pares action/subject. El rol `ADMINISTRADOR_PLATAFORMA` no puede eliminarse. No se expone edición de `profile.code` tras creación.
- **Locale**: Mensajes de error en español (es-CL).
