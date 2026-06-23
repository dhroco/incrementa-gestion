# suppliers-admin Specification

## Purpose
TBD - created by archiving change modulo-proveedores. Update Purpose after archive.
## Requirements
### Requirement: Supplier database schema

The system MUST persist suppliers in table `supplier` and their social network accounts in table `supplier_social_network`, with columns and constraints as defined in migration `202605290003_create_supplier_tables.js` as subsequently amended by the social network catalog migration. Supplier type MUST be either `persona_natural` or `empresa`. Each `supplier_social_network` row MUST reference `social_network_catalog` via foreign key column `catalog_id` (UUID NOT NULL); the column `network_name` MUST NOT exist after the catalog migration. Social network rows MUST cascade-delete when a supplier is deleted. Deleting a catalog row that is referenced by a supplier social network MUST be prevented (`ON DELETE RESTRICT` or equivalent).

#### Scenario: Tables exist after migration

- **WHEN** `knex migrate:latest` completes successfully including the social network catalog migration
- **THEN** tables `supplier`, `supplier_social_network`, and `social_network_catalog` exist with the specified columns and foreign keys
- **AND** `supplier_social_network` has column `catalog_id` referencing `social_network_catalog.id`

#### Scenario: Legacy network_name column removed

- **WHEN** the social network catalog migration has been applied
- **THEN** column `supplier_social_network.network_name` does not exist

### Requirement: Supplier list API

The backend MUST expose `GET /api/suppliers` requiring authentication and grant `NAV_ACTION_PROVEEDORES_READ`. The endpoint MUST return all suppliers including their social networks, support optional case-insensitive search on `full_name`, `razon_social`, `rut_body`, and `rut_empresa_body`, and order results with `empresa` before `persona_natural`, alphabetically within each group. Each element in `social_networks` MUST include at least `id`, `catalog_id`, `code`, `name`, `account_name`, and `sort_order` (with `code` and `name` sourced from `social_network_catalog` via join). The field `network_name` MUST NOT appear in responses.

#### Scenario: List with search

- **WHEN** an authorized client sends `GET /api/suppliers?search=acme`
- **THEN** the response is HTTP 200 with suppliers whose name or RUT fields match the search term
- **AND** each supplier's `social_networks` entries include `catalog_id`, `code`, and `name`

#### Scenario: Unauthorized list

- **WHEN** a client without `NAV_ACTION_PROVEEDORES_READ` calls `GET /api/suppliers`
- **THEN** the server responds with HTTP 403

### Requirement: Supplier detail API

The backend MUST expose `GET /api/suppliers/:id` requiring `NAV_ACTION_PROVEEDORES_READ`. The response MUST include the supplier and all associated social networks. Each social network object MUST include at least `id`, `catalog_id`, `code`, `name`, `account_name`, and `sort_order`. If the supplier does not exist, the server MUST respond with HTTP 404 and a message in Spanish.

#### Scenario: Existing supplier

- **WHEN** an authorized client requests a valid supplier id
- **THEN** the response is HTTP 200 with supplier fields and `social_networks` array
- **AND** each network includes `catalog_id`, `code`, and `name` from the catalog join

#### Scenario: Missing supplier

- **WHEN** an authorized client requests a non-existent id
- **THEN** the response is HTTP 404

### Requirement: Supplier create API

The backend MUST expose `POST /api/suppliers` requiring `NAV_ACTION_PROVEEDORES_CREATE`. Creation MUST validate required fields by type (`persona_natural`: `full_name`, `rut_body`, `rut_dv`; `empresa`: `razon_social`, `rut_empresa_body`, `rut_empresa_dv`), validate Chilean RUT format via the same logic as employees, validate each social network entry with required `catalog_id` (UUID referencing an existing `social_network_catalog` row) and `account_name`, insert supplier and social networks atomically in a transaction, and set `created_by` and `updated_by` to the authenticated user. Requests with invalid or unknown `catalog_id` MUST fail with HTTP 400 and a message in Spanish.

#### Scenario: Create persona natural

- **WHEN** an authorized client posts valid persona natural data with social networks containing valid `catalog_id` and `account_name`
- **THEN** the response is HTTP 201 and the supplier and networks are persisted with `catalog_id` foreign keys

#### Scenario: Invalid RUT rejected

- **WHEN** an authorized client posts a supplier with an invalid RUT
- **THEN** the response is HTTP 400 with an error message in Spanish

#### Scenario: Invalid catalog_id rejected

- **WHEN** an authorized client posts social networks with a `catalog_id` that does not exist in `social_network_catalog`
- **THEN** the response is HTTP 400 with a Spanish validation message
- **AND** no supplier row is inserted

### Requirement: Supplier update API

The backend MUST expose `PUT /api/suppliers/:id` requiring grant `NAV_ACTION_PROVEEDORES_EDIT` or `NAV_ACTION_PROVEEDORES_CREATE`. Update MUST replace the full social network list (delete existing rows for the supplier, insert new rows), validate each network entry with required `catalog_id` (existing catalog row) and `account_name`, run in a transaction, set `updated_by`, and return 404 if the supplier does not exist.

#### Scenario: Update social networks

- **WHEN** an authorized client sends an update with a new `social_networks` array using valid `catalog_id` values
- **THEN** previous networks for that supplier are removed and the new list is stored with catalog references

#### Scenario: Update with invalid catalog_id

