## ADDED Requirements

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
