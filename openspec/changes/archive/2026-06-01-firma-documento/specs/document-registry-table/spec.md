## ADDED Requirements

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
