## Context

La migración a CASL (`replace-nav-auth-with-casl`) dejó operativos `profile`, `role_permissions` y `abilityService.js`, pero la UI de **Roles y permisos** quedó como placeholder: el menú ya expone la ruta con `check: { action: 'read', subject: 'RolePermission' }`, sin API ni pantallas de administración.

Los administradores de plataforma necesitan gestionar perfiles y permisos sin SQL manual. El patrón de referencia es **Usuarios de plataforma** (`platformUsersController`, `PlatformUsersListPage`, `PlatformUserCreatePage`): controller delgado, service con validaciones, `PageShell`, botones `.btn`, guards `RequireCan`.

Estado relevante:
- Tabla `profile`: `id`, `code`, `label`, `created_at`.
- Tabla `role_permissions`: FK `role_id → profile.id ON DELETE CASCADE`.
- Seed: `ADMINISTRADOR_PLATAFORMA` tiene `{ action: 'manage', subject: 'all' }`.
- No existe action `delete` en el catálogo de permisos de negocio.

## Goals / Non-Goals

**Goals:**

- Catálogo compartido backend/frontend (`permissionsCatalog.js`) como única fuente de verdad para subjects, actions y labels.
- API REST `/api/roles` con CRUD de perfiles y reemplazo atómico de permisos.
- UI completa: listado, creación (code + label) y detalle (label editable, matriz de permisos).
- Validaciones de negocio en backend: code inmutable, code único, rol admin protegido, bloqueo de delete con usuarios asignados, validación de pares action/subject (+ excepción `manage/all`).
- Autorización vía `authorize('…', 'RolePermission')` y `RequireCan`.
- Mensajes de error en español (es-CL).

**Non-Goals:**

- Permisos condicionales (`conditions`, `fields`, `inverted`) en la UI — la matriz solo maneja pares `{ action, subject }` simples.
- Asignación de usuarios a roles (permanece en módulo Usuarios).
- Action `delete` en el catálogo.
- Migraciones de BD nuevas.
- Optimistic update al guardar permisos — siempre re-fetch tras guardar.

## Decisions

### 1. Catálogo duplicado backend + frontend

Archivos idénticos en `backend/config/permissionsCatalog.js` y `frontend/src/config/permissionsCatalog.js`.

**Alternativa descartada**: endpoint `/api/permissions-catalog` — añade latencia y complejidad; el catálogo cambia raramente y debe coincidir en validación y render.

### 2. Reemplazo completo de permisos en transacción

`replaceRolePermissions` hace `DELETE` + `INSERT` en una transacción Knex. Array vacío = rol sin permisos (válido).

**Alternativa descartada**: diff incremental — más complejo sin beneficio claro para volúmenes pequeños de permisos.

### 3. Controller factory siguiendo `platformUsersController`

`createRolesController({ rolesService })` con handlers que delegan al service y usan `sendOk`/`sendError`.

**Alternativa descartada**: handlers sueltos — inconsistente con el resto del backend.

### 4. Service retorna `{ ok, data, status, code, message }`

Mismo patrón que `platformUsersAdminService` para errores de validación (400), conflicto (409), prohibido (403).

### 5. Matriz `PermissionMatrix` con estado derivado de Set `"subject:action"`

Props: `permissions`, `onChange`, `readOnly`. Renderiza `—` donde `ACTIONS_BY_SUBJECT[subject]` no incluye la action.

### 6. Caso especial `manage/all`

Detección: permisos contienen `{ action: 'manage', subject: 'all' }`. UI muestra panel "Acceso total" sin matriz. Listado muestra badge "Acceso total". Backend acepta `manage/all` en validación aunque no esté en catálogo.

### 7. Delete usa permiso `update` en RolePermission

Consistente con la spec del usuario: `DELETE /api/roles/:id` protegido con `authorize('update', 'RolePermission')`.

### 8. Rutas frontend bajo `admin-global/roles-permisos`

Ya definidas en `menuConfig.js`. Tres rutas: listado, `nuevo`, `:id`.

### 9. Code en UPPER_SNAKE_CASE solo en frontend al crear

Transformación en input de `RoleCreatePage`; backend valida no vacío y unicidad.

## Risks / Trade-offs

- **[Catálogo desincronizado]** → Mantener archivos idénticos; tests backend validan contra catálogo; comentario en ambos archivos indicando duplicación intencional.
- **[Cambio de permisos no reflejado en sesión activa]** → Usuarios afectados deben re-login o refrescar sesión; fuera de alcance (comportamiento existente de CASL).
- **[Eliminar todos los permisos de un rol]** → Usuarios con ese rol quedan sin acceso; operación válida pero peligrosa — mitigación: confirmación implícita al guardar matriz vacía (sin modal extra en v1).
- **[ADMINISTRADOR_PLATAFORMA editable]** → Label editable; permisos `manage/all` no editables vía matriz; delete bloqueado en backend.

## Migration Plan

1. Desplegar backend con rutas `/api/roles` (sin migraciones).
2. Desplegar frontend con páginas y rutas.
3. Verificar que usuario con `manage/all` accede al módulo completo.
4. Rollback: revertir deploy; datos en `profile`/`role_permissions` no se alteran estructuralmente.

## Open Questions

Ninguna bloqueante — la spec del usuario es exhaustiva.
