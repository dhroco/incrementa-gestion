## ADDED Requirements

### Requirement: Supplier country code on base table

The system MUST persist `supplier.country_code` as a required ISO-3166-1 alpha-2 code (`varchar(2)` with CHECK `^[A-Z]{2}$`), with no column DEFAULT. The column MUST live on table `supplier`, not on the CTI children. The migration MUST add it nullable, backfill `'CL'` on every existing supplier row, and then set NOT NULL.

#### Scenario: Existing suppliers backfilled to Chile

- **WHEN** `knex migrate:latest` completes including the supplier country migration
- **THEN** table `supplier` has `country_code` NOT NULL
- **AND** every previously existing supplier row has `country_code` equal to `CL`
- **AND** the column has no DEFAULT

#### Scenario: Create without country rejected

- **WHEN** an authorized client posts an otherwise-valid supplier without `country_code`
- **THEN** the response is HTTP 400 with a Spanish message that the country is required
- **AND** no supplier row is inserted
- **AND** the message does not contain a document number

### Requirement: Identity document type catalog

The system MUST persist catalog table `identity_document_type` with at least columns `code` (unique), `country_code`, `label`, `label_long`, `validator_key`, `pattern` (nullable), and `format_example`. The table MUST be seeded with type `RUT` for country `CL` (`validator_key` `rut_cl`) and type `RFC` for country `MX` (`validator_key` `pattern_compact`, with patterns for `persona_natural` length 13 and `empresa` length 12). Normalization of a submitted identifier is a property of the document type (`validator_key`), not of pattern-matching in general. Adding a country that validates by `pattern` MUST be possible by inserting a catalog row without a code change; that row's `pattern` MUST be written against the country's real identifier (including its punctuation), not against a compacted form. Deleting a catalog row referenced by a supplier document type MUST be prevented (`ON DELETE RESTRICT`).

#### Scenario: Catalog exists after migration

- **WHEN** `knex migrate:latest` completes including the identity document type migration
- **THEN** table `identity_document_type` exists
- **AND** it contains a `RUT` row with `country_code` `CL` and `validator_key` `rut_cl`
- **AND** it contains an `RFC` row with `country_code` `MX` and `validator_key` `pattern_compact`

#### Scenario: New pattern type validates without code changes

- **WHEN** a test inserts a catalog row with a new `code`, `country_code`, `validator_key` equal to `pattern`, and a regex `pattern` written against the country's real identifier (including punctuation)
- **AND** an authorized client posts a supplier with that `country_code` and a `document_number` matching that real form
- **THEN** the supplier is created
- **AND** the stored `document_number` preserves the submitted punctuation
- **AND** a value that only matches after stripping punctuation is rejected with HTTP 400 and a Spanish message that does not echo the submitted value

### Requirement: Supplier document identifier replaces RUT columns

`supplier_persona_natural` and `supplier_empresa` MUST store `document_type_code` (FK to `identity_document_type.code`) and `document_number` (canonical normalized text) instead of `rut_body`/`rut_dv` or `rut_empresa_body`/`rut_empresa_dv`. `supplier_empresa` MUST store nullable `rep_document_type_code` and `rep_document_number` instead of `rut_rep_legal_body`/`rut_rep_legal_dv`. After the data migration, those `rut_*` columns MUST NOT exist on the supplier child tables. Canonical Chilean storage MUST be `cuerpo-DV` without dots (e.g. `12345678-5`); canonical Mexican storage MUST be uppercase without spaces. Display format MUST be derived: Chile `XX.XXX.XXX-X`, Mexico equal to the canonical value.

The 22 existing Chilean suppliers MUST be backfilled so that the visible RUT after migration equals the visible RUT before migration, including the check digit. If any row would differ, the migration MUST abort before dropping columns.

Before dropping `rut_*` columns, the migration MUST dump every row of `supplier_persona_natural` and `supplier_empresa` (complete row, including `rut_*`) into backup table `supplier_child_backup`, following the same pattern as `template_content_backup`: UUID primary key, `supplier_id`, `child_kind` (`persona_natural` or `empresa`), `row_json` (jsonb of the full child row), identifiable `note`, and `backed_up_at`. The migration `down` MUST restore `rut_*` columns from that backup (exact values), and MUST NOT reconstruct them by splitting `document_number` on the hyphen.

