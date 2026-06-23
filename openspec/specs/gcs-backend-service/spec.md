# gcs-backend-service Specification

## Purpose

Backend integration with Google Cloud Storage: environment configuration (`GCS_BUCKET`, `GCS_KEY_FILE`), local developer variables script, and a reusable `gcsService` module for buffer upload, download, and delete operations.
## Requirements
### Requirement: Backend declares GCS configuration per environment

`backend/config.js` SHALL define `GCS_BUCKET` and `GCS_KEY_FILE` in the `local`, `dev`, and `prod` environment objects immediately after `KEYCLOAK_REALM`. `GCS_BUCKET` SHALL resolve from `process.env.GCS_BUCKET` with default `incrementa-contratos-dev`. `GCS_KEY_FILE` SHALL resolve from `process.env.GOOGLE_APPLICATION_CREDENTIALS` or be `null` when unset.

#### Scenario: Local config exposes bucket default

- **WHEN** `ENVIRONMENT` is `local` and `GCS_BUCKET` is not set in the process environment
- **THEN** the exported config includes `GCS_BUCKET` equal to `incrementa-contratos-dev`

#### Scenario: Credentials path from standard env var

- **WHEN** `GOOGLE_APPLICATION_CREDENTIALS` is set to a JSON key path
- **THEN** the exported config includes `GCS_KEY_FILE` equal to that path

### Requirement: Local environment script sets GCS variables

`backend/SET_VARS_AMBIENTE_LOCAL.cmd` SHALL set `GCS_BUCKET` and `GOOGLE_APPLICATION_CREDENTIALS` after `KEYCLOAK_REALM`, echo their presence in the diagnostic section (without printing the credential path value), and propagate both variables through the `endlocal & (...)` block that exports session variables.

#### Scenario: Developer loads local GCS vars

- **WHEN** a developer runs `call .\SET_VARS_AMBIENTE_LOCAL.cmd` from `backend/`
- **THEN** `GCS_BUCKET` is `incrementa-contratos-dev`
- **AND** `GOOGLE_APPLICATION_CREDENTIALS` points to the local service account JSON under `backend/secrets/`

### Requirement: GCS service module provides buffer operations

The backend SHALL provide `backend/services/gcsService.js` using `@google-cloud/storage`, exporting `createGcsService` and `gcsService` (default instance). The default instance SHALL use `config.GCS_BUCKET` and `config.GCS_KEY_FILE`. The service SHALL implement `uploadBuffer`, `downloadBuffer`, and `deleteFile` operating on a `gcsPath` within the configured bucket.

#### Scenario: Upload buffer to object path

- **WHEN** caller invokes `uploadBuffer({ buffer, gcsPath, contentType })` with valid credentials
- **THEN** the object is written to `gs://<GCS_BUCKET>/<gcsPath>` with the given content type
- **AND** the function returns the `gcsPath`

#### Scenario: Download object as buffer

- **WHEN** caller invokes `downloadBuffer({ gcsPath })` for an existing object
- **THEN** the function returns the object contents as a Buffer

#### Scenario: Delete object ignoring missing file

- **WHEN** caller invokes `deleteFile({ gcsPath })` and the object does not exist
- **THEN** the operation completes without throwing due to `ignoreNotFound: true`

### Requirement: Google Cloud Storage client dependency

`backend/package.json` SHALL list `@google-cloud/storage` as a dependency installed via `npm install @google-cloud/storage` in the backend directory.

#### Scenario: Dependency available to gcsService

- **WHEN** the backend process loads `gcsService.js`
- **THEN** `require('@google-cloud/storage')` resolves successfully

### Requirement: GCS service provides signed read URL

The `gcsService` module (`backend/services/gcsService.js`) SHALL expose `getSignedUrl({ gcsPath, expiresInMinutes })` in addition to existing buffer operations. The method SHALL use `@google-cloud/storage` v4 signed URLs with action `read` for the object at `gcsPath` in the configured bucket. The default instance created by `createGcsService` MUST include `getSignedUrl` in its returned API. Existing methods `uploadBuffer`, `downloadBuffer`, and `deleteFile` MUST remain unchanged in behavior.

#### Scenario: Generate signed URL for existing object path

- **WHEN** caller invokes `getSignedUrl({ gcsPath: 'contratos/co/su/tpl/2026/05/doc.pdf', expiresInMinutes: 60 })` with valid service account credentials
- **THEN** the function returns a non-empty HTTPS URL that grants read access to `gs://<GCS_BUCKET>/<gcsPath>`
- **AND** the URL expires approximately 60 minutes after generation

#### Scenario: Signed URL uses configured bucket

- **WHEN** `createGcsService({ bucketName: 'test-bucket' })` is used
- **THEN** `getSignedUrl` signs URLs for objects under `test-bucket`

