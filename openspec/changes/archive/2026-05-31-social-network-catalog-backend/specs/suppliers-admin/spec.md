## MODIFIED Requirements

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
