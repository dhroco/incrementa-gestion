## ADDED Requirements

### Requirement: Supplier contact columns on base table

The system MUST persist supplier contact data on table `supplier` as nullable text columns `email` and `phone`. The columns MUST NOT exist on `supplier_persona_natural` or `supplier_empresa`. The migration MUST be additive and MUST succeed while existing supplier rows have NULL contact values. There MUST NOT be a UNIQUE constraint or unique index on `email`.

#### Scenario: Columns exist after migration

- **WHEN** `knex migrate:latest` completes including the supplier contact migration
- **THEN** table `supplier` has nullable text columns `email` and `phone`
- **AND** `supplier_persona_natural` and `supplier_empresa` do not have those columns
- **AND** existing supplier rows remain queryable with `email` and `phone` equal to NULL

#### Scenario: Duplicate emails allowed

- **WHEN** two suppliers are created with the same valid email address
- **THEN** both inserts succeed
- **AND** no unique-constraint error is raised

### Requirement: Supplier email is the signer's mailbox

`supplier.email` MUST always be the mailbox of the natural person who will sign the contract. For `persona_natural` it is that person's own email. For `empresa` it is the email of the legal representative (`proveedor_rep_legal`), not a generic company mailbox. This is a product meaning of the same column: schema and format validation do not change.

#### Scenario: Empresa email belongs to the legal representative

- **WHEN** an operator records `email` on a supplier of type `empresa`
- **THEN** the value is the legal representative's mailbox
- **AND** the create/edit form labels the field `Correo del representante legal`
- **AND** MCP tools `crear_proveedor` and `actualizar_proveedor` describe `email` as the legal representative's mailbox when `supplier_type` is `empresa`

### Requirement: Email required on create and optional on update

`supplierService.validatePayload` MUST validate `email` for both REST and MCP. On create (`partial === false`) email is required. On update (`partial === true`) email is optional. When present, email MUST be trimmed, stored in lowercase, and accepted only if `isValidEmail` from `backend/utils/validation.js` returns true. Empty or whitespace-only email on update MUST be stored as NULL. Error messages MUST be in Spanish (es-CL), MUST NOT include the submitted email value, and MUST be returned via the existing validation error path (`VALIDATION_ERROR` / `sendError`).

#### Scenario: Create without email rejected

- **WHEN** an authorized client posts a otherwise-valid supplier without `email`
- **THEN** the response is HTTP 400 with a Spanish message that the email is required
- **AND** no supplier row is inserted
- **AND** the message does not contain a mailbox address

#### Scenario: Create with valid email persists lowercase

- **WHEN** an authorized client posts a valid supplier with `email` `Ana.Gomez@Agencia.CL`
- **THEN** the response is HTTP 201
- **AND** the stored and returned `email` is `ana.gomez@agencia.cl`

#### Scenario: Create with invalid email rejected

- **WHEN** an authorized client posts a supplier with `email` that fails `isValidEmail`
- **THEN** the response is HTTP 400 with a Spanish message that the email format is invalid
- **AND** the message does not echo the submitted value

#### Scenario: Update without email field succeeds for legacy supplier

- **WHEN** an authorized client PUTs a supplier whose `email` is NULL
- **AND** the payload omits `email` and includes other valid fields
- **THEN** the response is HTTP 200
- **AND** `email` remains NULL
- **AND** the other fields are persisted

#### Scenario: Update with empty email clears the column

- **WHEN** an authorized client PUTs a supplier with `email` equal to `""`
- **THEN** the stored `email` is NULL

### Requirement: Phone optional with lax shape validation

`phone` MUST be optional on create and update. The service MUST apply `trimOrNull` and, when a value remains, accept only characters among digits, spaces, `+`, `-`, `(` and `)`, with total length at most 32 and digit count between 7 and 15 inclusive. The value MUST be stored as typed (trimmed), without E.164 or Chilean rewriting. Invalid phone MUST yield HTTP 400 with a Spanish message that does not include the submitted number.

#### Scenario: Create with valid foreign phone stored as typed

- **WHEN** an authorized client posts a valid supplier with `phone` `+52 55 1234 5678`
- **THEN** the response is HTTP 201
- **AND** the stored `phone` equals `+52 55 1234 5678`

#### Scenario: Invalid phone rejected

- **WHEN** an authorized client posts or puts a supplier with `phone` containing letters
- **THEN** the response is HTTP 400 with a Spanish validation message
- **AND** the message does not contain the submitted phone value

#### Scenario: Empty phone stored as null

- **WHEN** an authorized client posts a valid supplier with `phone` omitted or blank
- **THEN** the stored `phone` is NULL

### Requirement: List identifies suppliers without email

`GET /api/suppliers` MUST include `email` and `phone` on each item (`null` when absent). Optional search MUST also match `email` case-insensitively. The suppliers list page MUST show a Correo column: the email when present, and the text `Sin correo` when absent, so operators can identify rows that still need a mailbox.

