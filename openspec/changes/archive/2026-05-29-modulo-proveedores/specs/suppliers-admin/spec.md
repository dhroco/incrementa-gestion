## ADDED Requirements

### Requirement: Supplier database schema

The system MUST persist suppliers in table `supplier` and their social network accounts in table `supplier_social_network`, with columns and constraints as defined in migration `202605290003_create_supplier_tables.js`. Supplier type MUST be either `persona_natural` or `empresa`. Social network rows MUST cascade-delete when a supplier is deleted.

#### Scenario: Tables exist after migration
- **WHEN** `knex migrate:latest` completes successfully
- **THEN** tables `supplier` and `supplier_social_network` exist with the specified columns and foreign keys

### Requirement: Supplier list API

The backend MUST expose `GET /api/suppliers` requiring authentication and grant `NAV_ACTION_PROVEEDORES_READ`. The endpoint MUST return all suppliers including their social networks, support optional case-insensitive search on `full_name`, `razon_social`, `rut_body`, and `rut_empresa_body`, and order results with `empresa` before `persona_natural`, alphabetically within each group.

#### Scenario: List with search
- **WHEN** an authorized client sends `GET /api/suppliers?search=acme`
- **THEN** the response is HTTP 200 with suppliers whose name or RUT fields match the search term

#### Scenario: Unauthorized list
- **WHEN** a client without `NAV_ACTION_PROVEEDORES_READ` calls `GET /api/suppliers`
- **THEN** the server responds with HTTP 403

### Requirement: Supplier detail API

The backend MUST expose `GET /api/suppliers/:id` requiring `NAV_ACTION_PROVEEDORES_READ`. The response MUST include the supplier and all associated social networks. If the supplier does not exist, the server MUST respond with HTTP 404 and a message in Spanish.

#### Scenario: Existing supplier
- **WHEN** an authorized client requests a valid supplier id
- **THEN** the response is HTTP 200 with supplier fields and `social_networks` array

#### Scenario: Missing supplier
- **WHEN** an authorized client requests a non-existent id
- **THEN** the response is HTTP 404

### Requirement: Supplier create API

The backend MUST expose `POST /api/suppliers` requiring `NAV_ACTION_PROVEEDORES_CREATE`. Creation MUST validate required fields by type (`persona_natural`: `full_name`, `rut_body`, `rut_dv`; `empresa`: `razon_social`, `rut_empresa_body`, `rut_empresa_dv`), validate Chilean RUT format via the same logic as employees, insert supplier and social networks atomically in a transaction, and set `created_by` and `updated_by` to the authenticated user.

#### Scenario: Create persona natural
- **WHEN** an authorized client posts valid persona natural data with social networks
- **THEN** the response is HTTP 201 and the supplier and networks are persisted

#### Scenario: Invalid RUT rejected
- **WHEN** an authorized client posts a supplier with an invalid RUT
- **THEN** the response is HTTP 400 with an error message in Spanish

### Requirement: Supplier update API

The backend MUST expose `PUT /api/suppliers/:id` requiring grant `NAV_ACTION_PROVEEDORES_EDIT` or `NAV_ACTION_PROVEEDORES_CREATE`. Update MUST replace the full social network list (delete existing rows for the supplier, insert new rows), run in a transaction, set `updated_by`, and return 404 if the supplier does not exist.

#### Scenario: Update social networks
- **WHEN** an authorized client sends an update with a new `social_networks` array
- **THEN** previous networks for that supplier are removed and the new list is stored

### Requirement: Suppliers navigation and grants

The system MUST register navigation item `NAV_ITEM_PROVEEDORES_PROVEEDORES` with label "Proveedores", route `/app/proveedores`, parent `NAV_MENU_ADMIN_GLOBAL`, and actions `NAV_ACTION_PROVEEDORES_READ`, `NAV_ACTION_PROVEEDORES_CREATE`, `NAV_ACTION_PROVEEDORES_EDIT`. Profile `ADMINISTRADOR_PLATAFORMA` MUST receive READ, CREATE, and EDIT grants. There MUST NOT be a separate top-level menu node `NAV_MENU_PROVEEDORES`.

#### Scenario: Admin platform menu
- **WHEN** a user with `ADMINISTRADOR_PLATAFORMA` loads navigation after seed or migration
- **THEN** "Proveedores" appears under Administración global and links to `/app/proveedores`

### Requirement: Suppliers admin UI

The frontend MUST provide list, read-only detail, and create/edit pages at `/app/proveedores`, `/app/proveedores/nuevo`, `/app/proveedores/:id`, and `/app/proveedores/:id/edit`. The UI MUST hide "Nuevo proveedor" without CREATE grant and "Editar" without EDIT grant; validate required fields and RUT on the client; display RUT as `XX.XXX.XXX-X`; show conditional sections for persona natural vs empresa including optional personería and dynamic social network rows; and follow corporate UI tokens (pill buttons, white cards, Nunito Sans, link color `#F62D84`).

#### Scenario: Create flow
- **WHEN** a user with CREATE grant opens `/app/proveedores/nuevo`, completes a valid empresa form, and saves
- **THEN** the user is redirected to list or detail and the new supplier appears in the list

#### Scenario: Type locked on edit
- **WHEN** a user edits an existing supplier
- **THEN** the supplier type selector is not changeable

#### Scenario: Read-only user
- **WHEN** a user has only READ grant
- **THEN** create and edit actions are not visible but list and detail remain accessible
