# firme-signing Specification

## Purpose
TBD - created by archiving change firme-flujo-a. Update Purpose after archive.
## Requirements
### Requirement: Firme signing tables

Migration `backend/migrations/202610220001_firme_signing.js` SHALL export `up` and `down` and SHALL NOT be executed by this change. `up` SHALL create `firme_signing` and `firme_webhook_event`. Table and column names SHALL be English snake_case, with singular table names.

`firme_signing` SHALL have: `id` uuid primary key default `gen_random_uuid()`; `draft_document_id` uuid not null referencing `draft_document(id)`; `attempt` integer not null; `status` text not null constrained to `sending`, `pending_signature`, `signed`, `rejected`, `expired`, `cancelled`, `send_failed`, and `hash_mismatch`; `document_id` uuid not null; `approved_by` uuid referencing `user_profile(id)`; `approved_at` timestamptz not null; `signee_first_name`, `signee_last_name`, `signee_maternal_last_name`, `signee_rut`, and `signee_email` text not null; `stamp_page` integer; `stamp_x` and `stamp_y` numeric(6,5); `stamped_gcs_path` text; `stamped_sha256` text; `stamped_byte_length` integer; `firme_transaction_id`, `firme_document_code`, and `firme_signee_private_code` text; `firme_status` text; `signee_signed_on` timestamptz; `signed_gcs_path` and `evidence_gcs_path` text; `signed_sha256` text; `verified_at` timestamptz; `last_error_code`, `last_error_message`, and `rejection_reason` text; `last_checked_at` timestamptz; `link_renewed_at` timestamptz; `created_at` and `updated_at` timestamptz defaulting to now.

`up` SHALL create a partial unique index on `draft_document_id` where `status` is `sending` or `pending_signature`, an index on `firme_document_code`, an index on `status`, and a unique constraint on `(draft_document_id, attempt)`.

`firme_webhook_event` SHALL have: `id` uuid primary key; `event_id` text unique and nullable; `sns_message_id` text; `received_at` timestamptz default now; `message_type` text; `body` jsonb; `firme_signing_id` uuid nullable referencing `firme_signing` with `on delete set null`.

`draft_document.status` has no check constraint. `up` SHALL NOT add one. `down` SHALL drop `firme_webhook_event` and then `firme_signing`.

#### Scenario: Migration declares the active-attempt guard

- **WHEN** the migration module is loaded against a schema double
- **THEN** `up` and `down` are functions
- **AND** `up` defines the status check, the partial unique index, and the unique pair `(draft_document_id, attempt)`
- **AND** `up` defines `link_renewed_at`

### Requirement: Stamp box on the last page

`backend/lib/firmeStamp.js` SHALL export `STAMP_X` = 0.335, `STAMP_Y` = 0.80, `STAMP_WIDTH` = 0.33, `STAMP_HEIGHT` = 0.12, and `FIRME_PAGE_BASE` = 1. `stampPositionFor(pageCount)` SHALL return `{ page, x, y }` with `page = pageCount - 1 + FIRME_PAGE_BASE`, `x` = `STAMP_X`, and `y` = `STAMP_Y`. The box SHALL sit in the lower half of the page with at least a 5 percent margin to each edge.

`drawStampBox(pdfDoc)` SHALL draw on the last page, using those constants, a thin gray rectangle labeled «Firma electrónica del proveedor».

#### Scenario: Page base follows the constant

- **WHEN** `stampPositionFor` is called with page count 3
- **THEN** `page` is `3 - 1 + FIRME_PAGE_BASE`
- **AND** `x` and `y` are `STAMP_X` and `STAMP_Y`

#### Scenario: The box stays inside the page margins

- **WHEN** the stamp constants are checked against a page
- **THEN** `STAMP_X` and `STAMP_Y` are at least 0.05
- **AND** `STAMP_X + STAMP_WIDTH` and `STAMP_Y + STAMP_HEIGHT` are at most 0.95
- **AND** `STAMP_Y` is at least 0.50

#### Scenario: The rectangle is drawn on the last page

- **WHEN** `drawStampBox` is applied to a real pdf-lib document of two pages
- **THEN** the rectangle is on the last page
- **AND** its position and size match `STAMP_X`, `STAMP_Y`, `STAMP_WIDTH`, and `STAMP_HEIGHT`

