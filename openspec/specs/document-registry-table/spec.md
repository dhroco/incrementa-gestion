# document-registry-table Specification

## Purpose
TBD - created by archiving change migrate-generated-documents-gcs. Update Purpose after archive.
## Requirements
### Requirement: Legacy document table replaced by contract registry schema

Migration `202605300017_create_document_table` SHALL drop the legacy GFA `document` table if it exists, then create `document` with columns: `id` (UUID PK), `draft_document_id` (UUID NULL FK → `draft_document` ON DELETE SET NULL), `supplier_id` (UUID NOT NULL FK → `supplier`), `company_id` (UUID NOT NULL FK → `company`), `gcs_path` (TEXT NOT NULL), `file_name` (TEXT NOT NULL), `source` (VARCHAR(32) NOT NULL, values `'generated'` or `'uploaded'`), `template_id` (UUID NULL FK → `template` ON DELETE SET NULL), `document_type` (TEXT NULL), `signed_at` (TIMESTAMPTZ NULL), `signed_by` (TEXT NULL), `effective_from` (DATE NULL), `effective_until` (DATE NULL), `duration_months` (INTEGER NULL), `archived_at` (TIMESTAMPTZ NULL), `uploaded_by` (UUID NULL FK → `user_profile` ON DELETE SET NULL), `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now()). Indexes SHALL exist on `supplier_id`, `company_id`, and `source`.

No backend service in this change is required to read or write `document` rows.

#### Scenario: Migration creates document registry

- **WHEN** migration 017 runs after 016
- **THEN** table `document` exists with the new schema and indexes
- **AND** the legacy GFA `document` table is no longer present

### Requirement: generated_document table removed

Migration `202605300018_drop_generated_document` SHALL drop table `generated_document`. A functional `down` that recreates BYTEA storage is NOT required.

#### Scenario: Legacy generated_document dropped

- **WHEN** migration 018 runs
- **THEN** table `generated_document` does not exist

### Requirement: document table stores contract query metadata

In addition to the base registry schema from migration `202605300017_create_document_table`, migration `202606010005_add_contract_overrides.js` SHALL extend table `document` with nullable JSONB column `contract_overrides` and nullable UUID column `client_id` referencing `client.id` with `ON DELETE SET NULL`. A GIN index SHALL exist on `document.contract_overrides` for filter queries.

These columns SHALL support the contracts query module: signed contracts MAY expose flattened override fields and client name via join without requiring `draft_document_id`.

#### Scenario: document contract metadata columns exist

- **WHEN** migration `202606010005_add_contract_overrides.js` has run after migration 017
- **THEN** table `document` includes nullable `contract_overrides` and `client_id` columns
- **AND** GIN index `idx_document_contract_overrides` exists

#### Scenario: Signed contract listed with null template

- **WHEN** a `document` row has `template_id` NULL (template deleted) but valid `gcs_path`
- **THEN** the contracts list API returns the row with `template_name` null
- **AND** the UI displays "—" for plantilla

### Requirement: Signed document insert on electronic sign

When `contractSigningService.signContract` completes the GCS upload, it SHALL INSERT a row into `document` within the same transaction as the draft status update. The INSERT SHALL populate at minimum:

- `id` (new UUID)
- `draft_document_id` (source draft id)
- `supplier_id`, `company_id`, `template_id`, `client_id` (from draft)
- `contract_overrides` (copied from draft)
- `gcs_path`, `file_name` (signed artifact)
- `source`: `'generated'`
- `signed_at`: current timestamp
- `signed_by`: signer full name (TEXT)
- `uploaded_by`: signer `user_profile.id`

#### Scenario: Document row created on sign

- **WHEN** sign completes successfully
- **THEN** a new `document` row exists linked via `draft_document_id`
- **AND** `signed_at` and `signed_by` are populated
- **AND** `gcs_path` points to the signed PDF under `contratos-firmados/`

#### Scenario: Signed document appears in contracts query

- **WHEN** contracts list is queried after sign
- **THEN** the signed document appears with `source` `signed`