- **WHEN** an authorized client sends an update with a `social_networks` entry containing an unknown `catalog_id`
- **THEN** the response is HTTP 400 with a Spanish validation message
- **AND** existing supplier data is not partially updated

### Requirement: Suppliers navigation and grants

The system MUST register navigation item `NAV_ITEM_PROVEEDORES_PROVEEDORES` with label "Proveedores", route `/app/proveedores`, parent `NAV_MENU_ADMIN_GLOBAL`, and actions `NAV_ACTION_PROVEEDORES_READ`, `NAV_ACTION_PROVEEDORES_CREATE`, `NAV_ACTION_PROVEEDORES_EDIT`. Profile `ADMINISTRADOR_PLATAFORMA` MUST receive READ, CREATE, and EDIT grants. There MUST NOT be a separate top-level menu node `NAV_MENU_PROVEEDORES`.

#### Scenario: Admin platform menu
- **WHEN** a user with `ADMINISTRADOR_PLATAFORMA` loads navigation after seed or migration
- **THEN** "Proveedores" appears under Administración global and links to `/app/proveedores`

### Requirement: Suppliers admin UI

The frontend MUST provide list, read-only detail, and create/edit pages at `/app/proveedores`, `/app/proveedores/nuevo`, `/app/proveedores/:id`, and `/app/proveedores/:id/edit`. The UI MUST hide "Nuevo proveedor" without CREATE grant and "Editar" without EDIT grant; validate required fields and RUT on the client; display RUT as `XX.XXX.XXX-X`; show conditional sections for persona natural vs empresa including optional personería; and follow corporate UI tokens (pill buttons, white cards, Nunito Sans, link color `#F62D84`).

Social networks MUST be captured and displayed using `SocialNetworkSelector` (catalog-based visual selector with icons), not a free-text editable table with hardcoded network name options. Form state and create/update payloads MUST send `social_networks` as an array of `{ catalog_id, account_name }` where `catalog_id` is a UUID referencing `social_network_catalog`. The field `network_name` MUST NOT be used in form state or submit payloads.

The create page MUST display the form as two vertically stacked block cards ("Datos básicos del proveedor" and "Redes sociales") without tabs. The view and edit pages MUST display three tabs: "Datos básicos", "Redes sociales", and "Antecedentes contractuales". The third tab MUST show contract history (signed documents and drafts in progress) for the supplier. On validation failure during submit, the UI MUST navigate to the tab containing the first field error.

Client-side validation of social networks MUST require both `catalog_id` and non-empty `account_name` for each submitted network entry. Validation error messages MUST be in Spanish (es-CL).

#### Scenario: Create flow

- **WHEN** a user with CREATE grant opens `/app/proveedores/nuevo`, completes a valid empresa form including social networks via the catalog selector, and saves
- **THEN** the user is redirected to list or detail and the new supplier appears in the list
- **AND** the create payload contains `social_networks` with `catalog_id` and `account_name` only

#### Scenario: Type locked on edit

- **WHEN** a user edits an existing supplier
- **THEN** the supplier type selector is not changeable

#### Scenario: Read-only user

- **WHEN** a user has only READ grant
- **THEN** create and edit actions are not visible but list and detail remain accessible

#### Scenario: Detail shows contract history tab

- **WHEN** a user with READ grant opens `/app/proveedores/:id` and selects "Antecedentes contractuales"
- **THEN** signed and in-progress contract tables are displayed for that supplier

#### Scenario: Detail shows social networks with icons

- **WHEN** a user with READ grant opens `/app/proveedores/:id` and selects "Redes sociales"
- **THEN** assigned networks are displayed with icon, catalog name, and account handle via `SocialNetworkSelector` in read-only mode

#### Scenario: Incomplete social network rejected on submit

- **WHEN** a user selects a network in the catalog selector but leaves the account handle empty and submits
- **THEN** validation fails with a Spanish error message
- **AND** the active tab switches to "Redes sociales" if applicable

### Requirement: Suppliers consumed by Document Builder

The existing supplier list API (`GET /api/suppliers`) MUST be reusable by the Document Builder without a company filter. Users with document constructor navigation grant AND supplier read grant (`NAV_ACTION_PROVEEDORES_READ`) MUST be able to load the global supplier list for document generation. No new supplier CRUD endpoints are required for this integration.

#### Scenario: Document Builder loads suppliers
- **WHEN** an authorized user with proveedores read grant opens Document Builder
- **THEN** the client successfully loads suppliers via the same list API used on the Proveedores admin page

#### Scenario: Missing proveedores read grant
- **WHEN** a user has document constructor grant but lacks proveedores read grant
- **THEN** the supplier selector does not load data and shows an appropriate error or empty state in Spanish

### Requirement: Supplier documents API

The backend MUST expose `GET /api/suppliers/:id/documents` requiring authentication and CASL authorization `read` on subject `Supplier`. The endpoint MUST return signed documents from table `document` and in-progress drafts from table `draft_document` (excluding `status = 'signed'`), each joined with template name, ordered by date descending. If the supplier id does not exist, respond HTTP 404 in Spanish.

#### Scenario: Documents for existing supplier
- **WHEN** an authorized client requests `/api/suppliers/:id/documents` for a valid supplier
- **THEN** HTTP 200 includes `signed_documents` and `draft_documents` arrays

#### Scenario: Documents for missing supplier
- **WHEN** an authorized client requests documents for a non-existent supplier id
- **THEN** HTTP 404 is returned