### Requirement: Stamped PDF has no rubric fallback

`buildStampedPdf({ draft, company, signer, template })` SHALL return `{ buffer, sha256, byteLength, stamp }`. It SHALL read the original draft PDF, compute `draft_sha256`, re-render `content_snapshot` with the company `legal_rep_signature` images for `signatureBlock` nodes whose `party` is `company`, append the constancia with `appendSignaturePage`, and draw the stamp box. `sha256` and `byteLength` SHALL describe `buffer` exactly as it will be sent to Firme. No later step SHALL rewrite or recompress that PDF.

If `content_snapshot` is missing, a company representative named by a `signatureBlock` has no rubric, or the re-render fails, the function SHALL fail with `RUBRICA_NO_DISPONIBLE` and message «La empresa no tiene registrada la rúbrica del representante; no se puede enviar a firma.» and SHALL NOT produce a PDF. It SHALL NOT use the unsigned fallback of `signContract`.

#### Scenario: Missing rubric does not produce a PDF

- **WHEN** the snapshot names a company representative and that rubric is missing
- **THEN** the result is `RUBRICA_NO_DISPONIBLE`
- **AND** no buffer is returned

### Requirement: Signing mode

`createFirmeSigningService({ db, storageService, emailService, firmeClient, now, logger } = {})` SHALL use the real dependencies, including `createFirmeClient()`, when an argument is omitted. It SHALL return `getSigningMode`, `sendToFirme`, `refresh`, `listInSignature`, `handleWebhook`, `resendLink`, and `sweepPending`.

`getSigningMode(draftDocumentId)` SHALL return `blocked` when `config.ENVIRONMENT` is `prod` and `isFirmeConfigured()` is false, for every supplier. It SHALL return `firme` when Firme is configured and the supplier subtype (natural person or company) has `document_type_code` `RUT`. It SHALL return `internal` in every other case.

#### Scenario: Production without Firme is blocked

- **WHEN** `ENVIRONMENT` is `prod`, Firme is not configured, and the supplier has no Chilean RUT
- **THEN** `getSigningMode` returns `blocked`

#### Scenario: Other environments without Firme stay internal

- **WHEN** `ENVIRONMENT` is not `prod` and Firme is not configured
- **THEN** `getSigningMode` returns `internal`

#### Scenario: Chilean RUT with Firme uses Firme

- **WHEN** Firme is configured and the supplier `document_type_code` is `RUT`
- **THEN** `getSigningMode` returns `firme`

#### Scenario: Non-Chilean document stays internal

- **WHEN** Firme is configured and the supplier document type is not `RUT`
- **THEN** `getSigningMode` returns `internal`

### Requirement: Send a contract to Firme

`sendToFirme({ draftDocumentId, signee, approvedByUserProfileId })` SHALL accept `signee` as `{ firstName, lastName, maternalLastName, documentNumber, email }` and SHALL run the following steps in order.

Validation SHALL NOT write. A missing draft is 404 `NOT_FOUND`. A mode other than `firme` is 409 `NO_APLICA_FIRME`, except `blocked`, which is 409 `FIRMA_BLOQUEADA` with message «La firma está deshabilitada en producción hasta que se configure Firme.». The draft status SHALL be `draft`, or `in_signature` with no active attempt; otherwise 409 `INVALID_STATUS`. `documentNumber` SHALL pass `parseRut` from `backend/utils/rut.js` or the call returns 422 `RUT_INVALIDO` with message «El RUT del firmante no es válido.». Empty `firstName`, empty `lastName`, empty `email`, or an email that is not one `@` with a non-empty local part, a domain containing a dot, and no spaces, SHALL return 422 `FIRMANTE_INCOMPLETO` and the Spanish message SHALL name the field (nombres, apellido paterno, or correo). An empty `maternalLastName` SHALL be sent as `MATERNAL_PLACEHOLDER`, which is `'.'`.

The service SHALL then recover a `sending` attempt older than 10 minutes. If it has `firme_document_code` and Firme reports `PENDING_SIGNATURE` or a later status, the attempt SHALL be adopted as `pending_signature` and `sendForSignature` SHALL NOT be called. If Firme reports `DRAFT`, the service SHALL call `deleteDocument` and set the attempt to `send_failed` with code `ENVIO_INTERRUMPIDO`. If it has no document code, the attempt SHALL become `send_failed` without calling Firme.

