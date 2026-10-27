# contract-signing Specification

## Purpose
TBD - created by archiving change firma-documento. Update Purpose after archive.
## Requirements
### Requirement: Pending signature list API

The backend SHALL expose `GET /api/contracts/pending-signature` protected by `authorize('sign', 'Contract')`. Service `contractSigningService.listPendingSignature` SHALL query `draft_document` joined with `supplier`, `supplier_persona_natural`, `supplier_empresa`, `client`, `template`, and `company`, filtering rows where `draft_document.status` is NOT `'signed'`, NOT `'rejected'`, and NOT `'in_signature'`, ordered by `created_at DESC`. The query chain SHALL use only `join`, `leftJoin`, `whereNotIn`, `select`, and `orderBy`. New columns MAY be added to `select`. No other query method SHALL be added.

Each returned item SHALL include: `id`, `supplier_name` (COALESCE empresa razon_social, persona natural full_name), `supplier_type`, `client_name` (nullable), `template_name`, `company_name` (`company.business_name`), `company_short_name`, `company_email`, `fecha_contrato` (from `contract_overrides->>'fecha_contrato'`), `created_at`, `file_name`, `gcs_path`, `signing_mode` (`firme`, `internal`, or `blocked`), and `signee_suggestion`.

`signee_suggestion` SHALL be `{ first_names, last_name, maternal_last_name, document_number, email }`. For a natural-person supplier the parts SHALL come from `supplier_persona_natural` (`first_names`, `last_name`, `maternal_last_name`, `document_number`) and `supplier.email`. For a company supplier the parts SHALL come from the legal representative (`rep_first_names`, `rep_last_name`, `rep_maternal_last_name`, `rep_document_number`) and `supplier.email`. A missing part SHALL be an empty string. Those columns SHALL be added to the `listPendingSignature` `select`.

The response SHALL include `meta.email_enabled`, `true` when `RESEND_API_KEY` is set and `false` otherwise. When `createApp` is called without `firmeSigningService`, every item's `signing_mode` SHALL be `internal`.

#### Scenario: List pending contracts

- **WHEN** an authorized user with `can('sign', 'Contract')` calls `GET /api/contracts/pending-signature`
- **THEN** the response is HTTP 200 with `ok: true` and `data.items` containing only drafts that are not signed, not rejected, and not `in_signature`

#### Scenario: Unauthorized list

- **WHEN** a user without `can('sign', 'Contract')` calls `GET /api/contracts/pending-signature`
- **THEN** the response status is **403** with a Spanish message

#### Scenario: Empty pending list

- **WHEN** no draft rows match the pending filter
- **THEN** the response is HTTP 200 with `data.items` as an empty array

#### Scenario: Natural person suggestion uses the supplier parts

- **WHEN** a pending natural-person supplier has `first_names`, `last_name`, `maternal_last_name`, `document_number`, and `supplier.email`
- **THEN** `signee_suggestion` copies those five values

#### Scenario: Company suggestion uses the legal representative

- **WHEN** a pending company supplier has representative name parts and `rep_document_number`
- **THEN** `signee_suggestion` uses the representative parts and `supplier.email`
- **AND** it does not use the company `document_number`

#### Scenario: Missing Firme service reports internal mode

- **WHEN** `GET /api/contracts/pending-signature` runs on an app created without `firmeSigningService`
- **THEN** each item has `signing_mode` `internal`
- **AND** `meta.email_enabled` is present

### Requirement: Contract sign API

The backend SHALL expose `POST /api/contracts/:id/sign` protected by `authorize('sign', 'Contract')`. The controller SHALL resolve `signerUserProfileId` via `getUserProfileIdByUserId(req.auth.userId)`.

When `firmeSigningService` is injected and `getSigningMode(id)` is `firme`, the controller SHALL respond HTTP 409 with code `USE_FIRME_FLOW` and message «Este contrato se firma con Firme: use «Aprobar y enviar a firma».» and SHALL NOT call `signContract`. When the mode is `blocked`, the controller SHALL respond HTTP 409 with code `FIRMA_BLOQUEADA` and message «La firma está deshabilitada en producción hasta que se configure Firme.» and SHALL NOT call `signContract`. When the service is absent, or the mode is `internal`, the controller SHALL call `contractSigningService.signContract` as it does today.

