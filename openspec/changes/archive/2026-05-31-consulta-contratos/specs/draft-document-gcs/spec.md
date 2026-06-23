## MODIFIED Requirements

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