The service SHALL insert a `firme_signing` row in `sending` with `attempt` equal to the previous maximum plus 1, a new `document_id`, and the signee data. A partial unique violation SHALL return 409 `ENVIO_EN_CURSO` with message «Este contrato ya tiene un envío a firma en curso.».

`getQuota()` SHALL run next. When `simple` is less than 1, the attempt SHALL become `send_failed` with `FIRME_NO_CREDITS` and the client message, and nothing SHALL be created in Firme.

The service SHALL stamp the PDF and store it with `uploadBuffer` at `contratos-en-firma/{companyId}/{supplierId}/{templateCode}/{yyyy}/{mm}/{intentoId}_estampado.pdf`, using `yearMonthInSantiago` and `sanitizeFilePart`. That prefix SHALL NOT start with `contratos-firmados/`. The attempt SHALL store the path, `sha256`, `byteLength`, and stamp position.

`sendForSignature` SHALL be called with that same buffer, `name` = `Contrato Incrementa — {plantilla} — {proveedor}` clipped to 120 characters, one signee whose `maternalLastName` is `'.'` when the input was empty, and `signature` from the stamp position. `onProgress` SHALL persist `firme_transaction_id`, `firme_document_code`, and `firme_signee_private_code` as soon as they exist and before `complete`. If the client throws, the service SHALL also persist `error.progress`. A 422 on step `signees` whose detail contains «RUT ingresado no es válido» SHALL set the attempt to `send_failed` with code `RUT_INVALIDO` and message «Firme no aceptó el RUT del firmante.» and SHALL `deleteDocument` when the document is still `DRAFT`.

On success the attempt SHALL become `pending_signature` and `draft_document.status` SHALL become `in_signature` in one transaction. The return SHALL be `{ ok: true, status: 202, data: { signingId, status: 'pending_signature' } }`.

A `FirmeClientError` SHALL set the attempt to `send_failed` with the error code and Spanish message. If `firme_document_code` is present, the service SHALL try `deleteDocument`; a cleanup failure SHALL be logged and SHALL NOT change the result. The response SHALL be `{ ok: false, status, code, message }`. `FIRME_NO_CREDITS` SHALL use HTTP 402. `FIRME_AUTH_FAILED` and `FIRME_NOT_CONFIGURED` SHALL use HTTP 502. Every other Firme error SHALL use HTTP 502. The draft status SHALL stay as it was.

Logs SHALL use the existing service pattern and SHALL NOT include signee data, tokens, or PDF bytes.

#### Scenario: Happy path stores the exact PDF

- **WHEN** a valid Chilean draft is sent with an empty maternal surname
- **THEN** the call order is validate, reserve, quota, stamp and store, send, then `pending_signature`
- **AND** the PDF given to Firme is byte-for-byte the object stored under `contratos-en-firma/`
- **AND** the stored SHA-256 and byte length match that buffer
- **AND** the signee maternal surname sent to Firme is `.`
- **AND** the draft status becomes `in_signature`

#### Scenario: Invalid RUT does not call Firme

- **WHEN** `documentNumber` fails `parseRut`
- **THEN** the response is 422 `RUT_INVALIDO`
- **AND** Firme is not called and nothing is written

#### Scenario: Incomplete signee names the field

- **WHEN** the email is empty or is not a single `@` address
- **THEN** the response is 422 `FIRMANTE_INCOMPLETO`
- **AND** the message names the correo field

#### Scenario: No credits fails before creating a document

- **WHEN** `getQuota` returns `simple` 0
- **THEN** the attempt is `send_failed` with `FIRME_NO_CREDITS`
- **AND** `sendForSignature` is not called

#### Scenario: Credits exhausted at complete delete the draft document

- **WHEN** `complete` fails with `FIRME_NO_CREDITS`
- **THEN** the attempt is `send_failed`
- **AND** `deleteDocument` is called with the stored document code
- **AND** the draft status is unchanged

#### Scenario: A mid-send failure keeps the created ids