#### Scenario: List payload includes contact fields

- **WHEN** an authorized client sends `GET /api/suppliers`
- **THEN** each item includes `email` and `phone`
- **AND** a supplier never given a mailbox has `email` equal to `null`

#### Scenario: Search by email

- **WHEN** an authorized client sends `GET /api/suppliers?search=` with a fragment of a stored email
- **THEN** matching suppliers are returned

#### Scenario: List UI marks missing email

- **WHEN** a user with read grant opens `/app/proveedores`
- **THEN** the table has a Correo column
- **AND** a row whose `email` is null displays `Sin correo`

### Requirement: Contact fields on supplier form and detail

The create, edit, and read-only detail pages MUST show Correo and Teléfono in the Datos básicos section for both `persona_natural` and `empresa`. `supplier.email` is always the mailbox of the natural person who will sign: for `persona_natural` it is that person's own email; for `empresa` it is the legal representative's email (`proveedor_rep_legal`), not a generic company mailbox. The email field label MUST be `Correo` for `persona_natural` and `Correo del representante legal` for `empresa`. For `empresa` the form MUST show helper text stating that the mailbox belongs to whoever will sign the contract. On create, Correo is required in the client-side validation (asterisk) using the same format rule as the backend. On edit, Correo is not required. Teléfono is never required. Validation error messages MUST be in Spanish (es-CL) and MUST NOT display the submitted contact values. Client-side checks do not replace backend validation.

#### Scenario: Create form requires email

- **WHEN** a user with CREATE grant opens `/app/proveedores/nuevo` and submits without a mailbox
- **THEN** validation fails in Spanish on the Correo field
- **AND** the supplier is not created

#### Scenario: Empresa email labeled as legal representative mailbox

- **WHEN** a user opens the supplier create or edit form with type `empresa`
- **THEN** the email field label is `Correo del representante legal`
- **AND** helper text states that the mailbox is that of whoever will sign the contract
- **AND** the label is `Correo` when the type is `persona_natural`

#### Scenario: Edit form allows saving without email

- **WHEN** a user edits a supplier that has no email
- **AND** they change another field and save without filling Correo
- **THEN** the save succeeds

#### Scenario: Detail shows contact

- **WHEN** a user with READ grant opens `/app/proveedores/:id`
- **THEN** Correo and Teléfono are visible in Datos básicos
- **AND** a missing value displays as `—`

## MODIFIED Requirements

### Requirement: Supplier create API

The backend MUST expose `POST /api/suppliers` requiring `NAV_ACTION_PROVEEDORES_CREATE` (CASL `create` on `Supplier`). Creation MUST validate required fields by type (`persona_natural`: `full_name`, `rut_body`, `rut_dv`; `empresa`: `razon_social`, `rut_empresa_body`, `rut_empresa_dv`), validate Chilean RUT format via the same logic as employees, require `email` (trimmed, lowercase, `isValidEmail`), accept optional `phone` with lax shape validation, validate each social network entry with required `catalog_id` (UUID referencing an existing `social_network_catalog` row) and `account_name`, insert supplier (including `email` and `phone` on the base row) and social networks atomically in a transaction, and set `created_by` and `updated_by` to the authenticated user. Requests with invalid or unknown `catalog_id` MUST fail with HTTP 400 and a message in Spanish. Requests missing or invalid `email` MUST fail with HTTP 400 and a Spanish message that does not echo the submitted mailbox.

#### Scenario: Create persona natural

- **WHEN** an authorized client posts valid persona natural data including a valid `email` and social networks containing valid `catalog_id` and `account_name`
- **THEN** the response is HTTP 201 and the supplier and networks are persisted with `catalog_id` foreign keys
- **AND** the persisted row includes the normalized `email`

#### Scenario: Invalid RUT rejected

- **WHEN** an authorized client posts a supplier with an invalid RUT
- **THEN** the response is HTTP 400 with an error message in Spanish

#### Scenario: Invalid catalog_id rejected

- **WHEN** an authorized client posts social networks with a `catalog_id` that does not exist in `social_network_catalog`
- **THEN** the response is HTTP 400 with a Spanish validation message
- **AND** no supplier row is inserted

### Requirement: Supplier update API

The backend MUST expose `PUT /api/suppliers/:id` requiring grant `NAV_ACTION_PROVEEDORES_EDIT` or `NAV_ACTION_PROVEEDORES_CREATE` (CASL `update` or `create` on `Supplier`). Update MUST replace the full social network list when `social_networks` is sent (delete existing rows for the supplier, insert new rows), validate each network entry with required `catalog_id` (existing catalog row) and `account_name`, persist `email` and `phone` on table `supplier` when those keys are present in the payload (email optional: omitted leaves the column unchanged; blank stores NULL; invalid format is HTTP 400), run in a transaction, set `updated_by`, and return 404 if the supplier does not exist. A payload that only contains contact fields MUST still persist them (the update MUST NOT skip the base-table write when child and social-network fields are absent).

