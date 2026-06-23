## ADDED Requirements

### Requirement: Pending signature list API

The backend SHALL expose `GET /api/contracts/pending-signature` protected by `authorize('sign', 'Contract')`. Service `contractSigningService.listPendingSignature` SHALL query `draft_document` joined with `supplier`, `supplier_persona_natural`, `supplier_empresa`, `client`, `template`, and `company`, filtering rows where `draft_document.status` is NOT `'signed'` and NOT `'rejected'`, ordered by `created_at DESC`.

Each returned item SHALL include: `id`, `supplier_name` (COALESCE empresa razon_social, persona natural full_name), `supplier_type`, `client_name` (nullable), `template_name`, `company_name` (`company.business_name`), `company_short_name`, `company_email`, `fecha_contrato` (from `contract_overrides->>'fecha_contrato'`), `created_at`, `file_name`, `gcs_path`.

#### Scenario: List pending contracts

- **WHEN** an authorized user with `can('sign', 'Contract')` calls `GET /api/contracts/pending-signature`
- **THEN** the response is HTTP 200 with `ok: true` and `data.items` containing only non-signed, non-rejected drafts

#### Scenario: Unauthorized list

- **WHEN** a user without `can('sign', 'Contract')` calls `GET /api/contracts/pending-signature`
- **THEN** the response status is **403** with a Spanish message

#### Scenario: Empty pending list

- **WHEN** no draft rows match the pending filter
- **THEN** the response is HTTP 200 with `data.items` as an empty array

### Requirement: Contract sign API

The backend SHALL expose `POST /api/contracts/:id/sign` protected by `authorize('sign', 'Contract')`. The controller SHALL resolve `signerUserProfileId` via `getUserProfileIdByUserId(req.auth.userId)` and call `contractSigningService.signContract`.

#### Scenario: Successful sign

- **WHEN** an authorized user posts sign for a valid pending draft id
- **THEN** the response is HTTP 200 with `ok: true` and `data.documentId` and `data.fileName`

#### Scenario: Sign already signed draft

- **WHEN** sign is requested for a draft with status `'signed'` or `'rejected'`
- **THEN** the service returns an error with a Spanish message
- **AND** no new document row is created

#### Scenario: Unauthorized sign

- **WHEN** a user without `can('sign', 'Contract')` posts sign
- **THEN** the response status is **403**

### Requirement: Sign contract service orchestration

`contractSigningService.signContract({ db, gcsService, emailService, draftDocumentId, signerUserProfileId })` SHALL:

1. Load and validate the draft (exists, status not `signed`/`rejected`).
2. Load signer `user_profile.full_name`, company, template, and supplier name.
3. Download original PDF from GCS via `gcsService.downloadBuffer`.
4. Append a signature page with pdf-lib including: title "FIRMA ELECTRÓNICA SIMPLE", Ley 19.799 reference, signer name, company representation, formatted company RUT, timestamp in `America/Santiago`, and SHA-256 hash of the **original** PDF buffer.
5. Upload signed PDF to GCS path `contratos-firmados/{company_id}/{supplier_id}/{template_code}/{year}/{month}/{docId}_firmado.pdf` using `yearMonthInSantiago()`.
6. Within a database transaction: INSERT into `document` (with `draft_document_id`, `supplier_id`, `company_id`, `template_id`, `client_id`, `contract_overrides`, `gcs_path`, `file_name`, `source: 'generated'`, `signed_at`, `signed_by`, `uploaded_by`) and UPDATE `draft_document SET status = 'signed'`.
7. After commit, call `emailService.sendSignedContractEmail` to `company.email` with the signed PDF buffer.
8. If email fails, log the error and still return success for the signing operation.

The original draft row and its GCS object SHALL NOT be deleted or modified except for `status`.

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

### Requirement: Contract signing frontend page

The frontend SHALL provide `ContractSigningPage` at route `/app/gestion-contratos/firma-documento` guarded by `RequireCan` with `I="sign"` and `a="Contract"`.

The page SHALL display a table with columns: Proveedor (name + type chip), Cliente, Empresa (`company_short_name`), Plantilla, Fecha contrato, Creado, Acciones (Ver PDF, Firmar).

"Ver PDF" SHALL fetch the draft PDF blob and open it in a new tab (same pattern as Consulta contratos). "Firmar" SHALL open a confirmation modal showing supplier, client, template, company, authorization checkbox, and disabled "Firmar y enviar email" until checkbox is checked.

On successful sign, the row SHALL be removed from the table and a success toast SHALL display "Contrato firmado. Email enviado a [email]".

When no pending items exist, the page SHALL show "No hay contratos pendientes de firma."

#### Scenario: Sign with unchecked authorization

- **WHEN** the confirmation modal is open and the checkbox is unchecked
- **THEN** the "Firmar y enviar email" button is disabled

#### Scenario: Sign success removes row

- **WHEN** the user confirms sign and the API returns success
- **THEN** the contract row disappears from the table
- **AND** a success toast is shown with the company email

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
