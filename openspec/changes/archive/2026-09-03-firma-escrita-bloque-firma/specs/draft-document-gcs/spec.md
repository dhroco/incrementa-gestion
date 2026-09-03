## ADDED Requirements

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

## MODIFIED Requirements

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