#### Scenario: Chilean suppliers keep the same visible RUT

- **WHEN** the document-identifier migration completes
- **THEN** each previously existing supplier has `document_type_code` `RUT` and `country_code` `CL`
- **AND** `document_display` (or equivalent formatted value) equals the pre-migration visible RUT including the verifier digit
- **AND** columns `rut_body`, `rut_dv`, `rut_empresa_body`, `rut_empresa_dv`, `rut_rep_legal_body`, and `rut_rep_legal_dv` do not exist on the supplier child tables

#### Scenario: Child rows backed up before dropping RUT columns

- **WHEN** the document-identifier migration is about to drop `rut_*` columns
- **THEN** table `supplier_child_backup` contains one row per existing `supplier_persona_natural` and `supplier_empresa` row
- **AND** each backup `row_json` includes the original `rut_*` values
- **AND** each backup `note` identifies this change (`identificador-tributario-por-pais`)
- **AND** rolling the migration back restores those `rut_*` values from `row_json`, not by parsing `document_number`

#### Scenario: Mexican RFC stored canonically

- **WHEN** an authorized client posts a persona natural supplier with `country_code` `MX` and `document_number` `legf870121mga`
- **THEN** the stored `document_number` is `LEGF870121MGA`
- **AND** `document_type_code` is `RFC`

### Requirement: Document validation by catalog type

`supplierService.validatePayload` MUST resolve `document_type_code` from the payload or, when omitted, from the unique catalog row for `country_code`. It MUST validate `document_number` through a validator registry keyed by `validator_key`. The registry MUST have three keys:

- `rut_cl` MUST call existing `parseRut` from `backend/utils/rut.js` without rewriting it
- `pattern` MUST apply `identity_document_type.pattern` (a regex, or a JSON object keyed by `persona_natural` / `empresa`) after trim and uppercase only, and MUST persist the identifier with its punctuation intact
- `pattern_compact` MUST apply the same `pattern` field after also stripping spaces, dots, and hyphens, and MUST persist that compacted form

The catalog row chooses the normalizer; `pattern` MUST NOT compact. The supplier's own identifier MUST use the pattern for `supplier_type`. The legal representative identifier MUST always validate as `persona_natural`. REST and MCP MUST use this same path. Error messages MUST be in Spanish (es-CL) and MUST NOT include the submitted document value.

Input aliases `rut` (persona natural), `rut_empresa` (empresa), and `rut_rep_legal` MUST be accepted when `document_number` / `rep_document_number` are omitted, and MUST persist to the same columns.

#### Scenario: Invalid Chilean RUT still rejected

- **WHEN** an authorized client posts a Chilean supplier with an invalid RUT
- **THEN** the response is HTTP 400 with the same Spanish invalid-RUT message used today
- **AND** the message does not echo the submitted value

#### Scenario: Mexican persona natural RFC accepted

- **WHEN** an authorized client posts a persona natural supplier with `country_code` `MX` and RFC `LEGF870121MGA`
- **THEN** the response is HTTP 201
- **AND** the stored identifier is that RFC

#### Scenario: Mexican persona natural RFC with wrong length rejected

- **WHEN** an authorized client posts a persona natural supplier with `country_code` `MX` and a 12-character RFC
- **THEN** the response is HTTP 400 with a Spanish message that the RFC is not valid
- **AND** the message does not contain the submitted RFC

#### Scenario: Empresa RFC and persona-física representative

- **WHEN** an authorized client posts an empresa supplier with `country_code` `MX`, a 12-character company RFC, and a 13-character representative RFC
- **THEN** the response is HTTP 201
- **AND** both identifiers are stored

#### Scenario: Alias rut maps to document_number

- **WHEN** an authorized client posts a Chilean persona natural with `rut` `12.345.678-5` and no `document_number`
- **THEN** the stored `document_number` is `12345678-5`

#### Scenario: Pattern type preserves country punctuation

