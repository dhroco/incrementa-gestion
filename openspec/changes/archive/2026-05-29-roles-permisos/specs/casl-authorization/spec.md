## ADDED Requirements

### Requirement: Permissions catalog is authoritative for CASL subject-action validation

When persisting role permissions via the roles admin API, the backend SHALL validate each `{ action, subject }` pair against `backend/config/permissionsCatalog.js` `ACTIONS_BY_SUBJECT`, except `{ action: 'manage', subject: 'all' }` which SHALL always be accepted. The catalog SHALL NOT include action `delete`.

#### Scenario: Catalog aligns with authorize subjects

- **WHEN** `permissionsCatalog.SUBJECTS` is inspected
- **THEN** it includes subjects Company, PlatformUser, Supplier, Template, DocumentBuilder, Dashboard, and RolePermission matching existing `authorize` middleware usage

### Requirement: Roles admin API routes use RolePermission authorization

The Express app SHALL expose `/api/roles` CRUD endpoints protected with `authorize` on subject `RolePermission`: read for list and detail, create for POST, update for label change, delete, and permissions replacement. These routes SHALL be registered after platform users routes and before or alongside other protected business routes.

#### Scenario: Permissions update requires update RolePermission

- **WHEN** an authenticated user without `can('update', 'RolePermission')` calls `PUT /api/roles/:id/permissions`
- **THEN** the response status is **403**
- **AND** the message is in Spanish (es-CL)

## MODIFIED Requirements

### Requirement: Protected API routes use authorize instead of navigation grants

All routes previously protected by `grantMiddleware({ navigationCode: 'NAV_*' })` SHALL use `authorize` with the mapped action/subject pairs: Company (read/create/update), PlatformUser (read/create/update), Supplier (read/create/update), Template (read/create/update), DocumentBuilder (use), Dashboard (read), RolePermission (read/create/update). Additionally, roles administration routes SHALL use RolePermission with actions read, create, and update as defined in the roles-permissions-admin capability. Global `requireAuth` SHALL apply to protected routes; individual routes SHALL NOT duplicate `requireAuth` when global middleware is enabled. Public routes (`GET /health`, `GET /`, `POST /api/auth/login`, `POST /api/auth/refresh`) SHALL remain registered before global auth middleware.

#### Scenario: Companies list requires read Company

- **WHEN** an authenticated user with `can('read', 'Company')` calls `GET /api/companies`
- **THEN** the response status is not **403** from authorize middleware

#### Scenario: Roles list requires read RolePermission

- **WHEN** an authenticated user with `can('read', 'RolePermission')` calls `GET /api/roles`
- **THEN** the response status is not **403** from authorize middleware
