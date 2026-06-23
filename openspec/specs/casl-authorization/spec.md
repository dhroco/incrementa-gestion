# casl-authorization Specification

## Purpose
TBD - created by archiving change replace-nav-auth-with-casl. Update Purpose after archive.
## Requirements
### Requirement: role_permissions table stores CASL rules per profile

The system SHALL persist authorization rules in table `role_permissions` with columns: `id` (UUID PK), `role_id` (FK to `profile.id`, ON DELETE CASCADE), `action` (string, max 50), `subject` (string, max 100), optional `fields` and `conditions` (JSONB), `inverted` (boolean, default false), optional `reason`, and `created_at`. Migration `202605290014_create_role_permissions.js` SHALL create this table. Migration `202605290015_drop_navigation_authorization_tables.js` SHALL drop tables `profile_navigation_grant` and `navigation_node` after `role_permissions` exists.

#### Scenario: Migrations apply in order

- **WHEN** `knex migrate:latest` runs on a database with legacy navigation tables
- **THEN** `role_permissions` is created before navigation tables are dropped
- **AND** `profile_navigation_grant` and `navigation_node` no longer exist after completion

### Requirement: Platform admin seed grants manage all

Seed `003_casl_permissions_seed.js` SHALL insert exactly one rule for profile code `ADMINISTRADOR_PLATAFORMA`: `{ action: 'manage', subject: 'all', inverted: false }` linked to that profile's `id`. The seed SHALL be idempotent (skip insert if the rule already exists for that profile).

#### Scenario: Fresh seed after migration

- **WHEN** seeds run after profiles seed and role_permissions migration
- **THEN** profile `ADMINISTRADOR_PLATAFORMA` has one row in `role_permissions` with action `manage` and subject `all`

### Requirement: Backend builds CASL ability from database rules

Service `abilityService.js` SHALL load the active user's profile from `user_profile` joined to `profile` (where `user_profile.is_active` is true) and load all `role_permissions` rows for that profile's id. It SHALL construct a CASL Ability using `AbilityBuilder` and `createMongoAbility`, applying each row via `can` or `cannot` according to `inverted`, optional `fields`, and optional `conditions`. If no active profile exists, it SHALL return an empty ability. It SHALL expose `buildAbilityForUser(userId)` and `buildPackedRulesForUser(userId)` using `packRules` from `@casl/ability/extra`.

#### Scenario: Admin user receives full ability

- **WHEN** `buildAbilityForUser` is called for a user with profile `ADMINISTRADOR_PLATAFORMA` and seed rule `manage/all`
- **THEN** the returned ability grants `can('read', 'Company')`, `can('create', 'Supplier')`, and any other action/subject pair via CASL manage semantics

#### Scenario: User without profile gets empty ability

- **WHEN** `buildAbilityForUser` is called for a user with no active `user_profile` row
- **THEN** the ability has no rules and denies all actions

### Requirement: attachAbility middleware injects req.ability globally

Middleware `attachAbility.js` SHALL run after authentication middleware on the Express app. When `req.auth.userId` is present, it SHALL set `req.ability` from `buildAbilityForUser`. When absent, it SHALL set `req.ability` to an empty `createMongoAbility([])`.

#### Scenario: Authenticated request has ability

- **WHEN** a request passes OIDC auth with valid `req.auth.userId`
- **THEN** `req.ability` is defined before route handlers execute

### Requirement: authorize middleware enforces action and subject

Factory `authorize(action, subjectName)` SHALL call `ForbiddenError.from(req.ability).throwUnlessCan(action, subjectName)` and proceed on success. On `ForbiddenError`, it SHALL respond with HTTP **403** and JSON `{ status: 'forbidden', message: 'No tienes permiso para realizar esta acción.' }` (Spanish, es-CL).

#### Scenario: Missing permission returns 403

- **WHEN** a user with empty ability calls a route protected by `authorize('read', 'Company')`
- **THEN** the response status is **403**
- **AND** the message is in Spanish

#### Scenario: Supplier update allows create or update

- **WHEN** `PUT /api/suppliers/:id` is invoked
- **THEN** access is granted if `req.ability.can('update', 'Supplier')` OR `req.ability.can('create', 'Supplier')` is true

### Requirement: Permissions catalog is authoritative for CASL subject-action validation

When persisting role permissions via the roles admin API, the backend SHALL validate each `{ action, subject }` pair against `backend/config/permissionsCatalog.js` `ACTIONS_BY_SUBJECT`, except `{ action: 'manage', subject: 'all' }` which SHALL always be accepted. The catalog SHALL NOT include action `delete`.

The catalog SHALL include subject `Contract` with label `Consulta de contratos` and allowed actions `read` and `sign`, in addition to existing subjects Company, PlatformUser, Supplier, Client, Template, DocumentBuilder, Dashboard, and RolePermission.

`ACTION_LABELS` SHALL include `sign: 'Firmar'`.

The frontend catalog `frontend/src/config/permissionsCatalog.js` SHALL mirror the same `Contract` actions and include `sign` in `ALL_ACTIONS`.

