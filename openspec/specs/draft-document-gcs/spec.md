# draft-document-gcs Specification

## Purpose
TBD - created by archiving change migrate-generated-documents-gcs. Update Purpose after archive.
## Requirements
### Requirement: draft_document table stores GCS metadata

The database SHALL provide table `draft_document` with columns: `id` (UUID PK, default `gen_random_uuid()`), `template_id` (UUID NOT NULL FK → `template`), `supplier_id` (UUID NOT NULL FK → `supplier`), `company_id` (UUID NOT NULL FK → `company`), `gcs_path` (TEXT NOT NULL), `file_name` (TEXT NOT NULL), `status` (VARCHAR(32) NOT NULL DEFAULT `'draft'`), `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now()), `created_by` (UUID NOT NULL FK → `user_profile`), `expires_at` (TIMESTAMPTZ NULL). Indexes SHALL exist on `supplier_id`, `company_id`, and `status`.

#### Scenario: Migration creates draft_document

- **WHEN** migration `202605300016_create_draft_document` runs successfully
- **THEN** table `draft_document` exists with the defined columns and indexes

### Requirement: Document Builder generates PDF to GCS and draft_document

`documentBuilderService.generateAndPersist` SHALL resolve `created_by` via `getUserProfileIdByUserId(userId)` where `userId` is the Keycloak subject. If no `user_profile` row exists, the service SHALL return HTTP 404 with a Spanish error message.

The service SHALL load template `t.code` in `getTemplateRow`. It SHALL generate `docId` with `crypto.randomUUID()`, build `gcsPath` as `contratos/{companyId}/{supplierId}/{templateCode}/{year}/{month}/{docId}_{fileName}`, upload the PDF buffer via `gcsService.uploadBuffer`, and INSERT into `draft_document` (not `generated_document`).

The INSERT SHALL include `contract_overrides` set to the pre-processed overrides object (after `preprocessMissingFieldOverrides`), containing formatted values such as `precio_numero`, resolved dates, and social network fields, serialized as JSONB.

The successful response SHALL include per document: `id`, `file_name`, `gcs_path`, and `status` (from the inserted row).

#### Scenario: Generate with valid user profile

- **WHEN** an authorized user with a matching `user_profile` posts generate with valid company, supplier, and template
- **THEN** a PDF object exists at the constructed GCS path
- **AND** a `draft_document` row exists with `status` `'draft'`, `created_by` equal to that user's `user_profile.id`, and non-null `contract_overrides` when overrides were provided

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

### Requirement: Duplicate active draft detection on generate

Before generating a PDF, `documentBuilderService.generateAndPersist` SHALL determine the current calendar year and month in timezone `America/Santiago` using `yearMonthInSantiago()`.

It SHALL query `draft_document` for an existing row where:

- `supplier_id` equals the request `supplierId`
- `company_id` equals the resolved readable company id
- `template_id` equals the request template id
- `status` is NOT `'signed'` and NOT `'rejected'`
- `created_at` falls in that year and month (evaluated in `America/Santiago`)

If one or more rows match, the service SHALL treat the most recently created row (`ORDER BY created_at DESC`, first result) as the duplicate candidate.

If a duplicate candidate exists and `body.overwrite` is not strictly `true`, the service SHALL NOT generate a PDF, upload to GCS, or insert a new row. It SHALL return HTTP 409 with code `DUPLICATE_DRAFT`, a Spanish message, and `data.existing` containing `id`, `file_name`, `created_at`, and `status` of the duplicate candidate.

#### Scenario: Active duplicate without overwrite flag

- **WHEN** an authorized user posts generate for supplier S, company C, template T in month M
- **AND** a `draft_document` row exists for S+C+T in month M with status `'draft'`
- **AND** the request body does not include `overwrite: true`
- **THEN** the service responds with HTTP 409 and code `DUPLICATE_DRAFT`
- **AND** the response includes `existing.id`, `existing.file_name`, `existing.created_at`, and `existing.status`
- **AND** no new GCS object or `draft_document` row is created

#### Scenario: Signed draft in same month does not block generate

- **WHEN** the only matching row for S+C+T in month M has status `'signed'`
- **THEN** the service proceeds with normal PDF generation and insert

### Requirement: draft_document.content_snapshot stores the materialized Tiptap doc

A migration SHALL add nullable JSONB column `content_snapshot` to `draft_document`. The value SHALL be the Tiptap document **after** `applySubstitutionsToTipTapDoc` (variables already replaced) that was passed to `buildPdfBytesFromTipTapWithReactPdf` for that draft. It SHALL NOT be the raw template `content_json`.

Existing rows SHALL remain NULL. NULL means “generated before this change” and is consumed by the legacy sign path.

#### Scenario: Column exists and is nullable

- **WHEN** the content_snapshot migration has run
- **THEN** `draft_document` has JSONB column `content_snapshot`
- **AND** inserting a row without that column value succeeds

### Requirement: Generate persists content_snapshot of the rendered doc

On every successful `generateAndPersist` that uploads a new PDF, the INSERT into `draft_document` SHALL set `content_snapshot` to the substituted Tiptap doc used for that PDF. The generate HTTP response SHALL NOT include `content_snapshot` (it remains `id`, `file_name`, `gcs_path`, `status`).

Generate SHALL render **without** legal-representative image buffers (images are applied only at sign).

#### Scenario: New draft stores snapshot

- **WHEN** an authorized user generates a contract and all variables resolve
- **THEN** the new `draft_document` row has non-null `content_snapshot`
- **AND** that JSON has no unresolved `variable` nodes for keys that were in the substitution map
- **AND** the generate response body does not contain `content_snapshot`

#### Scenario: Snapshot matches the PDF pipeline input

- **WHEN** generate materializes `resolvedDoc` and builds the PDF from it
- **THEN** `content_snapshot` is deep-equal to that `resolvedDoc`

### Requirement: Overwrite replaces existing active draft

When `body.overwrite === true` and a duplicate candidate exists per the duplicate-detection rules, the service SHALL re-query for that candidate before destructive actions.

If the candidate still exists, the service SHALL:

1. Delete the GCS object at `existing.gcs_path` via `gcsService.deleteFile({ gcsPath })`
2. Delete the `draft_document` row by `id`
3. Continue with normal PDF generation and insert, including `content_snapshot` of the **new** substituted doc (the deleted row's snapshot SHALL NOT be copied)

If `overwrite === true` but no duplicate candidate exists on re-query, the service SHALL proceed with normal generation without error.

The service SHALL NOT perform delete operations when `overwrite === true` if no duplicate candidate was found in the re-query.

#### Scenario: Overwrite deletes GCS and database row then generates

- **WHEN** generate is posted with `overwrite: true`
- **AND** an active duplicate exists for S+C+T in the current month
- **THEN** `gcsService.deleteFile` is called with the duplicate's `gcs_path`
- **AND** the duplicate `draft_document` row is removed
- **AND** a new PDF is uploaded and a new `draft_document` row is inserted
- **AND** the new row's `content_snapshot` corresponds to the newly substituted doc, not the deleted row

#### Scenario: Overwrite with no duplicate proceeds normally

- **WHEN** generate is posted with `overwrite: true`
- **AND** no active duplicate exists on re-query
- **THEN** the service generates and persists a new draft without delete calls
- **AND** the new row has `content_snapshot` populated

### Requirement: Document Builder frontend confirms before overwrite

The Document Builder generate flow (`DocumentBuilderPage` or equivalent caller of `postDocumentBuilderGenerate`) SHALL handle API responses with `code === 'DUPLICATE_DRAFT'`.

It SHALL display a confirmation dialog stating that a contract already exists for the same supplier, template, and month, including:

- The existing `file_name`
- The existing `created_at` formatted for locale `es-CL` in timezone `America/Santiago`
- The existing status translated: `'draft'` → «Borrador», `'pending_signature'` → «Pendiente de firma»

The dialog SHALL offer «Cancelar» (dismiss without action) and «Reemplazar» (retry generate with `overwrite: true` in the request body, preserving other generate parameters such as `supplierId`, `template`, `missingFieldOverrides`, and `renderEngine`).

#### Scenario: User cancels duplicate dialog

- **WHEN** generate returns `DUPLICATE_DRAFT` and the user clicks «Cancelar»
- **THEN** no second generate request is sent
- **AND** the dialog closes

#### Scenario: User confirms replace

- **WHEN** generate returns `DUPLICATE_DRAFT` and the user clicks «Reemplazar»
- **THEN** the client posts generate again with the same payload plus `overwrite: true`
- **AND** on success the UI updates with the newly generated document as today

### Requirement: Draft status transitions on electronic sign

When `contractSigningService.signContract` completes successfully, the service SHALL UPDATE the originating `draft_document` row setting `status = 'signed'`. The row SHALL NOT be deleted. The original `gcs_path` and PDF object SHALL remain unchanged.

Drafts with status `'signed'` or `'rejected'` SHALL NOT appear in `listPendingSignature` results and SHALL NOT be signable.

#### Scenario: Draft marked signed after sign

- **WHEN** a pending draft is signed successfully
- **THEN** its `status` becomes `'signed'`
- **AND** the row remains in `draft_document`

#### Scenario: Signed draft excluded from pending list

- **WHEN** `listPendingSignature` runs after a draft was signed
- **THEN** that draft id is not included in results