- **WHEN** a catalog row exists with `validator_key` `pattern` and regex `^[0-9]{2}-[0-9]{8}-[0-9]$` (for example CUIT/AR)
- **AND** an authorized client posts a supplier with that `country_code` and `document_number` `20-12345678-9`
- **THEN** the supplier is created
- **AND** the stored `document_number` is `20-12345678-9`
- **AND** posting the same country with `20123456789` is rejected with HTTP 400 and a Spanish message that does not echo the submitted value

#### Scenario: Pattern compact accepts RFC with separators

- **WHEN** an authorized client posts a persona natural supplier with `country_code` `MX` and `document_number` `LEGF-870121-MGA`
- **THEN** the response is HTTP 201
- **AND** the stored `document_number` is `LEGF870121MGA`

### Requirement: Identity document types catalog API

The backend MUST expose `GET /api/identity-document-types` requiring authentication and CASL `read` on `Supplier`. The response MUST list catalog rows including `code`, `country_code`, `label`, `label_long`, `validator_key`, `pattern`, and `format_example`.

#### Scenario: Authorized catalog list

- **WHEN** an authorized client sends `GET /api/identity-document-types`
- **THEN** the response is HTTP 200 with the seeded `RUT` and `RFC` rows

#### Scenario: Unauthorized catalog list

- **WHEN** a client without `read` on `Supplier` calls `GET /api/identity-document-types`
- **THEN** the server responds with HTTP 403

## MODIFIED Requirements

### Requirement: Supplier database schema

The system MUST persist suppliers in table `supplier` and their social network accounts in table `supplier_social_network`, with columns and constraints as defined in migration `202605290003_create_supplier_tables.js` as subsequently amended by the social network catalog migration, the supplier contact migration, the supplier country-code migration, and the identity-document migration. Supplier type MUST be either `persona_natural` or `empresa`. Table `supplier` MUST include NOT NULL `country_code`. Child tables MUST store `document_type_code` and `document_number` (and empresa representative `rep_document_*`) and MUST NOT store `rut_body`/`rut_dv` (or the empresa/rep equivalents). Each `supplier_social_network` row MUST reference `social_network_catalog` via foreign key column `catalog_id` (UUID NOT NULL); the column `network_name` MUST NOT exist after the catalog migration. Social network rows MUST cascade-delete when a supplier is deleted. Deleting a catalog row that is referenced by a supplier social network MUST be prevented (`ON DELETE RESTRICT` or equivalent).

#### Scenario: Tables exist after migration

- **WHEN** `knex migrate:latest` completes successfully including the social network catalog migration
- **THEN** tables `supplier`, `supplier_social_network`, and `social_network_catalog` exist with the specified columns and foreign keys
- **AND** `supplier_social_network` has column `catalog_id` referencing `social_network_catalog.id`

#### Scenario: Legacy network_name column removed

- **WHEN** the social network catalog migration has been applied
- **THEN** column `supplier_social_network.network_name` does not exist

#### Scenario: Supplier RUT columns removed

- **WHEN** the identity-document migration has been applied
- **THEN** `supplier_persona_natural` and `supplier_empresa` have no `rut_body` or `rut_dv` columns (nor `rut_empresa_*` / `rut_rep_legal_*`)
- **AND** they have `document_type_code` and `document_number`

### Requirement: Supplier list API

The backend MUST expose `GET /api/suppliers` requiring authentication and grant `NAV_ACTION_PROVEEDORES_READ` (CASL `read` on `Supplier`). The endpoint MUST return all suppliers including their social networks, `email`, `phone`, `country_code`, `document_type_code`, `document_number`, and `document_display`, support optional case-insensitive search on `full_name`, `razon_social`, `document_number`, and `email`, and order results with `empresa` before `persona_natural`, alphabetically within each group. Search MUST also match a compacted form of the term (without dots, hyphens, or spaces) against `document_number`. Each element in `social_networks` MUST include at least `id`, `catalog_id`, `code`, `name`, `account_name`, and `sort_order` (with `code` and `name` sourced from `social_network_catalog` via join). The field `network_name` MUST NOT appear in responses. Response objects MUST NOT include `rut_body` or `rut_dv` (nor empresa/rep body+dv fields). The field `rut` MAY be present as an alias of `document_display`.