#### Scenario: Catalog aligns with authorize subjects

- **WHEN** `permissionsCatalog.SUBJECTS` is inspected
- **THEN** it includes subject `Contract` with actions `read` and `sign` in `ACTIONS_BY_SUBJECT`
- **AND** existing subjects remain available for role assignment

#### Scenario: Contract list requires read Contract

- **WHEN** an authenticated user without `can('read', 'Contract')` calls `GET /api/contracts`
- **THEN** the response status is **403**

#### Scenario: Contract sign requires sign Contract

- **WHEN** an authenticated user without `can('sign', 'Contract')` calls `POST /api/contracts/:id/sign`
- **THEN** the response status is **403**

### Requirement: Roles admin API routes use RolePermission authorization

The Express app SHALL expose `/api/roles` CRUD endpoints protected with `authorize` on subject `RolePermission`: read for list and detail, create for POST, update for label change, delete, and permissions replacement. These routes SHALL be registered after platform users routes and before or alongside other protected business routes.

#### Scenario: Permissions update requires update RolePermission

- **WHEN** an authenticated user without `can('update', 'RolePermission')` calls `PUT /api/roles/:id/permissions`
- **THEN** the response status is **403**
- **AND** the message is in Spanish (es-CL)

### Requirement: Protected API routes use authorize instead of navigation grants

All routes previously protected by `grantMiddleware({ navigationCode: 'NAV_*' })` SHALL use `authorize` with the mapped action/subject pairs: Company (read/create/update), PlatformUser (read/create/update), Supplier (read/create/update), Template (read/create/update), DocumentBuilder (use), Dashboard (read), RolePermission (read/create/update). Additionally, roles administration routes SHALL use RolePermission with actions read, create, and update as defined in the roles-permissions-admin capability. Global `requireAuth` SHALL apply to protected routes; individual routes SHALL NOT duplicate `requireAuth` when global middleware is enabled. Public routes (`GET /health`, `GET /`, `POST /api/auth/login`, `POST /api/auth/refresh`) SHALL remain registered before global auth middleware.

#### Scenario: Companies list requires read Company

- **WHEN** an authenticated user with `can('read', 'Company')` calls `GET /api/companies`
- **THEN** the response status is not **403** from authorize middleware

#### Scenario: Roles list requires read RolePermission

- **WHEN** an authenticated user with `can('read', 'RolePermission')` calls `GET /api/roles`
- **THEN** the response status is not **403** from authorize middleware

### Requirement: Frontend ability singleton and context

File `frontend/src/lib/ability.js` SHALL export a shared `createMongoAbility([])` instance, `AbilityContext`, and `Can` via `createContextualCan`. The application root SHALL wrap the tree with `AbilityContext.Provider` bound to that singleton.

#### Scenario: Ability context available in routes

- **WHEN** a component calls `useAbility(AbilityContext)`
- **THEN** it receives the same singleton updated on login

### Requirement: Static menu filtered by CASL

File `frontend/src/navigation/menuConfig.js` SHALL define `MENU_CONFIG` with groups and children including `path`, `label`, and optional `check: { action, subject }` (null check means visible to any authenticated user). Sidebar SHALL render only items where `check === null` or `ability.can(check.action, check.subject)`, and only groups with at least one visible child.

#### Scenario: Admin sees full menu

- **WHEN** a user with `manage/all` loads the app after session enrichment
- **THEN** sidebar shows Dashboard, Empresas, Roles y permisos, Usuarios, Proveedores, Plantillas, and Constructor de documento entries

### Requirement: Route guards use RequireCan

Component `RequireCan` (or equivalent) SHALL use `useAbility(AbilityContext)` and redirect to `/app/acceso-denegado` when `!ability.can(action, subject)`. `AppRouter.jsx` SHALL replace all `RequireNavigationGrant` usages with `RequireCan` using the same action/subject mapping as backend routes.

#### Scenario: Create company page guarded

- **WHEN** a user without `create Company` navigates to the company create route
- **THEN** the user is redirected to `/app/acceso-denegado`

### Requirement: Page actions use CASL instead of grantedCodes

List, view, and form pages that previously checked `grantedCodes.has('NAV_ACTION_*')` SHALL use `useAbility().can(action, subject)` for showing Create, Edit, and similar action buttons. File `proveedoresAuth.js` and `RequireNavigationGrant.jsx` SHALL be removed.

#### Scenario: Supplier list create button

- **WHEN** the user has `can('create', 'Supplier')`
- **THEN** the supplier list page shows the create action control
- **WHEN** the user lacks that permission
- **THEN** the create action control is not shown

### Requirement: CASL dependency versions

Backend `package.json` SHALL depend on `@casl/ability` version **^6.x** (not v7). Frontend `package.json` SHALL depend on `@casl/ability` and `@casl/react` version **^6.x**.

#### Scenario: Installed versions are v6

- **WHEN** packages are installed after this change
- **THEN** resolved `@casl/ability` major version is 6

