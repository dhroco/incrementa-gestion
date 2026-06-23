## ADDED Requirements

### Requirement: Permissions catalog defines valid action-subject pairs

The system SHALL maintain `permissionsCatalog.js` in both `backend/config/` and `frontend/src/config/` with identical content exporting:

- `SUBJECTS`: array of `{ id, label }` for Company, PlatformUser, Supplier, Template, DocumentBuilder, Dashboard, RolePermission.
- `ACTIONS_BY_SUBJECT`: map of subject id to allowed action strings or null when an action does not apply.
- `ACTION_LABELS`: map of action to Spanish label (read→Ver, create→Crear, update→Editar, use→Usar).

The catalog SHALL NOT define action `delete`. Allowed actions are only: `read`, `create`, `update`, `use`.

#### Scenario: DocumentBuilder allows only use

- **WHEN** the catalog is loaded
- **THEN** `ACTIONS_BY_SUBJECT.DocumentBuilder` equals `['use']`
- **AND** `read`, `create`, and `update` are not valid for DocumentBuilder

### Requirement: rolesService manages profiles and permissions

Service `backend/services/rolesService.js` SHALL expose:

- `listRoles()`: all profiles with `id`, `code`, `label`, `permissionsCount`, `createdAt`, `usersCount` (count of `user_profile` rows with matching `profile_id`).
- `getRoleById(roleId)`: profile plus `permissions` array of `{ id, action, subject, inverted }` from `role_permissions`.
- `createRole({ code, label })`: validate non-empty code and label; validate code uniqueness in `profile`; insert and return new role.
- `updateRoleLabel({ roleId, label })`: update only `profile.label`; code is immutable.
- `deleteRole(roleId)`: reject if `user_profile` has rows for that profile with message "No se puede eliminar un rol con usuarios asignados."; reject if profile code is `ADMINISTRADOR_PLATAFORMA` with message "El rol de Administrador de plataforma no puede eliminarse."; otherwise DELETE from `profile` (CASCADE removes `role_permissions`).
- `replaceRolePermissions({ roleId, permissions })`: accept array of `{ action, subject }`; validate each pair against `ACTIONS_BY_SUBJECT` in permissions catalog; always accept `{ action: 'manage', subject: 'all' }`; in a transaction DELETE all `role_permissions` for role then INSERT new rows; return saved permissions array. Empty array is valid.

#### Scenario: Create role with duplicate code fails

- **WHEN** `createRole` is called with a code that already exists in `profile`
- **THEN** the service returns an error indicating the code is not unique

#### Scenario: Delete role with assigned users fails

- **WHEN** `deleteRole` is called for a profile with one or more `user_profile` rows
- **THEN** the service returns an error with message "No se puede eliminar un rol con usuarios asignados."

#### Scenario: Delete platform admin role fails

- **WHEN** `deleteRole` is called for profile code `ADMINISTRADOR_PLATAFORMA`
- **THEN** the service returns an error with message "El rol de Administrador de plataforma no puede eliminarse."

#### Scenario: Invalid permission pair rejected

- **WHEN** `replaceRolePermissions` receives `{ action: 'delete', subject: 'Company' }`
- **THEN** the service rejects the request
- **AND** no rows in `role_permissions` are modified

#### Scenario: manage all always valid

- **WHEN** `replaceRolePermissions` receives `{ action: 'manage', subject: 'all' }`
- **THEN** the pair is accepted even though it is not listed in `ACTIONS_BY_SUBJECT`

### Requirement: Roles REST API endpoints

Controller `backend/controllers/rolesController.js` (factory pattern) SHALL register routes in `app.js` after platform users routes, each protected with `authorize` on subject `RolePermission`:

| Method | Path | authorize | Handler |
|--------|------|-----------|---------|
| GET | `/api/roles` | read | getList |
| POST | `/api/roles` | create | postCreate |
| GET | `/api/roles/:id` | read | getById |
| PUT | `/api/roles/:id/label` | update | putUpdateLabel |
| DELETE | `/api/roles/:id` | update | deleteRole |
| PUT | `/api/roles/:id/permissions` | update | putPermissions |

Request bodies: POST `{ code, label }`; PUT label `{ label }`; PUT permissions `{ permissions: [{ action, subject }] }`.

#### Scenario: List roles requires read RolePermission

- **WHEN** an authenticated user without `can('read', 'RolePermission')` calls `GET /api/roles`
- **THEN** the response status is **403**

#### Scenario: Create role succeeds with permission

- **WHEN** a user with `can('create', 'RolePermission')` POSTs valid `{ code, label }`
- **THEN** the response status is **201** or **200** with the created role

