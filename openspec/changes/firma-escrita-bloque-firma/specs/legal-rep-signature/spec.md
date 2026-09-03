## ADDED Requirements

### Requirement: legal_rep_signature stores one PNG path per representative

The database SHALL provide table `legal_rep_signature` with columns: `id` (UUID PK, default `gen_random_uuid()`), `company_id` (UUID NOT NULL FK → `company` ON DELETE CASCADE), `rep_index` (SMALLINT NOT NULL, CHECK `rep_index IN (1, 2)`), `gcs_path` (TEXT NOT NULL), `uploaded_by` (UUID NULL FK → `user_profile` ON DELETE SET NULL), `created_at` (TIMESTAMPTZ NOT NULL DEFAULT now()), `updated_at` (TIMESTAMPTZ NOT NULL DEFAULT now()). A UNIQUE constraint SHALL exist on `(company_id, rep_index)`.

The table SHALL NOT store the PNG bytes or the representative's name (name remains on `company.name_legal_representative_1` / `_2`).

#### Scenario: Migration creates table

- **WHEN** the legal-rep-signature migration runs
- **THEN** table `legal_rep_signature` exists with the defined columns, check, and unique constraint

#### Scenario: Second signature for same index is rejected

- **WHEN** a row already exists for company C and `rep_index` 1
- **AND** an insert with the same pair is attempted
- **THEN** the database rejects the insert

### Requirement: Upload and replace legal representative signature

The backend SHALL expose `POST /api/companies/:id/legal-rep-signatures/:repIndex` protected by `authorize('update', 'Company')`, with multer `memoryStorage` and multipart field `signature`. `:repIndex` SHALL be `1` or `2`; otherwise HTTP 400 with a Spanish message.

Validation SHALL run on the buffer, in order:

1. Size ≤ 500 KB.
2. Magic bytes are PNG (`89 50 4E 47 0D 0A 1A 0A`). Declared `Content-Type` SHALL NOT be trusted.
3. The PNG has an alpha channel (color type 4 or 6, or a `tRNS` chunk). Opaque PNG SHALL be rejected.

On success the service SHALL upload to GCS path `firmas-representantes/{company_id}/{rep_index}/{uuid}.png` and upsert `legal_rep_signature`. If a previous `gcs_path` exists, it SHALL be deleted best-effort after the new object is stored. Errors SHALL use `sendError` with Spanish `es-CL` messages (`VALIDATION_ERROR` for 400).

The JSON response SHALL include a V4 signed read URL and SHALL NOT include `gcs_path`.

#### Scenario: Valid transparent PNG is stored

- **WHEN** an authorized user with `can('update', 'Company')` posts a ≤500 KB PNG with alpha for company C and `repIndex` 1
- **THEN** the response is HTTP 200 with `ok` semantics and a signed `url`
- **AND** the body has no `gcs_path`
- **AND** a `legal_rep_signature` row exists for `(C, 1)`

#### Scenario: JPEG rejected despite image/png Content-Type

- **WHEN** the buffer magic bytes are not PNG
- **AND** the client sent `Content-Type: image/png`
- **THEN** the response is HTTP 400
- **AND** the message is in Spanish stating the file must be a PNG
- **AND** no GCS object and no row are created

#### Scenario: Opaque PNG rejected

- **WHEN** the buffer is a PNG without an alpha channel or `tRNS`
- **THEN** the response is HTTP 400
- **AND** the Spanish message states the PNG must have a transparent background

#### Scenario: File larger than 500 KB rejected

- **WHEN** the uploaded file exceeds 500 KB
- **THEN** the response is HTTP 400
- **AND** the Spanish message states the 500 KB limit

#### Scenario: Unauthorized upload

- **WHEN** a user without `can('update', 'Company')` posts a signature
- **THEN** the response status is **403**
- **AND** hiding the control in the UI is not sufficient authorization

### Requirement: Delete legal representative signature

The backend SHALL expose `DELETE /api/companies/:id/legal-rep-signatures/:repIndex` protected by `authorize('update', 'Company')`. It SHALL delete the GCS object (ignore not found) and the `legal_rep_signature` row. If no row exists, it SHALL return HTTP 404 with a Spanish message.

#### Scenario: Delete existing signature

- **WHEN** an authorized user deletes `repIndex` 1 for a company that has a row
- **THEN** the row is removed
- **AND** `gcsService.deleteFile` is invoked with that `gcs_path`

#### Scenario: Unauthorized delete

- **WHEN** a user without `can('update', 'Company')` deletes a signature
- **THEN** the response status is **403**

### Requirement: Company detail returns signed URLs not GCS paths

`GET /api/companies/:id` SHALL include `legal_rep_signatures` as an array of `{ rep_index, url }` for representatives that have a stored image. Each `url` SHALL be a GCS V4 signed read URL expiring in 60 minutes. The payload SHALL NOT contain `gcs_path` for these objects.

#### Scenario: Detail with one signature

- **WHEN** company C has a row for `rep_index` 1 and none for 2
- **AND** an authorized reader fetches `GET /api/companies/:id`
- **THEN** `legal_rep_signatures` has one item with `rep_index` 1 and an `https` `url`
- **AND** no `gcs_path` field appears for the signature

#### Scenario: Detail with no signatures

- **WHEN** company C has no `legal_rep_signature` rows
- **THEN** `legal_rep_signatures` is an empty array

### Requirement: Company form uploads a transparent PNG

The company edit form SHALL, next to each legal representative, offer preview, upload/replace, and delete of the PNG when `can('update', 'Company')`. Help text SHALL state that the file must be a PNG with transparent background, maximum 500 KB. The view page MAY show the preview without mutation controls. Buttons SHALL use class `.btn` (danger for delete). Controls SHALL stack below 900 px width.

#### Scenario: Help text visible on edit

- **WHEN** a user who can update Company opens the company edit form
- **THEN** they see the transparent PNG and 500 KB instruction next to each representative

#### Scenario: Read-only user cannot upload

- **WHEN** a user who can read but not update Company opens the company view
- **THEN** mutation controls are not shown
- **AND** a preview is shown if a signed URL is present
