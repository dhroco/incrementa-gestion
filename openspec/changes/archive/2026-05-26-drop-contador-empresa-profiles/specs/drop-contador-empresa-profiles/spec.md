## ADDED Requirements

### Requirement: Destructive migration drops accountant and company-internal-user schema

The backend SHALL include a new Knex migration (timestamped `YYYYMMDDXXXX_drop_contador_empresa_profiles.js`) whose `up` function executes in order: (1) `DROP TABLE IF EXISTS accountant_company`, (2) `DROP TABLE IF EXISTS accountant`, (3) `DROP TABLE IF EXISTS company_internal_user`, (4) `DELETE FROM user_profile WHERE profile_id IN (SELECT id FROM profile WHERE code IN ('CONTADOR','USUARIO_EMPRESA_ADMINISTRADOR'))`, (5) `DELETE FROM profile WHERE code IN ('CONTADOR','USUARIO_EMPRESA_ADMINISTRADOR')`. The migration SHALL NOT modify any existing migration files. The `down` function MAY be empty or throw an error documenting irreversibility.

#### Scenario: Migration applies cleanly on GCP Postgres

- **WHEN** `knex migrate:latest` runs against the target database
- **THEN** the migration completes without error
- **AND** tables `accountant_company`, `accountant`, and `company_internal_user` do not exist
- **AND** no row in `profile` has code `CONTADOR` or `USUARIO_EMPRESA_ADMINISTRADOR`

#### Scenario: Profile navigation grants cascade on profile delete

- **WHEN** step (5) deletes profile rows
- **THEN** related rows in `profile_navigation_grant` for those profile IDs are removed via `ON DELETE CASCADE` on `profile_id`

### Requirement: Seeds exclude removed profiles and test users

After this change, `backend/seeds/001_profiles_seed.js` SHALL seed only `ADMINISTRADOR_PLATAFORMA`. `backend/seeds/002_navigation_authorization_seed.js` SHALL NOT insert grants for `CONTADOR` or `USUARIO_EMPRESA_ADMINISTRADOR`. `backend/seeds/010_gfa_user_profile_and_inheritance_seed.js` SHALL NOT seed `contador@incrementa.la`, `empresa@incrementa.la`, nor their Keycloak user entries for those profiles.

#### Scenario: Fresh seed run has single business profile

- **WHEN** `knex seed:run` executes on an empty database after migrations
- **THEN** `profile` contains `ADMINISTRADOR_PLATAFORMA` and does not contain `CONTADOR` or `USUARIO_EMPRESA_ADMINISTRADOR`

### Requirement: Accountant and internal-company-user API surface removed

The backend SHALL NOT register routes for `/api/platform/accountants`, `/api/accountants`, `/api/companies/:id/accountants`, or `/api/company-internal-users`. Files `accountantPlatformController.js`, `internalCompanyUsersController.js`, `accountantAdminService.js`, `internalCompanyUsersService.js`, `accountantAssignedCompaniesService.js`, `delete-accountant-user.js`, and `accountantPlatformApi.test.js` (backend test) SHALL NOT exist.

#### Scenario: Removed platform accountants route returns 404

- **WHEN** an authenticated platform admin sends `GET /api/platform/accountants` with a valid Bearer token
- **THEN** the response status is **404**

#### Scenario: Removed company internal users route returns 404

- **WHEN** an authenticated platform admin sends `GET /api/company-internal-users` with a valid Bearer token
- **THEN** the response status is **404**

### Requirement: Password rotation complete remains on me controller

`POST /api/me/password-rotation-complete` SHALL remain registered and SHALL be implemented on `meController` (not on a deleted accountant controller). It SHALL clear `user_profile.must_change_password` for users with profile `ADMINISTRADOR_PLATAFORMA` only and SHALL return errors in Spanish (es-CL) for forbidden or inactive users.

#### Scenario: Platform admin completes mandatory password change

- **WHEN** an authenticated user with profile `ADMINISTRADOR_PLATAFORMA` and `must_change_password=true` calls `POST /api/me/password-rotation-complete`
- **THEN** the response status is **200**
- **AND** subsequent `GET /api/me/session` reports `mustChangePassword` as false

### Requirement: Frontend admin pages for removed profiles deleted

The frontend SHALL NOT contain pages under accountant or company-internal-user admin flows listed in the change design. `frontend/src/api/accountantsPlatformApi.js` SHALL NOT exist. `frontend/src/routes/AppRouter.jsx` SHALL NOT define routes `/admin-global/contadores/*` or `/admin-global/usuarios-internos-empresa/*`.

#### Scenario: Frontend build succeeds without deleted modules

- **WHEN** `npm run build` runs in `frontend/`
- **THEN** the build completes without module resolution errors for deleted accountant or internal-user pages

#### Scenario: Navigation paths omit removed modules

- **WHEN** reading `frontend/src/navigation/platformPaths.js`
- **THEN** constants for contadores and usuarios-internos-empresa admin paths are absent

### Requirement: Keycloak realm import aligned

`infra/keycloak/import/incrementa-realm.json` SHALL NOT define realm roles `CONTADOR` or `USUARIO_EMPRESA_ADMINISTRADOR`, and SHALL NOT define test users `contador@incrementa.la` or `empresa@incrementa.la` if they existed solely for those profiles.

#### Scenario: Realm roles list excludes removed profiles

- **WHEN** parsing `roles.realm` in the realm import JSON
- **THEN** no role name equals `CONTADOR` or `USUARIO_EMPRESA_ADMINISTRADOR`

### Requirement: No active source references to removed profiles

A search in `backend/` and `frontend/src/` excluding `node_modules`, excluding historical files under `backend/migrations/` (except the new drop migration), SHALL NOT find meaningful runtime references to `CONTADOR`, `USUARIO_EMPRESA_ADMINISTRADOR`, `accountantAdminService`, `internalCompanyUsersService`, or `company_internal_user` table usage.

#### Scenario: Grep verification passes

- **WHEN** searching backend and frontend source for `CONTADOR` and `USUARIO_EMPRESA_ADMINISTRADOR` outside `backend/migrations/`
- **THEN** zero matches remain in executable application code

### Requirement: Platform admin profile and company table preserved

This change SHALL NOT remove the `company` table, `ADMINISTRADOR_PLATAFORMA` profile, or `/api/platform/users` routes. `GET /api/me/session` for a platform admin SHALL return profile code `ADMINISTRADOR_PLATAFORMA`.

#### Scenario: Admin session after migration

- **WHEN** `admin@incrementa.la` (or configured admin seed user) calls `GET /api/me/session` with valid token after migration
- **THEN** response status is **200**
- **AND** body includes `profile.code` equal to `ADMINISTRADOR_PLATAFORMA`
