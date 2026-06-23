## ADDED Requirements

### Requirement: draft_document table stores GCS metadata

The database SHALL provide table `draft_document` with columns: `id` (UUID PK, default `gen_random_uuid()`), `template_id` (UUID NOT NULL FK → `template`), `supplier_id` (UUID NOT NULL FK → `supplier`), `company_id` (UUID NOT NULL FK → `company`), `gcs_path` (TEXT NOT NULL), `file_name` (TEXT NOT NULL), `status` (VARCHAR(32) NOT NULL DEFAULT `'draft'`), `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now()), `created_by` (UUID NOT NULL FK → `user_profile`), `expires_at` (TIMESTAMPTZ NULL). Indexes SHALL exist on `supplier_id`, `company_id`, and `status`.

#### Scenario: Migration creates draft_document

- **WHEN** migration `202605300016_create_draft_document` runs successfully
- **THEN** table `draft_document` exists with the defined columns and indexes

### Requirement: Document Builder generates PDF to GCS and draft_document

`documentBuilderService.generateAndPersist` SHALL resolve `created_by` via `getUserProfileIdByUserId(userId)` where `userId` is the Keycloak subject. If no `user_profile` row exists, the service SHALL return HTTP 404 with a Spanish error message.

The service SHALL load template `t.code` in `getTemplateRow`. It SHALL generate `docId` with `crypto.randomUUID()`, build `gcsPath` as `contratos/{companyId}/{supplierId}/{templateCode}/{year}/{month}/{docId}_{fileName}`, upload the PDF buffer via `gcsService.uploadBuffer`, and INSERT into `draft_document` (not `generated_document`).

The successful response SHALL include per document: `id`, `file_name`, `gcs_path`, and `status` (from the inserted row).

#### Scenario: Generate with valid user profile

- **WHEN** an authorized user with a matching `user_profile` posts generate with valid company, supplier, and template
- **THEN** a PDF object exists at the constructed GCS path
- **AND** a `draft_document` row exists with `status` `'draft'` and `created_by` equal to that user's `user_profile.id`

#### Scenario: Generate without user profile

- **WHEN** generate is requested and `getUserProfileIdByUserId` returns null for the authenticated user
- **THEN** the service responds with HTTP 404 and a Spanish message

### Requirement: Document Builder download reads GCS via draft_document

`documentBuilderService.getGeneratedDocumentForDownload` SHALL load the row from `draft_document` by `id`, enforce company scope on `company_id`, download bytes with `gcsService.downloadBuffer({ gcsPath: row.gcs_path })`, and return `file_name` and `buffer` for the controller.

#### Scenario: Download existing draft in scope

- **WHEN** an authorized user requests download for a `draft_document` id belonging to their readable company
- **THEN** the service returns the PDF buffer and file name from GCS

#### Scenario: Download missing or out of scope

- **WHEN** the id does not exist or `company_id` does not match the resolved company
- **THEN** the service responds with HTTP 404 and message «Documento no encontrado.»

### Requirement: App wires GCS and profile resolver into document builder

`app.js` SHALL instantiate `createDocumentBuilderService` with `gcsService` (default export from `./services/gcsService`) and `getUserProfileIdByUserId` (same resolver used for suppliers/templates).

#### Scenario: Service factory receives dependencies

- **WHEN** the Express app starts with default wiring
- **THEN** `createDocumentBuilderService` is called with both `gcsService` and `getUserProfileIdByUserId`
