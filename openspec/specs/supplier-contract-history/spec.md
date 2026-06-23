# supplier-contract-history Specification

## Purpose
TBD - created by archiving change supplier-form-tabs-contract-history. Update Purpose after archive.
## Requirements
### Requirement: Supplier documents list API

The backend MUST expose `GET /api/suppliers/:id/documents` requiring authentication and CASL authorization `read` on subject `Supplier`. The response MUST be HTTP 200 with shape:

```json
{
  "signed_documents": [],
  "draft_documents": []
}
```

Each `signed_documents` entry MUST include: `id`, `template_name`, `file_name`, `signed_at`, `effective_from`, `effective_until`. Each `draft_documents` entry MUST include: `id`, `template_name`, `file_name`, `status`, `created_at`. `signed_documents` MUST come from `document` JOIN `template` WHERE `document.supplier_id` matches the route id, ordered by date descending. `draft_documents` MUST come from `draft_document` JOIN `template` WHERE `draft_document.supplier_id` matches and `status != 'signed'`, ordered by `created_at` descending. If the supplier does not exist, the server MUST respond HTTP 404 with a message in Spanish.

#### Scenario: Supplier with signed and draft documents
- **WHEN** an authorized client requests documents for a supplier with one signed contract and one draft
- **THEN** the response contains one item in `signed_documents` and one in `draft_documents` with correct template names

#### Scenario: Supplier with no documents
- **WHEN** an authorized client requests documents for a supplier with no related rows
- **THEN** both arrays are empty and HTTP status is 200

#### Scenario: Unauthorized documents list
- **WHEN** a client without `read Supplier` permission calls the endpoint
- **THEN** the server responds with HTTP 403

### Requirement: Signed document PDF inline view

The backend MUST expose `GET /api/documents/:id/view` requiring authentication and CASL authorization `read` on subject `Supplier`. The handler MUST load the `document` row by id, download the PDF buffer from GCS via `gcsService.downloadBuffer` using `gcs_path`, and respond with `Content-Type: application/pdf` and `Content-Disposition: inline; filename="..."` (not attachment). If the document does not exist, respond HTTP 404 in Spanish.

#### Scenario: View signed PDF inline
- **WHEN** an authorized client requests view for an existing document id
- **THEN** the response is HTTP 200 with PDF content and inline disposition header

#### Scenario: Missing signed document
- **WHEN** an authorized client requests view for a non-existent document id
- **THEN** the server responds HTTP 404

### Requirement: Draft document PDF inline view

The existing endpoint `GET /api/document-builder/downloads/:id` MUST serve generated draft PDFs with `Content-Disposition: inline; filename="..."` instead of `attachment`, preserving existing authorization checks.

#### Scenario: Draft download is inline
- **WHEN** an authorized client downloads a draft document PDF
- **THEN** the `Content-Disposition` header uses `inline` disposition

### Requirement: Supplier document history panel

The frontend MUST provide `SupplierDocumentHistoryPanel` accepting `supplierId` and `accessToken`. It MUST call `GET /api/suppliers/:id/documents` only when `supplierId` has a value. While loading, it MUST show "Cargando...". On error, it MUST show a red error message. It MUST render two tables using `.clause-list-table` and `.clause-list-table-wrap`:

1. **Contratos firmados** — columns: Plantilla, Nombre de archivo, Fecha firma, Vigencia desde, Vigencia hasta, Acción. Empty state: "No hay contratos firmados registrados."
2. **Contratos en progreso** — columns: Plantilla, Nombre de archivo, Estado, Fecha creación, Acción. Status labels: `draft` → "Borrador", `pending_signature` → "Pendiente firma", `rejected` → "Rechazado". Empty state: "No hay contratos en progreso."

Each row MUST have a "Ver" action button that fetches the appropriate PDF endpoint, creates a blob object URL, and opens it in a new browser tab for inline viewing.

#### Scenario: Panel loads signed contracts
- **WHEN** the panel mounts with a valid supplier id and access token
- **THEN** signed documents appear in the upper table with formatted dates in es-CL

#### Scenario: View signed PDF opens new tab
- **WHEN** user clicks "Ver" on a signed document row
- **THEN** the browser opens a new tab displaying the PDF inline

#### Scenario: View draft PDF opens new tab
- **WHEN** user clicks "Ver" on a draft document row
- **THEN** the browser opens a new tab displaying the draft PDF inline

#### Scenario: Panel idle without supplier id
- **WHEN** `supplierId` is null or empty
- **THEN** the panel does not fetch and shows no error

### Requirement: Supplier documents API client

The frontend MUST expose `fetchSupplierDocuments({ id, accessToken, signal })` in `suppliersApi.js` calling `GET /api/suppliers/:id/documents` with bearer authentication.

#### Scenario: API client returns documents
- **WHEN** the client calls `fetchSupplierDocuments` with valid credentials
- **THEN** the parsed response includes `signed_documents` and `draft_documents` arrays

