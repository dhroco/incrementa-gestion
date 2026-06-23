## ADDED Requirements

### Requirement: GCS service provides signed read URL

The `gcsService` module (`backend/services/gcsService.js`) SHALL expose `getSignedUrl({ gcsPath, expiresInMinutes })` in addition to existing buffer operations. The method SHALL use `@google-cloud/storage` v4 signed URLs with action `read` for the object at `gcsPath` in the configured bucket. The default instance created by `createGcsService` MUST include `getSignedUrl` in its returned API. Existing methods `uploadBuffer`, `downloadBuffer`, and `deleteFile` MUST remain unchanged in behavior.

#### Scenario: Generate signed URL for existing object path

- **WHEN** caller invokes `getSignedUrl({ gcsPath: 'contratos/co/su/tpl/2026/05/doc.pdf', expiresInMinutes: 60 })` with valid service account credentials
- **THEN** the function returns a non-empty HTTPS URL that grants read access to `gs://<GCS_BUCKET>/<gcsPath>`
- **AND** the URL expires approximately 60 minutes after generation

#### Scenario: Signed URL uses configured bucket

- **WHEN** `createGcsService({ bucketName: 'test-bucket' })` is used
- **THEN** `getSignedUrl` signs URLs for objects under `test-bucket`