- **WHEN** `sendForSignature` throws with `progress` containing a transaction id and a document code
- **THEN** those ids are stored on the attempt

#### Scenario: Ids are stored before complete

- **WHEN** `sendForSignature` calls `onProgress` and then fails on `complete`
- **THEN** the attempt already has the transaction id and the document code

#### Scenario: A second active send is rejected

- **WHEN** a send hits the partial unique index
- **THEN** the response is 409 `ENVIO_EN_CURSO`

#### Scenario: A hung sending attempt is adopted

- **WHEN** a `sending` attempt older than 10 minutes has a document code and Firme reports `PENDING_SIGNATURE`
- **THEN** the attempt becomes `pending_signature`
- **AND** `sendForSignature` is not called

#### Scenario: A hung draft document is deleted

- **WHEN** a `sending` attempt older than 10 minutes has a document code and Firme reports `DRAFT`
- **THEN** `deleteDocument` is called
- **AND** the attempt becomes `send_failed` with `ENVIO_INTERRUMPIDO`

#### Scenario: A hung attempt without a code does not call Firme

- **WHEN** a `sending` attempt older than 10 minutes has no document code
- **THEN** it becomes `send_failed`
- **AND** Firme is not called

#### Scenario: Missing rubric sends nothing

- **WHEN** the stamp step fails with `RUBRICA_NO_DISPONIBLE`
- **THEN** the response is HTTP 422
- **AND** `sendForSignature` is not called

#### Scenario: A rejected attempt can be sent again

- **WHEN** the latest attempt is `rejected` and there is no active attempt
- **THEN** the new attempt number is 2

#### Scenario: A non-Chilean supplier does not use Firme

- **WHEN** the supplier document type is `RFC`
- **THEN** the response is 409 `NO_APLICA_FIRME`

### Requirement: Refresh and finalize a signing attempt

`refresh(signingId)` SHALL call Firme only for an attempt in `pending_signature`. Any other status SHALL be returned unchanged and Firme SHALL NOT be called. Inside a transaction the attempt SHALL be loaded with `forUpdate().skipLocked()`. If the lock is not acquired, `refresh` SHALL return the current state.

`PENDING_SIGNATURE` or another waiting status SHALL update `firme_status` and `last_checked_at`. The attempt SHALL become `expired` when the signee `approvedUntil` is in the past, or, when `approvedUntil` is absent, when more than 10 days have passed since `link_renewed_at` if that is later than `approved_at`, otherwise since `approved_at`. `SIGNED` or `COMPLETED` SHALL run `finalize`. `REJECTED` SHALL set the attempt to `rejected` and store the signee `rejectionDetail` in `rejection_reason`, or the event reason when the detail is missing. `CANCELLED` or `REFUNDED` SHALL set the attempt to `cancelled`. After `rejected`, `expired`, or `cancelled`, the draft SHALL stay `in_signature`. A network or Firme error SHALL store `last_error_code` and `last_error_message` and SHALL NOT change `status`.

`finalize` SHALL be idempotent. It SHALL download the signed PDF with `downloadSignedPdf` and SHALL NOT persist any URL. `sha256` of `signed.subarray(0, stamped_byte_length)` SHALL equal `stamped_sha256`, `signed.length` SHALL be greater than `stamped_byte_length`, and the signed bytes SHALL contain `/ByteRange`. On failure the received PDF SHALL be stored at `contratos-en-firma/.../{intentoId}_recibido.pdf`, the attempt SHALL become `hash_mismatch` with `last_error_code` `HASH_NO_COINCIDE`, and no `document` row SHALL be created. The draft status SHALL stay unchanged. The log SHALL NOT contain PDF bytes.

