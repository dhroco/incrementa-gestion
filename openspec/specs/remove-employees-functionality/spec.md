# remove-employees-functionality Specification

## Purpose
TBD - created by archiving change drop-employees-connect-suppliers-document-builder. Update Purpose after archive.
## Requirements
### Requirement: Employee API removed

The system MUST NOT expose any endpoint under `/api/employees`. All employee controller, service, and scope resolver modules MUST be deleted from the active codebase.

#### Scenario: Employee list returns not found
- **WHEN** an authenticated client sends `GET /api/employees`
- **THEN** the server responds with HTTP 404 (route not registered)

### Requirement: Employee frontend routes removed

The frontend MUST NOT register routes under `/trabajadores`, `/trabajadores/nuevo`, `/trabajadores/:id`, or `/trabajadores/:id/edit`. All dedicated employee pages, API client, and `trabajadoresAuth.js` MUST be removed.

#### Scenario: Direct navigation to trabajadores
- **WHEN** a user navigates to `/trabajadores`
- **THEN** the application shows the default not-found or redirect behavior without rendering employee UI

### Requirement: Trabajadores navigation nodes removed

The system MUST NOT expose navigation entries or grants for gestión de trabajadores, historial documental de trabajadores, cargos, or jornadas laborales. Seed `002_navigation_authorization_seed.js` MUST omit all `NAV_*TRABAJADOR*` and related jornada nodes listed in the change brief. Migration `202605290007_drop_trabajadores_navigation_nodes.js` MUST delete existing DB nodes matching `%TRABAJADOR%` or `%JORNADA%` and their grants.

#### Scenario: Sidebar after seed and migrate
- **WHEN** navigation is loaded for an authorized user after migrate and seed
- **THEN** no menu item references trabajadores or jornadas laborales

### Requirement: Employee database tables dropped

Migration `202605290006_drop_employee_tables.js` MUST drop tables `employee`, `position`, and `work_schedule` with CASCADE after resolving dependencies on `generated_document`. The migration MUST NOT modify prior migration files.

#### Scenario: Tables absent after migrate
- **WHEN** `knex migrate:latest` completes including `202605290006`
- **THEN** tables `employee`, `position`, and `work_schedule` do not exist

### Requirement: Date utilities extracted before employee utils removal

Before deleting `employeeFormUtils.js`, the system MUST provide `frontend/src/utils/dateUtils.js` exporting `normalizeIsoDateOrNull` and `formatEsDateFromIso` with identical behavior to the former implementations. Supplier pages MUST import from `../utils/dateUtils`.

#### Scenario: Supplier form date formatting works
- **WHEN** a supplier upsert page formats or normalizes a date field
- **THEN** behavior matches the previous `employeeFormUtils` implementation without importing employee modules

### Requirement: No orphan employee references in active code

After implementation, a search over `frontend/src` and `backend` JavaScript/JSX sources (excluding historical migrations) MUST NOT find orphan references to employee CRUD, trabajadores routes, or `worker_` variable resolution logic.

#### Scenario: Codebase grep check
- **WHEN** searching active `.js` and `.jsx` files for `employeesApi`, `EmployeeViewPage`, `trabajadoresAuth`, or `resolveEmployeeCompanyScope`
- **THEN** no matches remain outside archived or migration history paths

