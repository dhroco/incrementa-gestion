## MODIFIED Requirements

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