On success the service SHALL call `collectEvidence(code, [privateCode])`. It SHALL store the signed PDF with `buildSignedGcsPath` using the reserved `document_id`, the evidence JSON at `{document_id}_evidencia.json` (`logs`, `events`, `firmeDocumentCode`, `signedOn`, `verifiedAt`), and each certificate at `{document_id}_correo_{n}.pdf`. Those writes SHALL use `uploadBufferOnce`. In one transaction it SHALL insert `document` with `id` equal to the reserved `document_id`, the draft, supplier, company, template, and client ids, `contract_overrides`, `gcs_path`, `file_name` `{document_id}_firmado.pdf`, `source` `generated`, `signed_at` from Firme, `signed_by` the signee full name, `uploaded_by` `approved_by`, `draft_sha256` of the original draft PDF, and `signed_sha256` of the signed PDF. An existing `document` with that id SHALL NOT be inserted again. The attempt SHALL become `signed` with `verified_at`, `signed_gcs_path`, `evidence_gcs_path`, and `signed_sha256`. The draft status SHALL become `signed`. After the transaction the service SHALL call `sendSignedContractEmail` to `company.email` with the signed PDF. An email error or `{ ok: true, skipped: true }` SHALL be logged and SHALL NOT change the stored state. A failure between storage and the transaction SHALL be completed by the next `refresh` without a second `document` row.

#### Scenario: Rejected, cancelled, and expired map from Firme

- **WHEN** `getDocument` reports `REJECTED`, `CANCELLED`, or a pending document whose `approved_at` is older than 10 days
- **THEN** the attempt becomes `rejected`, `cancelled`, or `expired` respectively
- **AND** `REJECTED` stores `rejectionDetail` in `rejection_reason`
- **AND** the draft stays `in_signature`

#### Scenario: Renewal date replaces the approval date

- **WHEN** `link_renewed_at` is later than `approved_at` and fewer than 10 days have passed since `link_renewed_at`
- **THEN** a still-pending document does not become `expired`

#### Scenario: A network error keeps the status

- **WHEN** `getDocument` throws a network error
- **THEN** the attempt status is unchanged
- **AND** `last_error_code` is stored

#### Scenario: A locked attempt is skipped

- **WHEN** `forUpdate().skipLocked()` returns no row
- **THEN** `refresh` does not call Firme
- **AND** it returns the current state

#### Scenario: A valid signed PDF is stored once

- **WHEN** the signed PDF is the stamped bytes plus an incremental update that contains `/ByteRange`
- **THEN** the PDF is written under `contratos-firmados/` with the reserved `document_id`
- **AND** the evidence is stored beside it
- **AND** a `document` row is created, the attempt becomes `signed`, and the draft becomes `signed`
- **AND** `signed_sha256` is the hash of the signed PDF and `draft_sha256` is the hash of the original
- **AND** no download URL is stored

#### Scenario: A different prefix is a hash mismatch

- **WHEN** the signed PDF does not start with the stamped bytes
- **THEN** the attempt becomes `hash_mismatch`
- **AND** the received PDF is stored under `contratos-en-firma/`
- **AND** no `document` row is created

#### Scenario: Missing ByteRange is a hash mismatch

- **WHEN** the signed PDF matches the stamped prefix and length but does not contain `/ByteRange`
- **THEN** the attempt becomes `hash_mismatch`
- **AND** no `document` row is created

#### Scenario: The same blob hash does not duplicate the document

- **WHEN** `uploadBufferOnce` finds the same hash already stored
- **THEN** finalize completes
- **AND** it does not insert a second `document` row

#### Scenario: A different blob hash conflicts

- **WHEN** `uploadBufferOnce` finds a different hash at the reserved path
- **THEN** the error code is `STORAGE_CONFLICT`

#### Scenario: A failed registration resumes

- **WHEN** the signed PDF and evidence were stored and the `document` insert did not commit
- **THEN** the next `refresh` creates the `document` and marks the draft `signed`
- **AND** it does not write a second blob with different bytes

#### Scenario: Email failure does not roll back the signature

- **WHEN** the email send throws or returns `skipped`
- **THEN** the attempt stays `signed`
- **AND** the signed PDF was the email attachment when the send was attempted

### Requirement: SNS webhook

`backend/lib/snsVerify.js` SHALL export `verifySnsMessage(message, { fetchImpl })` returning `{ ok: true }` or `{ ok: false, reason }` and SHALL use only Node `crypto`. `SigningCertURL` SHALL be `https` with host matching `^sns\.[a-z0-9-]+\.amazonaws\.com$` and a path ending in `.pem`. The certificate SHALL be fetched with `fetchImpl`, cached in memory by URL, and used to verify the base64 `Signature`. `SignatureVersion` `'1'` SHALL use RSA-SHA1 and `'2'` SHALL use RSA-SHA256. Any other version SHALL be invalid. The signed string SHALL be the official `Key\nValue\n` pairs: for `Notification`, `Message`, `MessageId`, `Subject` only when present, `Timestamp`, `TopicArn`, and `Type`; for `SubscriptionConfirmation` and `UnsubscribeConfirmation`, `Message`, `MessageId`, `SubscribeURL`, `Timestamp`, `Token`, `TopicArn`, and `Type`.

