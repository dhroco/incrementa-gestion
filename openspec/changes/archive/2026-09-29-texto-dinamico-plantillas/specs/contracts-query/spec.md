## MODIFIED Requirements

### Requirement: Contract list API

The backend SHALL expose `GET /api/contracts` protected by `authorize('read', 'Contract')`. Query parameters SHALL support:

- `page` (integer, default 1)
- `pageSize` (integer, default 18)
- `supplierSearch` (optional string, ILIKE on supplier full name or razon social)
- `clientId` (optional UUID)
- `templateId` (optional UUID)
- `redSocialSearch` (optional string, the same ILIKE term on `contract_overrides->>'proveedor_red_social'` OR `contract_overrides->>'servicios_entregables'`, grouped so the OR does not release the other filters)
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

Each item SHALL include at minimum: `id`, `source` (`draft`|`signed`), `supplier_name`, `supplier_type`, `client_name` (nullable), `template_name` (nullable), `file_name`, `gcs_path`, `status`, `created_at`, and flattened override fields `fecha_contrato`, `mes_ejecucion`, `proveedor_red_social`, `proveedor_cuenta_social`, `precio_numero`, `servicios_entregables` derived from `contract_overrides ?? {}`. `servicios_entregables` SHALL be that override value, or `null` when the key is absent. The other flattened fields SHALL stay as they are today when `servicios_entregables` is absent.

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

#### Scenario: List item includes deliverables

- **WHEN** `mapContractListItem` receives a row whose `contract_overrides` contains `servicios_entregables` `cinco (5) reels en TikTok` and `proveedor_red_social` `Instagram`
- **THEN** the item `servicios_entregables` is `cinco (5) reels en TikTok`
- **AND** `proveedor_red_social` is `Instagram`

#### Scenario: Missing deliverables stay null

- **WHEN** `mapContractListItem` receives a row whose `contract_overrides` has no `servicios_entregables` key
- **THEN** the item `servicios_entregables` is `null`
- **AND** the other flattened override fields are unchanged

#### Scenario: Social filter matches deliverables only

- **WHEN** `redSocialSearch` is `TikTok` and a contract has no `proveedor_red_social` and `servicios_entregables` `cinco (5) reels en TikTok`
- **THEN** the list predicate matches that contract
- **AND** the same ILIKE term is applied to `proveedor_red_social` OR `servicios_entregables`

### Requirement: Contracts query frontend page

The frontend SHALL provide `ContractsListPage` at route `/app/gestion-contratos/consulta-contratos`, gated by `RequireCan I="read" a="Contract"`. On mount, it SHALL load client list via `fetchClientsList()` and template list via `fetchStandardTemplates()` (all templates, not only active). Filter bar SHALL include:

1. Supplier text input with 300ms debounce
2. Client select with option "Todos los clientes"
3. Template select with option "Todas las plantillas"
4. Social network text input with 300ms debounce
5. Status select: "Todos", "En proceso de firma" (`draft`), "Firmados" (`signed`)

Changing any filter SHALL reset to page 1. Results table SHALL display columns: Proveedor (with supplier type chip), Cliente, Plantilla, Red Social (a non-empty `servicios_entregables` string when that value is present; otherwise `proveedor_red_social — proveedor_cuenta_social` or "—"), Fecha contrato, Mes ejecución, Precio, Estado (badge "En proceso" grey for drafts, "Firmado" green for signed), Ver PDF (document icon). Pagination SHALL show 18 records per page with controls « Anterior | Página X de Y | Siguiente » and total count. PDF view SHALL use `fetchContractPdfBlob` with Authorization header, then `URL.createObjectURL` and `window.open` (not direct href). The column title SHALL stay `Red Social`. No new visual style SHALL be added for this cell.

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

#### Scenario: Cell shows deliverables when present

- **WHEN** a list row has `servicios_entregables` `cinco (5) reels en TikTok y cuatro (4) reels en Facebook` and also has `proveedor_red_social` and `proveedor_cuenta_social`
- **THEN** the Red Social cell shows `cinco (5) reels en TikTok y cuatro (4) reels en Facebook`

#### Scenario: Cell shows today's network when deliverables are absent

- **WHEN** a list row has `proveedor_red_social` `Instagram`, `proveedor_cuenta_social` `@acme`, and no `servicios_entregables`
- **THEN** the Red Social cell shows `Instagram — @acme`