#### Scenario: Successful sign

- **WHEN** an authorized user posts sign for a valid pending draft id and the signing mode is `internal` or no Firme service is injected
- **THEN** the response is HTTP 200 with `ok: true` and `data.documentId` and `data.fileName`

#### Scenario: Sign already signed draft

- **WHEN** sign is requested for a draft with status `'signed'` or `'rejected'` and the mode is not `firme` or `blocked`
- **THEN** the service returns an error with a Spanish message
- **AND** no new document row is created

#### Scenario: Unauthorized sign

- **WHEN** a user without `can('sign', 'Contract')` posts sign
- **THEN** the response status is **403**

#### Scenario: Firme mode refuses the internal sign

- **WHEN** an authorized user posts sign and `getSigningMode` is `firme`
- **THEN** the response is HTTP 409 with code `USE_FIRME_FLOW`
- **AND** `signContract` is not called

#### Scenario: Production without Firme refuses the internal sign

- **WHEN** an authorized user posts sign and `getSigningMode` is `blocked`
- **THEN** the response is HTTP 409 with code `FIRMA_BLOQUEADA`
- **AND** `signContract` is not called

#### Scenario: No Firme service keeps today's sign

- **WHEN** an authorized user posts sign on an app created without `firmeSigningService`
- **THEN** the controller calls `signContract`
- **AND** the response is the service result

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

### Requirement: Contract signing frontend page

The frontend SHALL provide `ContractSigningPage` at route `/app/gestion-contratos/firma-documento` guarded by `RequireCan` with `I="sign"` and `a="Contract"`.

The page SHALL show two tabs above the table: «Por aprobar» and «En firma».

The «Por aprobar» tab SHALL display a table with columns: Proveedor (name + type chip), Cliente, Empresa (`company_short_name`), Plantilla, Fecha contrato, Creado, Acciones (Ver PDF, Firmar).

"Ver PDF" SHALL fetch the draft PDF blob and open it in a new tab (same pattern as Consulta contratos).

When `row.signing_mode` is `internal`, "Firmar" SHALL open the confirmation modal of today, showing supplier, client, template, company, authorization checkbox, and disabled "Firmar y enviar email" until the checkbox is checked. On successful internal sign, the row SHALL be removed from the table and a success toast SHALL display "Contrato firmado. Email enviado a [email]".

When `row.signing_mode` is `firme`, "Firmar" SHALL open a modal with editable signee fields (nombres, apellido paterno, apellido materno, RUT, correo) prefilled from `signee_suggestion`. The RUT field SHALL use `RutInput`. A correction SHALL be sent only for that submission. The modal SHALL show «Al confirmar, usted aprueba este contrato en representación de {empresa}; su rúbrica quedará estampada y se enviará a {correo} para su firma electrónica.», the checkbox «He revisado el contrato y autorizo su envío a firma», and the button «Aprobar y enviar a firma». The button SHALL stay disabled until the checkbox is checked and SHALL show «Enviando…» while the request is in flight. On success the row SHALL leave the list and the page SHALL show «Contrato en proceso de firma.» for 8 seconds. On error the backend message SHALL appear inside the modal.

When `row.signing_mode` is `blocked`, the sign button of that row SHALL be disabled and SHALL show «Firma deshabilitada: Firme aún no está configurado en producción.». "Ver PDF" SHALL stay available.