`handleWebhook({ rawBody, headers })` SHALL validate the SNS signature first. An invalid or unverifiable message SHALL be logged with the reason and SHALL NOT be processed further. The function SHALL always return `{ ok: true }`.

A valid `SubscriptionConfirmation` SHALL `GET` `SubscribeURL` only when its protocol is `https` and its host matches `^sns\.[a-z0-9-]+\.amazonaws\.com$`. Otherwise it SHALL be ignored and logged. A valid `Notification` SHALL parse `Message` as JSON. The document code SHALL be taken from `data.document_code`, then from `resource_id`, then from any UUID in the message that matches a `pending_signature` `firme_document_code`. The handler SHALL NOT filter on `signature_method`. It SHALL `refresh` the matching attempt. The only other event fields used SHALL be a rejection reason in `reason`, `motivo`, or `rejectionReason`, including under `data`, stored in `rejection_reason`. `UnsubscribeConfirmation` and any other type SHALL only be recorded.

Every message SHALL be inserted into `firme_webhook_event` with `INSERT … ON CONFLICT (event_id) DO NOTHING`. A null `event_id` SHALL always insert. `body` SHALL be the parsed JSON, or `{ raw: <text> }` when the body is not valid JSON. When the event was already stored, `refresh` SHALL still run. `handleWebhook` SHALL NOT throw.

`POST /api/webhooks/firme` SHALL be registered before `requireAuth`, SHALL read the body with `express.text({ type: '*/*', limit: '256kb' })`, SHALL NOT require authentication, and SHALL respond HTTP 200 `{ ok: true }` even when the service throws.

#### Scenario: Version 1 and version 2 signatures are valid

- **WHEN** a `Notification` and a `SubscriptionConfirmation` are signed with RSA-SHA1 and RSA-SHA256 using a certificate served by `fetchImpl`
- **THEN** `verifySnsMessage` returns `{ ok: true }` for each
- **AND** the certificate URL is fetched once

#### Scenario: Tampered messages and foreign certificates are invalid

- **WHEN** a signed field changes, `SignatureVersion` is unknown, or `SigningCertURL` is not `https`, is not an SNS host, or does not end in `.pem`
- **THEN** `verifySnsMessage` returns `{ ok: false }`

#### Scenario: Confirmation fetches only an SNS URL

- **WHEN** a valid `SubscriptionConfirmation` has an `https` SNS `SubscribeURL`
- **THEN** the handler performs that `GET`
- **WHEN** the host is foreign, the protocol is `http`, or the signature is invalid
- **THEN** the handler does not perform that `GET`

#### Scenario: An invalid notification does not refresh

- **WHEN** a `Notification` signature is invalid
- **THEN** `refresh` is not called
- **AND** the handler still returns `{ ok: true }`

#### Scenario: The same event id is stored once

- **WHEN** the same `event_id` is delivered twice
- **THEN** `firme_webhook_event` contains one row for that id
- **AND** `refresh` may run both times

#### Scenario: Document code is found in each allowed place

- **WHEN** a valid notification carries the code in `data.document_code`, or only in `resource_id`, or only as a loose UUID matching a pending attempt
- **THEN** that attempt is refreshed
- **AND** an unknown code is recorded and does not refresh an attempt

#### Scenario: A non-JSON body is stored

- **WHEN** the message body is not JSON
- **THEN** the event row stores `{ raw: <text> }`
- **AND** the handler returns `{ ok: true }`

#### Scenario: The public route accepts text and ignores failures

- **WHEN** `POST /api/webhooks/firme` receives `Content-Type: text/plain` without authentication, and when the service throws
- **THEN** the response is HTTP 200 `{ ok: true }`

### Requirement: Resend the signature link

