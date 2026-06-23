# contracts-query Specification

## Purpose
TBD - created by archiving change consulta-contratos. Update Purpose after archive.
## Requirements
### Requirement: Contract overrides database schema

Migration `202606010005_add_contract_overrides.js` SHALL add nullable JSONB column `contract_overrides` to tables `draft_document` and `document`. It SHALL add nullable UUID column `document.client_id` referencing `client.id` with `ON DELETE SET NULL`. It SHALL create GIN indexes `idx_draft_document_contract_overrides` and `idx_document_contract_overrides` on the respective `contract_overrides` columns. The `down` migration SHALL drop the added columns and indexes.

#### Scenario: Migration applies successfully

- **WHEN** `knex migrate:latest` includes migration `202606010005_add_contract_overrides.js`
- **THEN** columns `draft_document.contract_overrides` and `document.contract_overrides` exist as nullable JSONB
- **AND** column `document.client_id` exists as nullable UUID FK to `client`
- **AND** both GIN indexes exist

### Requirement: Contract list API

The backend SHALL expose `GET /api/contracts` protected by `authorize('read', 'Contract')`. Query parameters SHALL support:

- `page` (integer, default 1)
- `pageSize` (integer, default 18)
- `supplierSearch` (optional string, ILIKE on supplier full name or razon social)
- `clientId` (optional UUID)
- `templateId` (optional UUID)
- `redSocialSearch` (optional string, ILIKE on `contract_overrides->>'proveedor_red_social'`)
- `status` (optional: `all`, `draft`, `signed`; default `all`)

The service `contractsQueryService.listContracts` SHALL combine rows from `draft_document` (source `draft`, excluding status `rejected`) and `document` (source `signed`) via `UNION ALL`, apply filters to both subqueries before union, order by `created_at DESC`, and paginate with offset/limit. The response SHALL be HTTP 200 with shape:

```json
{
  "ok": true,
  "data": {
    "items": [...],
    "pagination": { "page", "pageSize", "total", "totalPages" }
  }
}
```

Each item SHALL include at minimum: `id`, `source` (`draft`|`signed`), `supplier_name`, `supplier_type`, `client_name` (nullable), `template_name` (nullable), `file_name`, `gcs_path`, `status`, `created_at`, and flattened override fields `fecha_contrato`, `mes_ejecucion`, `proveedor_red_social`, `proveedor_cuenta_social`, `precio_numero` derived from `contract_overrides ?? {}`.

#### Scenario: List all contracts paginated

- **WHEN** an authorized user requests `GET /api/contracts?page=1&pageSize=18`
- **THEN** the response is HTTP 200 with up to 18 items ordered by `created_at` descending
- **AND** `pagination.total` reflects the count of non-rejected drafts plus signed documents matching filters

#### Scenario: Filter by status draft only

- **WHEN** an authorized user requests `GET /api/contracts?status=draft`
- **THEN** all returned items have `source` `draft`
- **AND** no item has status `rejected`

#### Scenario: Filter by supplier search

- **WHEN** an authorized user requests `GET /api/contracts?supplierSearch=acme`
- **THEN** returned items match supplier name or razon social case-insensitively

#### Scenario: Unauthorized list

- **WHEN** a user without `read` on subject `Contract` calls `GET /api/contracts`
- **THEN** the server responds with HTTP 403

### Requirement: Contract PDF download API

The backend SHALL expose `GET /api/contracts/:id/pdf?source=draft|signed` protected by `authorize('read', 'Contract')`. Parameter `source` MUST be exactly `draft` or `signed`. For `source=draft`, the controller SHALL load the row from `draft_document` by `id`. For `source=signed`, it SHALL load from `document` by `id`. If the row does not exist, the server SHALL respond HTTP 404 with a Spanish message. On success, the server SHALL download bytes via `gcsService.downloadBuffer`, set `Content-Type: application/pdf`, `Content-Disposition: inline; filename="<sanitized file_name>"`, and return the PDF buffer.

#### Scenario: Download draft PDF

- **WHEN** an authorized user requests `GET /api/contracts/{draftId}/pdf?source=draft` for an existing draft
- **THEN** the response is HTTP 200 with `Content-Type: application/pdf`
- **AND** the body is the PDF bytes from GCS

#### Scenario: Download signed PDF

- **WHEN** an authorized user requests `GET /api/contracts/{docId}/pdf?source=signed` for an existing document row
- **THEN** the response is HTTP 200 with inline PDF content

#### Scenario: Invalid source parameter

- **WHEN** an authorized user requests PDF with `source=invalid`
- **THEN** the server responds with HTTP 400 and a Spanish validation message

#### Scenario: Missing contract

- **WHEN** an authorized user requests PDF for a non-existent id
- **THEN** the server responds with HTTP 404

### Requirement: Contracts query frontend page

The frontend SHALL provide `ContractsListPage` at route `/app/gestion-contratos/consulta-contratos`, gated by `RequireCan I="read" a="Contract"`. On mount, it SHALL load client list via `fetchClientsList()` and template list via `fetchStandardTemplates()` (all templates, not only active). Filter bar SHALL include:

1. Supplier text input with 300ms debounce
2. Client select with option "Todos los clientes"
3. Template select with option "Todas las plantillas"
4. Social network text input with 300ms debounce
5. Status select: "Todos", "En proceso de firma" (`draft`), "Firmados" (`signed`)

Changing any filter SHALL reset to page 1. Results table SHALL display columns: Proveedor (with supplier type chip), Cliente, Plantilla, Red Social (`proveedor_red_social — proveedor_cuenta_social` or "—"), Fecha contrato, Mes ejecución, Precio, Estado (badge "En proceso" grey for drafts, "Firmado" green for signed), Ver PDF (document icon). Pagination SHALL show 18 records per page with controls « Anterior | Página X de Y | Siguiente » and total count. PDF view SHALL use `fetchContractPdfBlob` with Authorization header, then `URL.createObjectURL` and `window.open` (not direct href).

#### Scenario: User with permission opens consulta page

- **WHEN** a user with `read` on `Contract` navigates to Consulta contratos
- **THEN** the filter bar and empty or populated results table render
- **AND** client and template dropdowns are populated

#### Scenario: Open PDF from table

- **WHEN** the user clicks the document icon on a row
- **THEN** the frontend fetches the PDF with bearer token
- **AND** opens the PDF in a new browser tab via blob URL

#### Scenario: User without permission

- **WHEN** a user without `read` on `Contract` attempts the route
- **THEN** access is denied by `RequireCan`

### Requirement: Contracts navigation menu entry

`menuConfig.js` SHALL include under `gestion_contratos` an item with `id: 'consulta_contratos'`, label `Consulta contratos`, path `/app/gestion-contratos/consulta-contratos`, `navCode: 'NAV_ITEM_CONTRATOS_CONSULTA'`, `moduleTitle: 'Consulta contratos'`, and check `{ action: 'read', subject: 'Contract' }`.

#### Scenario: Menu item visible with permission

- **WHEN** a user with `read` on `Contract` views the sidebar under Gestión de Contratos
- **THEN** item "Consulta contratos" is visible and navigates to the consulta page

### Requirement: Contracts frontend API module

The frontend SHALL provide `contractsApi.js` exporting:

- `fetchContracts({ page, filters, accessToken })` → `GET /api/contracts`
- `fetchContractPdfBlob({ id, source, accessToken })` → `GET /api/contracts/:id/pdf` returning a Blob

#### Scenario: fetchContracts sends filter query params

- **WHEN** `fetchContracts` is called with filters and page 2
- **THEN** the request URL includes encoded filter parameters and `page=2`