#### Scenario: Update social networks

- **WHEN** an authorized client sends an update with a new `social_networks` array using valid `catalog_id` values
- **THEN** previous networks for that supplier are removed and the new list is stored with catalog references

#### Scenario: Update with invalid catalog_id

- **WHEN** an authorized client sends an update with a `social_networks` entry containing an unknown `catalog_id`
- **THEN** the response is HTTP 400 with a Spanish validation message
- **AND** existing supplier data is not partially updated

#### Scenario: Update contact only

- **WHEN** an authorized client PUTs only `{ "email": "nuevo@agencia.cl" }` for an existing supplier
- **THEN** the response is HTTP 200
- **AND** the stored `email` is `nuevo@agencia.cl`
- **AND** other supplier fields are unchanged

### Requirement: Supplier list API

The backend MUST expose `GET /api/suppliers` requiring authentication and grant `NAV_ACTION_PROVEEDORES_READ` (CASL `read` on `Supplier`). The endpoint MUST return all suppliers including their social networks, `email`, and `phone`, support optional case-insensitive search on `full_name`, `razon_social`, `rut_body`, `rut_empresa_body`, and `email`, and order results with `empresa` before `persona_natural`, alphabetically within each group. Each element in `social_networks` MUST include at least `id`, `catalog_id`, `code`, `name`, `account_name`, and `sort_order` (with `code` and `name` sourced from `social_network_catalog` via join). The field `network_name` MUST NOT appear in responses.

#### Scenario: List with search

- **WHEN** an authorized client sends `GET /api/suppliers?search=acme`
- **THEN** the response is HTTP 200 with suppliers whose name or RUT fields match the search term
- **AND** each supplier's `social_networks` entries include `catalog_id`, `code`, and `name`

#### Scenario: Unauthorized list

- **WHEN** a client without `NAV_ACTION_PROVEEDORES_READ` calls `GET /api/suppliers`
- **THEN** the server responds with HTTP 403

### Requirement: Supplier detail API

The backend MUST expose `GET /api/suppliers/:id` requiring `NAV_ACTION_PROVEEDORES_READ` (CASL `read` on `Supplier`). The response MUST include the supplier, `email`, `phone`, and all associated social networks. Each social network object MUST include at least `id`, `catalog_id`, `code`, `name`, `account_name`, and `sort_order`. If the supplier does not exist, the server MUST respond with HTTP 404 and a message in Spanish.

#### Scenario: Existing supplier

- **WHEN** an authorized client requests a valid supplier id
- **THEN** the response is HTTP 200 with supplier fields including `email` and `phone`, and `social_networks` array
- **AND** each network includes `catalog_id`, `code`, and `name` from the catalog join

#### Scenario: Missing supplier

- **WHEN** an authorized client requests a non-existent id
- **THEN** the response is HTTP 404

### Requirement: Suppliers admin UI

The frontend MUST provide list, read-only detail, and create/edit pages at `/app/proveedores`, `/app/proveedores/nuevo`, `/app/proveedores/:id`, and `/app/proveedores/:id/edit`. The UI MUST hide "Nuevo proveedor" without CREATE grant and "Editar" without EDIT grant; validate required fields and RUT on the client; display RUT as `XX.XXX.XXX-X`; show conditional sections for persona natural vs empresa including optional personería; show Correo and Teléfono in Datos básicos; on the list page show a Correo column with `Sin correo` when email is absent; and follow corporate UI tokens (pill buttons, white cards, Nunito Sans, link color `#F62D84`).

Social networks MUST be captured and displayed using `SocialNetworkSelector` (catalog-based visual selector with icons), not a free-text editable table with hardcoded network name options. Form state and create/update payloads MUST send `social_networks` as an array of `{ catalog_id, account_name }` where `catalog_id` is a UUID referencing `social_network_catalog`. The field `network_name` MUST NOT be used in form state or submit payloads.

The create page MUST display the form as two vertically stacked block cards ("Datos básicos del proveedor" and "Redes sociales") without tabs. The view and edit pages MUST display three tabs: "Datos básicos", "Redes sociales", and "Antecedentes contractuales". The third tab MUST show contract history (signed documents and drafts in progress) for the supplier. On validation failure during submit, the UI MUST navigate to the tab containing the first field error.

Client-side validation of social networks MUST require both `catalog_id` and non-empty `account_name` for each submitted network entry. Client-side validation MUST require Correo on create and MUST NOT require it on edit. Validation error messages MUST be in Spanish (es-CL).

#### Scenario: Create flow

- **WHEN** a user with CREATE grant opens `/app/proveedores/nuevo`, completes a valid empresa form including email and social networks via the catalog selector, and saves
- **THEN** the user is redirected to list or detail and the new supplier appears in the list
- **AND** the create payload contains `social_networks` with `catalog_id` and `account_name` only
- **AND** the create payload contains `email`

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