`resendLink(signingId)` SHALL apply only to `pending_signature` or `expired`. Any other status SHALL return 409 `INVALID_STATUS`. If the draft has another active attempt, the response SHALL be 409 `ENVIO_EN_CURSO`. The service SHALL call `firmeClient.resendInvitation(documentCode, privateCode)` with the stored `firme_signee_private_code`. It SHALL NOT send the link through Incrementa's own channel. A Firme HTTP 422 SHALL return 409 `ENLACE_NO_RENOVABLE` with message «Firme no permite renovar este enlace; use «Reenviar a firma» (usa 1 crédito nuevo).» and SHALL NOT change the attempt. When the attempt was `expired` and the resend succeeds, it SHALL return to `pending_signature` and set `link_renewed_at`. Other Firme errors SHALL use the same Spanish mapping as `sendToFirme`.

#### Scenario: Pending and expired attempts resend without a new credit

- **WHEN** `resendLink` succeeds for `pending_signature` or `expired`
- **THEN** `resendInvitation` is called with the stored private code
- **AND** an `expired` attempt returns to `pending_signature` with `link_renewed_at` set

#### Scenario: Another status cannot resend

- **WHEN** `resendLink` is called for an attempt that is not `pending_signature` or `expired`
- **THEN** the response is 409 `INVALID_STATUS`

#### Scenario: Firme 422 does not change the attempt

- **WHEN** `resendInvitation` fails with HTTP 422
- **THEN** the response is 409 `ENLACE_NO_RENOVABLE`
- **AND** the attempt status is unchanged

### Requirement: External sweep and webhook operations

`sweepPending()` SHALL `refresh` `pending_signature` attempts whose `last_checked_at` is null or older than 10 minutes, at most 20 per run, one at a time, skipping attempts locked by another process. It SHALL also recover hung `sending` attempts. It SHALL return `{ revisados, finalizados, rechazados, vencidos, saltados, errores }`. The backend process SHALL NOT run this on a timer.

`backend/scripts/firme-barrido.js` SHALL be runnable as `node scripts/firme-barrido.js`. When Firme is not configured it SHALL print `{ "ok": true, "omitido": "Firme no está configurado" }` and exit 0. Otherwise it SHALL run `sweepPending()`, print the summary as one JSON line without signee data or tokens, and exit 0. A database or service error SHALL exit 1 and print the error code. The script SHALL close the Knex connection before exiting.

`backend/scripts/firme-webhook.js` SHALL offer `registrar <url>`, `listar`, `borrar <id>`, and `estado <id>` using `FIRME_*` from the environment. `registrar` SHALL list subscriptions, delete one with the same URL and a different configuration, then create the subscription with event types `document.signed`, `document.status_changed`, `signature.signed`, and `signature.rejected`. It SHALL poll `estado` until `isConfirmed` is true, at most 10 times with 3 seconds between attempts, or report that confirmation is still missing. It SHALL print only the id and the status. An HTTP 403 SHALL say that a company administrator token is required. Neither script SHALL run at application startup or inside the test suite except when a test invokes it with doubles.

#### Scenario: Sweep covers only stale pending attempts

- **WHEN** `sweepPending` runs with more than 20 stale pending attempts and some locked rows
- **THEN** it refreshes at most 20 unlocked stale attempts
- **AND** the summary counts reviewed, finished, rejected, expired, skipped, and errors

#### Scenario: The sweep script skips an unconfigured Firme

- **WHEN** `firme-barrido.js` runs and Firme is not configured
- **THEN** it prints the `omitido` JSON and exits 0

#### Scenario: The sweep script prints one summary line

- **WHEN** `firme-barrido.js` runs with Firme configured
- **THEN** it calls `sweepPending`, prints one JSON line without signee data, exits 0, and closes Knex

#### Scenario: The sweep script exits 1 on failure

- **WHEN** `sweepPending` throws
- **THEN** the process exits 1 and prints the error code

#### Scenario: Register replaces a different subscription for the same URL

- **WHEN** `registrar` finds the same URL with a different configuration
- **THEN** it deletes that subscription before creating the new one
- **AND** it polls until `isConfirmed` is true
- **AND** the output does not contain the token

#### Scenario: A webhook 403 names the administrator token

- **WHEN** Firme responds HTTP 403 to `registrar`
- **THEN** the message says a company administrator token is required

