## ADDED Requirements

### Requirement: Client database schema

The system MUST persist clients in table `client` and their product campaigns in table `client_product_campaign`, with columns and constraints as defined in migration `202606010002_create_client_tables.js`. Each `client` row MUST have `name` and `brand` NOT NULL, optional `brand_account`, timestamps `created_at` and `updated_at` with time zone defaulting to now(), and optional `created_by` and `updated_by` UUID foreign keys to `user_profile.id` with `ON DELETE SET NULL`. Each `client_product_campaign` row MUST reference `client_id` with `ON DELETE CASCADE`, have `name` NOT NULL, and `sort_order` integer NOT NULL default 0. An index MUST exist on `client_product_campaign.client_id`.

#### Scenario: Tables exist after migration

- **WHEN** `knex migrate:latest` completes successfully including `202606010002_create_client_tables.js`
- **THEN** tables `client` and `client_product_campaign` exist with the specified columns and foreign keys

### Requirement: Client list API

The backend MUST expose `GET /api/clients` requiring authentication and CASL authorization `authorize('read', 'Client')`. The endpoint MUST return all clients including their `product_campaigns` (from join or subquery), ordered by `name` ascending. It MUST support optional case-insensitive search on `name` and `brand` via ILIKE. Each client in the response MUST include at least `id`, `name`, `brand`, `brand_account`, `product_campaigns` (array with `id`, `name`, `sort_order`), and audit fields as exposed by the service.

#### Scenario: List with search

- **WHEN** an authorized client sends `GET /api/clients?search=acme`
- **THEN** the response is HTTP 200 with clients whose `name` or `brand` matches the search term
- **AND** each client includes its `product_campaigns` ordered by `sort_order` ascending

#### Scenario: Unauthorized list

- **WHEN** a client without `read` permission on subject `Client` calls `GET /api/clients`
- **THEN** the server responds with HTTP 403

### Requirement: Client detail API

The backend MUST expose `GET /api/clients/:id` requiring `authorize('read', 'Client')`. The response MUST include the client and `product_campaigns` ordered by `sort_order` ascending. If the client does not exist, the server MUST respond with HTTP 404 and a message in Spanish.

#### Scenario: Existing client

- **WHEN** an authorized client requests a valid client id
- **THEN** the response is HTTP 200 with client fields and `product_campaigns` array

#### Scenario: Missing client

- **WHEN** an authorized client requests a non-existent id
- **THEN** the response is HTTP 404

### Requirement: Client create API

The backend MUST expose `POST /api/clients` requiring `authorize('create', 'Client')`. The body MUST accept `{ name, brand, brand_account?, product_campaigns: [{ name }] }`. Creation MUST validate required `name` and `brand`, insert client and campaigns atomically in a transaction, assign `sort_order` from array index, and set `created_by` and `updated_by` to the authenticated user's `user_profile.id`. Invalid payloads MUST fail with HTTP 400 and a message in Spanish.

#### Scenario: Create client with campaigns

- **WHEN** an authorized client posts valid client data with `product_campaigns` containing campaign names
- **THEN** the response is HTTP 201 (or 200 per existing controller convention) and the client and campaigns are persisted

### Requirement: Client update API

The backend MUST expose `PUT /api/clients/:id` requiring `authorize('update', 'Client')`. Update MUST accept the same payload shape as create, replace the full `product_campaigns` list (delete existing rows for the client, insert new rows), run in a transaction, set `updated_by`, and return 404 if the client does not exist.

#### Scenario: Update product campaigns replace-all

- **WHEN** an authorized client sends an update with a new `product_campaigns` array
- **THEN** previous campaigns for that client are removed and the new list is stored with updated `sort_order` values

### Requirement: Client admin navigation

The frontend menu configuration MUST include item **Clientes** under **Administración global**, immediately after **Proveedores**, with path `/app/admin-global/clientes`, `navCode` `NAV_ITEM_ADMIN_GLOBAL_CLIENTES`, and visibility gated by `{ action: 'read', subject: 'Client' }`.

#### Scenario: Admin sees Clientes menu item

- **WHEN** a user with `read` on `Client` opens the application
- **THEN** the sidebar shows **Clientes** under Administración global linking to `/app/admin-global/clientes`

### Requirement: Client list page

The frontend MUST provide `ClientListPage` with columns Nombre, Marca, Cuenta marca, and N° campañas (count of `product_campaigns`). It MUST offer search, **Ver** and **Editar** actions styled as system links (`#F62D84`), and **Nuevo cliente** when the user can `create` on `Client`. Styling MUST match Proveedores list (cards, tables, pill buttons).

#### Scenario: List displays campaign count

- **WHEN** an authorized user opens the client list
- **THEN** each row shows the number of product campaigns for that client

### Requirement: Client view and upsert pages

The frontend MUST provide `ClientViewPage` with tabs **Datos básicos** (read-only `name`, `brand`, `brand_account`) and **Campañas** (read-only table of campaigns). It MUST provide `ClientUpsertPage` for create (single view: **Datos del cliente** + editable **Campañas** table) and edit (same two tabs as view but editable). The campaigns table MUST support add row, delete row, and edit `name` per row, following the editable social networks pattern in Proveedores.

#### Scenario: Create flow without tabs

- **WHEN** an authorized user navigates to create client
- **THEN** the form shows client fields and an editable campaigns table on one screen without tabs

#### Scenario: Edit flow with tabs

- **WHEN** an authorized user edits an existing client
- **THEN** the UI uses tabs matching the view page layout with editable fields

### Requirement: Clients API client module

The frontend MUST expose `clientsApi.js` with `fetchClientsList`, `fetchClientById`, `createClient`, and `updateClient`, following the same authentication and error handling pattern as `suppliersApi.js`.

#### Scenario: List fetch uses access token

- **WHEN** `fetchClientsList` is called with a valid `accessToken`
- **THEN** it requests `GET /api/clients` with optional search query parameter
