## ADDED Requirements

### Requirement: Constancia names platform user and company only

The page appended after the contract body SHALL be titled `CONSTANCIA DE FIRMA ELECTRÓNICA SIMPLE`, cite Ley N° 19.799, and name only the platform user (`user_profile.full_name`) and the company (`business_name`, formatted Chilean RUT, optional `short_name`). Timestamp SHALL use timezone `America/Santiago` and locale `es-CL`.

The constancia SHALL NOT state or imply that the supplier or “the parties” signed. Forbidden phrasing includes «firmado por las partes», «ambas partes», and «el proveedor firmó».

When at least one company representative PNG was stamped into the re-rendered body, the constancia SHALL declare that the reproduced rubric is an image registered by the company in the system and is not an electronic-signature event of the legal representative.

When no image was stamped, the constancia SHALL state that a registered company rubric could not be reproduced on the contract body. When the body was not re-rendered, it SHALL additionally state that the body was not re-rendered.

The constancia SHALL print `document.draft_sha256` labeled as hash of the reviewed draft and `document.signed_sha256` labeled as hash of the re-rendered body without this constancia page.

#### Scenario: Stamped image wording

- **WHEN** sign re-renders and embeds at least one company PNG
- **THEN** the extracted text of the last PDF page contains «imagen registrada»
- **AND** it contains the platform user's name and the company name
- **AND** it does not contain «firmado por las partes» or «el proveedor firmó»

#### Scenario: Legacy draft wording

- **WHEN** the draft has `content_snapshot` NULL
- **THEN** the constancia states that the body was not re-rendered
- **AND** it states that a registered rubric could not be reproduced
- **AND** it still names only the platform user and the company

### Requirement: Signing degrades when rubric or snapshot is missing

`signContract` SHALL NOT fail with 5xx or 4xx because `content_snapshot` is null, because the company has no `legal_rep_signature` row, or because downloading a signature PNG from GCS throws. Those three cases SHALL be logged and the operation SHALL continue (legacy append on the original PDF, or re-render without that image).

Sign MAY still fail when the draft is missing, already `signed`/`rejected`, or the **draft PDF** cannot be downloaded from GCS.

#### Scenario: Null snapshot still signs

- **WHEN** a pending draft has `content_snapshot` NULL
- **AND** the draft PDF exists in GCS
- **THEN** `signContract` returns success
- **AND** the signed PDF is the original bytes plus the constancia page
- **AND** no re-render is attempted

#### Scenario: Missing registered image still signs

- **WHEN** a pending draft has a snapshot
- **AND** the company has no `legal_rep_signature` for the indices in that snapshot
- **THEN** `signContract` returns success
- **AND** the body is re-rendered without an image slot
- **AND** the constancia states the rubric could not be reproduced

#### Scenario: GCS signature download failure still signs

- **WHEN** downloading `legal_rep_signature.gcs_path` throws
- **THEN** the error is logged
- **AND** `signContract` returns success without that image
- **AND** the constancia states the rubric could not be reproduced

### Requirement: document stores draft and signed body hashes

On successful sign, INSERT into `document` SHALL persist `draft_sha256` (SHA-256 hex of the draft PDF bytes) and `signed_sha256` (SHA-256 hex of the re-rendered body **before** appending the constancia). When there is no re-render, `signed_sha256` SHALL equal `draft_sha256`. Columns SHALL be TEXT nullable for rows created before this change.

#### Scenario: Re-render writes two distinct hashes

- **WHEN** sign re-renders from a snapshot
- **THEN** `document.draft_sha256` equals the SHA-256 of the draft PDF
- **AND** `document.signed_sha256` equals the SHA-256 of the re-rendered body without the constancia
- **AND** those two values are printed on the constancia

#### Scenario: Legacy path copies draft hash

- **WHEN** sign takes the null-snapshot path
- **THEN** `document.draft_sha256` equals `document.signed_sha256`
- **AND** both equal the SHA-256 of the original draft PDF

## MODIFIED Requirements

### Requirement: Sign contract service orchestration

`contractSigningService.signContract({ db, gcsService, emailService, draftDocumentId, signerUserProfileId })` SHALL:

1. Load and validate the draft (exists, status not `signed`/`rejected`).
2. Load signer `user_profile.full_name`, company, template, and supplier name.
3. Download original PDF from GCS via `gcsService.downloadBuffer`. Compute `draft_sha256` as SHA-256 of that buffer.
4. If `draft.content_snapshot` is a Tiptap doc: download any `legal_rep_signature` PNGs for that company (log and omit on failure); re-render the snapshot via `buildPdfBytesFromTipTapWithReactPdf` passing downloaded buffers only (log and fall back to the original PDF if render throws); set `signed_sha256` to SHA-256 of the re-rendered body. If snapshot is null or render fell back: do not re-render; set `signed_sha256` equal to `draft_sha256`.
5. Append a constancia page with pdf-lib (title `CONSTANCIA DE FIRMA ELECTRÓNICA SIMPLE`, Ley 19.799, platform user, company, Santiago timestamp, both hashes, stamp/legacy wording per the constancia requirement). The supplier SHALL NOT be described as a signer. Image stamping SHALL NOT use pdf-lib coordinates.
6. Upload signed PDF (body + constancia) to GCS path `contratos-firmados/{company_id}/{supplier_id}/{template_code}/{year}/{month}/{docId}_firmado.pdf` using `yearMonthInSantiago()`.
7. Within a database transaction: INSERT into `document` (with `draft_document_id`, `supplier_id`, `company_id`, `template_id`, `client_id`, `contract_overrides`, `gcs_path`, `file_name`, `source: 'generated'`, `signed_at`, `signed_by`, `uploaded_by`, `draft_sha256`, `signed_sha256`) and UPDATE `draft_document SET status = 'signed'`.
8. After commit, call `emailService.sendSignedContractEmail` to `company.email` with the signed PDF buffer.
9. If email fails, log the error and still return success for the signing operation.

The original draft row and its GCS object SHALL NOT be deleted or modified except for `status`. Generate-time PDFs SHALL remain without company rubric images.

#### Scenario: Signed PDF stored separately

- **WHEN** sign completes successfully
- **THEN** the original GCS path at `draft.gcs_path` remains unchanged
- **AND** a new object exists at the `contratos-firmados/...` path

#### Scenario: Draft status updated not deleted

- **WHEN** sign completes successfully
- **THEN** the `draft_document` row still exists with `status` equal to `'signed'`

#### Scenario: Email failure does not rollback

- **WHEN** sign and DB commit succeed but `sendSignedContractEmail` throws
- **THEN** the error is logged
- **AND** the API still returns `ok: true` with document metadata

#### Scenario: Snapshot re-render stamps company image only

- **WHEN** the draft has a `content_snapshot` containing company and supplier `signatureBlock`s
- **AND** a PNG exists for company `rep_index` 1
- **THEN** the signed body PDF shows that image on the company block
- **AND** the supplier block has an empty signature line