### Requirement: Frontend roles API client

File `frontend/src/api/rolesApi.js` SHALL export functions following the pattern of `suppliersApi.js`:

- `fetchRolesList({ accessToken })`
- `fetchRoleById(id, { accessToken })`
- `createRole(payload, { accessToken })`
- `updateRoleLabel(id, { label }, { accessToken })`
- `deleteRole(id, { accessToken })`
- `saveRolePermissions(id, permissions, { accessToken })`

#### Scenario: API client uses authenticated requests

- **WHEN** `fetchRolesList` is called with a valid access token
- **THEN** it sends `GET /api/roles` with Authorization header via shared `apiClient`

### Requirement: Roles list page

Page `frontend/src/pages/RolesListPage.jsx` SHALL:

- Use `PageShell` with title "Roles y permisos".
- Show "Nuevo rol" button when `ability.can('create', 'RolePermission')`.
- Display table columns: Nombre del rol, Código, Usuarios asignados, Permisos, Acciones.
- Show "Ver/Editar" action when `ability.can('update', 'RolePermission')`.
- Show empty state when no roles exist.
- Show badge "Acceso total" for roles whose permissions include `{ action: 'manage', subject: 'all' }`.

#### Scenario: Create button hidden without permission

- **WHEN** the user lacks `can('create', 'RolePermission')`
- **THEN** the "Nuevo rol" button is not rendered

### Requirement: Role detail page

Page `frontend/src/pages/RoleDetailPage.jsx` SHALL provide:

- Section 1: editable label input, readonly code, "Guardar nombre" button calling `updateRoleLabel`.
- Section 2: if role has `manage/all`, show panel "Acceso total — este rol tiene control completo sobre el sistema" without PermissionMatrix; otherwise show `PermissionMatrix` and "Guardar permisos" calling `saveRolePermissions` followed by re-fetch (no optimistic update).
- Breadcrumb: Administración Global → Roles y permisos → [role label].
- "Eliminar rol" button only when `usersCount === 0` and `ability.can('update', 'RolePermission')`.

#### Scenario: Permissions saved triggers re-fetch

- **WHEN** the user saves permissions successfully
- **THEN** the page re-fetches the role from the API before updating displayed state

### Requirement: Permission matrix component

Component `frontend/src/components/PermissionMatrix.jsx` SHALL:

- Render subjects as rows and actions (Ver, Crear, Editar, Usar) as columns based on `permissionsCatalog`.
- Show em dash (—) where an action does not apply to a subject.
- Use checkboxes for valid pairs; maintain internal Set of `"subject:action"` keys.
- Accept props `permissions`, `onChange(newPermissions)`, and optional `readOnly`.
- Use existing table styles from the design system.

#### Scenario: Toggle checkbox updates permissions array

- **WHEN** the user checks "Crear" for subject Company
- **THEN** `onChange` is called with an array including `{ action: 'create', subject: 'Company' }`

### Requirement: Role create page

Page `frontend/src/pages/RoleCreatePage.jsx` SHALL:

- Collect required fields: label (Nombre del rol) and code (Código).
- Transform code input to UPPER_SNAKE_CASE while typing (uppercase, no spaces).
- NOT show PermissionMatrix on create.
- On successful POST, redirect to detail page of the new role.

#### Scenario: Code normalized on input

- **WHEN** the user types "admin global" in the code field
- **THEN** the displayed value becomes uppercase snake case equivalent (e.g. `ADMIN_GLOBAL`)

### Requirement: Frontend routes for roles module

`AppRouter.jsx` SHALL register under admin-global, guarded with `RequireCan`:

- `admin-global/roles-permisos` → `RequireCan I="read" a="RolePermission"` → `RolesListPage`
- `admin-global/roles-permisos/nuevo` → `RequireCan I="create" a="RolePermission"` → `RoleCreatePage`
- `admin-global/roles-permisos/:id` → `RequireCan I="read" a="RolePermission"` → `RoleDetailPage`

#### Scenario: Unauthorized user redirected

- **WHEN** a user without read RolePermission navigates to the roles list route
- **THEN** the user is redirected to `/app/acceso-denegado`

### Requirement: Visual consistency for roles UI

Roles pages SHALL use class `.btn` for all action buttons, `PageShell` with breadcrumb pattern matching Platform Users, and existing card/table classes from `global.css`. No new CSS files unless strictly necessary.

#### Scenario: Action buttons use btn class

- **WHEN** RolesListPage renders "Nuevo rol" or row actions
- **THEN** those elements use className `btn`