The «En firma» tab SHALL load `GET /api/contracts/in-signature` when opened. Its table columns SHALL be Proveedor, Firmante, Enviado el, Estado, Acciones. Status chips SHALL be: `pending_signature` «En proceso de firma», `sending` «Enviando a firma…», `rejected` «Firma rechazada», `expired` «Firma vencida», `cancelled` «Firma cancelada», `send_failed` «Envío fallido», `hash_mismatch` «Requiere revisión». Actions SHALL be «Actualizar estado» for every status except `sending`; «Reenviar enlace» only for `pending_signature`; «Renovar enlace» only for `expired`; «Reenviar a firma» only for `rejected`, `cancelled`, and `send_failed`; and «Ver PDF». «Reenviar enlace» and «Renovar enlace» SHALL call `POST /api/contracts/:id/resend-link`. «Reenviar a firma» SHALL open the same Firme modal with the previous signee data and SHALL warn «Esto usará 1 crédito nuevo de firma.». `hash_mismatch` SHALL NOT offer «Reenviar a firma». `last_error_message` SHALL appear under the chip, and `rejection_reason` SHALL appear for `rejected`. Above the table the page SHALL show «Créditos de firma disponibles: N» from `meta.credits`, omitting the line when credits are absent, and a low-balance warning when the balance is 10 or less (`LOW_CREDITS_WARNING = 10`). «Actualizar estado» SHALL call refresh. When that refresh reaches `signed`, the page SHALL show «Contrato firmado.» for 8 seconds and the row SHALL leave «En firma». The word «firmado» SHALL NOT be used for the send-to-Firme success message.

When no pending items exist, the «Por aprobar» tab SHALL show "No hay contratos pendientes de firma."

Icons SHALL be MUI Outlined. Styles SHALL use the existing design-system classes. No new UI library SHALL be added.

#### Scenario: Sign with unchecked authorization

- **WHEN** the internal confirmation modal is open and the checkbox is unchecked
- **THEN** the "Firmar y enviar email" button is disabled

#### Scenario: Sign success removes row

- **WHEN** the user confirms an internal sign and the API returns success
- **THEN** the contract row disappears from the table
- **AND** a success toast is shown with the company email

#### Scenario: Firme submit stays disabled until the checkbox is checked

- **WHEN** the Firme modal is open and the authorization checkbox is unchecked
- **THEN** «Aprobar y enviar a firma» is disabled

#### Scenario: Firme success leaves the approve list

- **WHEN** the user confirms «Aprobar y enviar a firma» and the API returns success
- **THEN** the row leaves «Por aprobar»
- **AND** the page shows «Contrato en proceso de firma.»

#### Scenario: Firme error stays inside the modal

- **WHEN** send-to-firme returns an error message
- **THEN** that message is shown inside the modal
- **AND** the row stays on the list

#### Scenario: Resend to signature is limited to failed outcomes

- **WHEN** the «En firma» tab renders rows in `pending_signature`, `expired`, `rejected`, `cancelled`, `send_failed`, and `hash_mismatch`
- **THEN** «Reenviar a firma» is available only for `rejected`, `cancelled`, and `send_failed`
- **AND** «Renovar enlace» is available only for `expired`
- **AND** «Reenviar enlace» is available only for `pending_signature`

#### Scenario: Refresh asks the backend

- **WHEN** the user presses «Actualizar estado» on a row that is not `sending`
- **THEN** the page calls the refresh-signature endpoint for that draft

### Requirement: Contract signing menu entry

`menuConfig.js` SHALL include under `gestion_contratos`, after "Consulta contratos", an item with `id: 'firma_documento'`, label "Firma de documento", path `/app/gestion-contratos/firma-documento`, `navCode: 'NAV_ITEM_CONTRATOS_FIRMA'`, and `check: { action: 'sign', subject: 'Contract' }`.

#### Scenario: Menu visible with sign permission

- **WHEN** a user has `can('sign', 'Contract')`
- **THEN** the sidebar shows "Firma de documento" under Gestión de Contratos

#### Scenario: Menu hidden without sign permission

- **WHEN** a user lacks `can('sign', 'Contract')`
- **THEN** the "Firma de documento" menu item is not rendered

### Requirement: Route registration order for pending-signature

In `app.js`, route `GET /api/contracts/pending-signature` SHALL be registered before `GET /api/contracts/:id/pdf` so Express does not treat `pending-signature` as an id parameter.

#### Scenario: Pending-signature route resolves correctly

- **WHEN** `GET /api/contracts/pending-signature` is invoked
- **THEN** the pending list handler executes, not the PDF download handler

