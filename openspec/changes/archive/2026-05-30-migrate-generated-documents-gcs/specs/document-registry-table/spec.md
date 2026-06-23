## ADDED Requirements

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