#### Scenario: List with search

- **WHEN** an authorized client sends `GET /api/suppliers?search=acme`
- **THEN** the response is HTTP 200 with suppliers whose name or document fields match the search term
- **AND** each supplier's `social_networks` entries include `catalog_id`, `code`, and `name`

#### Scenario: Search by Chilean RUT digits or punctuation

- **WHEN** an authorized client sends `GET /api/suppliers?search=12.345.678-5` or a digit fragment of that RUT
- **THEN** matching Chilean suppliers are returned

#### Scenario: Search by RFC

- **WHEN** an authorized client sends `GET /api/suppliers?search=LEGF870121`
- **THEN** matching Mexican suppliers are returned

#### Scenario: Unauthorized list

- **WHEN** a client without `NAV_ACTION_PROVEEDORES_READ` calls `GET /api/suppliers`
- **THEN** the server responds with HTTP 403

### Requirement: Supplier detail API

The backend MUST expose `GET /api/suppliers/:id` requiring `NAV_ACTION_PROVEEDORES_READ` (CASL `read` on `Supplier`). The response MUST include the supplier, `email`, `phone`, `country_code`, document identifier fields (`document_type_code`, `document_number`, `document_display`, and representative equivalents when applicable), and all associated social networks. Each social network object MUST include at least `id`, `catalog_id`, `code`, `name`, `account_name`, and `sort_order`. The response MUST NOT include supplier `rut_body`/`rut_dv` fields. If the supplier does not exist, the server MUST respond with HTTP 404 and a message in Spanish.

#### Scenario: Existing supplier

- **WHEN** an authorized client requests a valid supplier id
- **THEN** the response is HTTP 200 with supplier fields including `email`, `phone`, `country_code`, `document_display`, and `social_networks` array
- **AND** each network includes `catalog_id`, `code`, and `name` from the catalog join
- **AND** `rut_body` is not present on the payload

#### Scenario: Missing supplier

- **WHEN** an authorized client requests a non-existent id
- **THEN** the response is HTTP 404

### Requirement: Supplier create API

