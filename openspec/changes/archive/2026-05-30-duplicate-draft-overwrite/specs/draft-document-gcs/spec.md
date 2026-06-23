## ADDED Requirements

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

### Requirement: Overwrite replaces existing active draft

When `body.overwrite === true` and a duplicate candidate exists per the duplicate-detection rules, the service SHALL re-query for that candidate before destructive actions.

If the candidate still exists, the service SHALL:

1. Delete the GCS object at `existing.gcs_path` via `gcsService.deleteFile({ gcsPath })`
2. Delete the `draft_document` row by `id`
3. Continue with normal PDF generation and insert

If `overwrite === true` but no duplicate candidate exists on re-query, the service SHALL proceed with normal generation without error.

The service SHALL NOT perform delete operations when `overwrite === true` if no duplicate candidate was found in the re-query.

#### Scenario: Overwrite deletes GCS and database row then generates

- **WHEN** generate is posted with `overwrite: true`
- **AND** an active duplicate exists for S+C+T in the current month
- **THEN** `gcsService.deleteFile` is called with the duplicate's `gcs_path`
- **AND** the duplicate `draft_document` row is removed
- **AND** a new PDF is uploaded and a new `draft_document` row is inserted

#### Scenario: Overwrite with no duplicate proceeds normally

- **WHEN** generate is posted with `overwrite: true`
- **AND** no active duplicate exists on re-query
- **THEN** the service generates and persists a new draft without delete calls

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
