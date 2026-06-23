## ADDED Requirements

### Requirement: Company API excludes branches

The companies REST API (`GET`, `POST`, `PUT` on `/api/companies` and `/api/companies/:id`) MUST NOT accept, validate, persist, or return a `branches` field. Company create, update, and detail responses MUST contain only direct company attributes.

#### Scenario: Company detail without branches
- **WHEN** an authorized client requests `GET /api/companies/:id` for an existing company
- **THEN** the response body does not include a `branches` property

#### Scenario: Create company without branches payload
- **WHEN** an authorized client posts a valid company payload without `branches`
- **THEN** the server responds with HTTP 201 and the created company record without `branches`

#### Scenario: Update company ignores branches
- **WHEN** an authorized client puts company fields without `branches`
- **THEN** the server updates the company and returns the record without `branches`

### Requirement: Company branch table removed

After migration `202605290010_drop_company_branch_table.js`, the database MUST NOT contain table `company_branch`.

#### Scenario: Migration applied
- **WHEN** `knex migrate:latest` completes on an environment that had `company_branch`
- **THEN** querying `company_branch` fails because the table does not exist

### Requirement: Company management UI without branches

The Gestión de Empresas module (list, create, edit, view) MUST operate without any sucursales section, branch editor, or nested routes under `/sucursales/*`. Shared create/edit layout context MUST NOT expose `branches` or `setBranches`.

#### Scenario: Create company form
- **WHEN** an authorized user opens the new company form
- **THEN** the form shows company fields only and no sucursales table or "Agregar Sucursal" action

#### Scenario: View company
- **WHEN** an authorized user opens company detail view
- **THEN** the page shows company data only with no sucursales section

#### Scenario: No branch work routes
- **WHEN** a user navigates to a former branch URL such as `.../sucursales/nueva` under company create or edit
- **THEN** the route is not registered and the app does not render `CompanyBranchWorkPage`

### Requirement: Demo seed creates companies without branches

Seed `003_gfa_company_seed.js` MUST insert demo companies without inserting or cleaning `company_branch` rows.

#### Scenario: Seed run after branch removal
- **WHEN** seeds run on a database without `company_branch`
- **THEN** demo companies are created successfully with no branch-related errors