The backend MUST expose `POST /api/suppliers` requiring `NAV_ACTION_PROVEEDORES_CREATE` (CASL `create` on `Supplier`). Creation MUST validate required fields by type (`persona_natural`: `full_name`, `document_number`; `empresa`: `razon_social`, `document_number`), require `country_code` present in `identity_document_type`, resolve and validate the document via the catalog validator registry (Chilean RUT through existing `parseRut`; RFC through `pattern_compact` according to supplier type; other `pattern` types against the country's real identifier), require `email` (trimmed, lowercase, `isValidEmail`), accept optional `phone` with lax shape validation, validate each social network entry with required `catalog_id` (UUID referencing an existing `social_network_catalog` row) and `account_name`, insert supplier (including `email`, `phone`, and `country_code` on the base row) and social networks atomically in a transaction, and set `created_by` and `updated_by` to the authenticated user. Requests with invalid or unknown `catalog_id` MUST fail with HTTP 400 and a message in Spanish. Requests missing or invalid `email` MUST fail with HTTP 400 and a Spanish message that does not echo the submitted mailbox. Requests with an invalid document MUST fail with HTTP 400 and a Spanish message that does not echo the submitted identifier.

#### Scenario: Create persona natural

- **WHEN** an authorized client posts valid persona natural data including a valid `email`, `country_code`, document identifier, and social networks containing valid `catalog_id` and `account_name`
- **THEN** the response is HTTP 201 and the supplier and networks are persisted with `catalog_id` foreign keys
- **AND** the persisted row includes the normalized `email` and canonical `document_number`

#### Scenario: Invalid RUT rejected

- **WHEN** an authorized client posts a supplier with an invalid RUT
- **THEN** the response is HTTP 400 with an error message in Spanish

#### Scenario: Invalid catalog_id rejected

- **WHEN** an authorized client posts social networks with a `catalog_id` that does not exist in `social_network_catalog`
- **THEN** the response is HTTP 400 with a Spanish validation message
- **AND** no supplier row is inserted

### Requirement: Supplier update API

The backend MUST expose `PUT /api/suppliers/:id` requiring grant `NAV_ACTION_PROVEEDORES_EDIT` or `NAV_ACTION_PROVEEDORES_CREATE` (CASL `update` or `create` on `Supplier`). Update MUST replace the full social network list when `social_networks` is sent (delete existing rows for the supplier, insert new rows), validate each network entry with required `catalog_id` (existing catalog row) and `account_name`, persist `email`, `phone`, and `country_code` on table `supplier` when those keys are present in the payload (email optional: omitted leaves the column unchanged; blank stores NULL; invalid format is HTTP 400; country omitted leaves the column unchanged; when present it is revalidated and the document is revalidated against the new country), persist document identifier fields on the child table when present, run in a transaction, set `updated_by`, and return 404 if the supplier does not exist. A payload that only contains contact or country fields MUST still persist them (the update MUST NOT skip the base-table write when child and social-network fields are absent).

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

#### Scenario: Update country only persists

- **WHEN** an authorized client PUTs only `{ "country_code": "CL" }` for an existing Chilean supplier
- **THEN** the response is HTTP 200
- **AND** `country_code` remains `CL`

### Requirement: Suppliers admin UI

The frontend MUST provide list, read-only detail, and create/edit pages at `/app/proveedores`, `/app/proveedores/nuevo`, `/app/proveedores/:id`, and `/app/proveedores/:id/edit`. The UI MUST hide "Nuevo proveedor" without CREATE grant and "Editar" without EDIT grant; require a country selector whose options come from `GET /api/identity-document-types`; adapt the document field label, placeholder, and validation to the selected country's catalog type; use `RutInput` and display format `XX.XXX.XXX-X` when the type is Chilean RUT; validate required fields on the client; show conditional sections for persona natural vs empresa including optional personería; show Correo and Teléfono in Datos básicos; on the list page show an Identificador column with `document_display` (MUST NOT run a non-RUT value through `formatRutDisplay`) and a Correo column with `Sin correo` when email is absent; and follow corporate UI tokens (pill buttons, white cards, Nunito Sans, link color `#F62D84`).

Social networks MUST be captured and displayed using `SocialNetworkSelector` (catalog-based visual selector with icons), not a free-text editable table with hardcoded network name options. Form state and create/update payloads MUST send `social_networks` as an array of `{ catalog_id, account_name }` where `catalog_id` is a UUID referencing `social_network_catalog`. The field `network_name` MUST NOT be used in form state or submit payloads.

The create page MUST display the form as two vertically stacked block cards ("Datos básicos del proveedor" and "Redes sociales") without tabs. The view and edit pages MUST display three tabs: "Datos básicos", "Redes sociales", and "Antecedentes contractuales". The third tab MUST show contract history (signed documents and drafts in progress) for the supplier. On validation failure during submit, the UI MUST navigate to the tab containing the first field error.

Client-side validation of social networks MUST require both `catalog_id` and non-empty `account_name` for each submitted network entry. Client-side validation MUST require Correo on create and MUST NOT require it on edit. Client-side validation MUST require country and document on create. Validation error messages MUST be in Spanish (es-CL) and MUST NOT display the submitted document value.

#### Scenario: Create flow

- **WHEN** a user with CREATE grant opens `/app/proveedores/nuevo`, completes a valid empresa form including country, document, email and social networks via the catalog selector, and saves
- **THEN** the user is redirected to list or detail and the new supplier appears in the list
- **AND** the create payload contains `social_networks` with `catalog_id` and `account_name` only
- **AND** the create payload contains `email` and `country_code`

#### Scenario: Type locked on edit

- **WHEN** a user edits an existing supplier
- **THEN** the supplier type selector is not changeable

#### Scenario: Chile keeps RutInput

- **WHEN** a user selects country Chile on the create or edit form
- **THEN** the document field is `RutInput`
- **AND** the label is RUT (or RUT empresa / RUT representante legal as applicable)

#### Scenario: Mexico shows RFC field

- **WHEN** a user selects country México on the create form
- **THEN** the document field is a text input labeled RFC
- **AND** it is not `RutInput`

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