### Requirement: In-signature list and HTTP routes

`listInSignature()` SHALL return the latest attempt of each draft whose status is `in_signature`, with supplier, signee, `status`, `last_error_code`, `last_error_message`, `rejection_reason`, `approved_at`, `attempt`, and `id`. It SHALL NOT return `firme_transaction_id`, `firme_document_code`, `firme_signee_private_code`, or other internal Firme identifiers.

`createApp({ firmeSigningService } = {})` SHALL default `firmeSigningService` to `null`. `backend/index.js` SHALL create the real service and pass it. With `null`, each pending item's `signing_mode` SHALL be `internal`, the sign guard SHALL NOT run, new Firme routes SHALL respond 503 `FIRME_NO_DISPONIBLE`, and the webhook SHALL respond 200 without doing work.

The following routes SHALL require `authorize('sign', 'Contract')`. `GET /api/contracts/in-signature` SHALL be registered before any `/api/contracts/:id` route. It SHALL `refresh` in parallel, at most 5, each `pending_signature` attempt whose `last_checked_at` is older than 1 minute, ignore refresh errors, then return `listInSignature` plus `meta.credits` from `getQuota().simple`, omitting `credits` when Firme does not answer. `POST /api/contracts/:id/send-to-firme` SHALL read `{ signee }`, resolve the profile the way `postSign` does, call `sendToFirme`, and return HTTP 202 on success. `POST /api/contracts/:id/refresh-signature` SHALL refresh the active attempt. `POST /api/contracts/:id/resend-link` SHALL call `resendLink` for the latest `pending_signature` or `expired` attempt. Error responses SHALL keep the service code and HTTP status. No new permission SHALL be created.

#### Scenario: Send route returns 202 and preserves service errors

- **WHEN** an authorized user posts `send-to-firme` and the service returns 202
- **THEN** the HTTP status is 202
- **WHEN** the service returns a coded error
- **THEN** the HTTP status and code are those of the service
- **WHEN** the user lacks `sign` on `Contract`
- **THEN** the response is 403

#### Scenario: In-signature route returns credits

- **WHEN** an authorized user gets `in-signature` and `getQuota` returns `simple`
- **THEN** the body includes the attempts and `meta.credits`
- **AND** pending attempts checked more than a minute ago are refreshed, at most five at a time

#### Scenario: Missing service makes new routes unavailable

- **WHEN** `createApp` is called without `firmeSigningService`
- **THEN** `send-to-firme`, `in-signature`, `refresh-signature`, and `resend-link` respond 503 `FIRME_NO_DISPONIBLE`
- **AND** the webhook responds 200

### Requirement: Write a blob only once

`storageService.uploadBufferOnce({ buffer, gcsPath, contentType })` SHALL write the blob without overwrite using `ifNoneMatch: '*'`. When the blob already exists and its SHA-256 equals the buffer, the function SHALL return `{ created: false }`. When the existing hash differs, it SHALL throw an error with `code` `STORAGE_CONFLICT`. Existing `uploadBuffer`, `downloadBuffer`, `deleteFile`, `getSignedUrl`, and `containerFor` SHALL keep their current behavior. Blobs under the `firmados` container written by this flow SHALL use only `uploadBufferOnce`.

#### Scenario: First write creates the blob

- **WHEN** `uploadBufferOnce` writes a path that does not exist
- **THEN** the blob is created with `ifNoneMatch: '*'`
- **AND** the result reports that it was created

#### Scenario: The same hash is not an error

- **WHEN** the path exists and the stored bytes have the same SHA-256
- **THEN** the function returns `{ created: false }`

#### Scenario: A different hash conflicts

- **WHEN** the path exists and the stored bytes have a different SHA-256
- **THEN** the error code is `STORAGE_CONFLICT`

### Requirement: Signing page API client

`frontend/src/api/contractSigningApi.js` SHALL add `sendToFirme`, `fetchInSignature`, and `refreshSignature`, and a call for `resend-link`, using the authenticated API client. User-facing errors SHALL stay in Spanish.

#### Scenario: Send calls the Firme endpoint

- **WHEN** the page approves a Firme contract
- **THEN** `sendToFirme` posts `{ signee }` to `/api/contracts/:id/send-to-firme`

