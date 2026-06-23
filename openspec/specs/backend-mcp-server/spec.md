# backend-mcp-server Specification

## Purpose
TBD - created by archiving change backend-mcp-server. Update Purpose after archive.
## Requirements
### Requirement: MCP stdio server process

The backend SHALL provide a standalone MCP server entrypoint at `backend/mcp.mjs` that uses `@modelcontextprotocol/sdk` with `StdioServerTransport`. The process MUST NOT share the Express HTTP port or lifecycle with `index.js` / `app.js`. The server name SHALL be `incrementa-gestion-mcp`.

#### Scenario: Claude Desktop launches MCP process

- **WHEN** Claude Desktop starts the configured MCP server command `node backend/mcp.mjs`
- **THEN** the process connects via stdio and registers MCP tools without starting Express

### Requirement: Fixed MCP technical actor

All MCP tool handlers SHALL use `userId = '00000000-0000-0000-0000-000000000001'` (`MCP_USER_ID`). The MCP process MUST NOT perform OIDC authentication or JWT validation.

#### Scenario: Service calls use MCP user id

- **WHEN** an MCP tool invokes `createSupplier` or `generateAndPersist`
- **THEN** the `userId` argument equals `MCP_USER_ID`

#### Scenario: MCP user profile resolves for audit

- **WHEN** `getUserProfileIdByUserId(MCP_USER_ID)` is called against a database with migration 019 applied
- **THEN** a non-null `user_profile.id` is returned

### Requirement: Direct service reuse without HTTP

The MCP server SHALL import and instantiate the same backend services used by Express: `supplierService` (default export), `createStandardTemplatesService({ db })`, `createDocumentBuilderService({ db, gcsService, getUserProfileIdByUserId })`, and Knex `db` from `./db/knex`. Handlers MUST NOT call internal HTTP endpoints.

#### Scenario: Supplier list uses supplierService

- **WHEN** the `listar_proveedores` tool is invoked
- **THEN** `supplierService.listSuppliers` is called directly

### Requirement: JSON tool response format

Every MCP tool handler SHALL return MCP content of type `text` whose body is pretty-printed JSON (`JSON.stringify(..., null, 2)`). Success responses MUST include `ok: true` and relevant `data`. Service failures MUST include `ok: false`, `code`, and `message` in Spanish when provided by the service.

#### Scenario: Successful supplier list

- **WHEN** `listar_proveedores` succeeds
- **THEN** the tool returns text JSON with `ok: true` and supplier items

#### Scenario: Validation error from service

- **WHEN** `crear_proveedor` receives invalid RUT
- **THEN** the tool returns text JSON with `ok: false` and a Spanish `message`

### Requirement: MCP tool listar_plantillas

The server SHALL expose tool `listar_plantillas` that calls `standardTemplatesService.listStandardTemplates({ search?, supplier_type?, status: 'active' })`. The tool MUST return only templates with status `'active'` so Claude does not offer inactive templates in conversational flows. The tool description MUST explain that it lists active standard contract templates available for document generation and returns id, name, code, and status. The tool description MUST instruct Claude to pass `supplier_type` once the supplier's type is known (from `listar_proveedores` or `obtener_proveedor`) to return only compatible templates. Optional parameter `supplier_type` SHALL accept `'persona_natural'` or `'empresa'`.

#### Scenario: List templates without filter returns only active

- **WHEN** Claude invokes `listar_plantillas` with no search term and no supplier_type
- **THEN** every returned template has `status` equal to `'active'`
- **AND** inactive templates are not included

#### Scenario: List templates filtered by supplier type returns only active

- **WHEN** Claude invokes `listar_plantillas` with `supplier_type: 'empresa'`
- **THEN** every returned template has `supplier_type` equal to `'empresa'`
- **AND** every returned template has `status` equal to `'active'`

### Requirement: MCP tool listar_proveedores

The server SHALL expose tool `listar_proveedores` that calls `supplierService.listSuppliers({ search? })`. The tool description MUST state that Claude should call this tool before creating a supplier to check for existing matches by name or RUT.

#### Scenario: Search suppliers

- **WHEN** Claude invokes `listar_proveedores` with a search string matching a RUT fragment
- **THEN** matching suppliers are returned in the JSON response

### Requirement: MCP tool obtener_proveedor

The server SHALL expose tool `obtener_proveedor` with required parameter `id` (UUID). It SHALL call `supplierService.getSupplierById(id)` and return the full supplier record including social networks.

#### Scenario: Get existing supplier

- **WHEN** Claude invokes `obtener_proveedor` with a valid supplier id
- **THEN** the tool returns `ok: true` with supplier details

#### Scenario: Supplier not found

- **WHEN** Claude invokes `obtener_proveedor` with an unknown id
- **THEN** the tool returns `ok: false` with code `NOT_FOUND`

### Requirement: MCP tool crear_proveedor

The server SHALL expose tool `crear_proveedor` accepting a supplier payload matching `supplierService.createSupplier` expectations (`supplier_type`, type-specific fields, optional `social_networks`). It SHALL pass `userId: MCP_USER_ID`. The tool description MUST document that optional `social_networks` is an array of objects with `catalog_id` (UUID from `social_network_catalog`) and `account_name` (handle, e.g. `@miempresa`). The description MUST instruct Claude to call `listar_catalogo_redes` before setting social networks to obtain valid `catalog_id` values.

#### Scenario: Create persona natural supplier

- **WHEN** Claude invokes `crear_proveedor` with valid persona natural fields
- **THEN** the tool returns `ok: true` with the created supplier including formatted RUT

#### Scenario: Create supplier with catalog social networks

- **WHEN** Claude invokes `crear_proveedor` with `social_networks` containing valid `catalog_id` and `account_name` obtained from `listar_catalogo_redes`
- **THEN** the tool returns `ok: true` with the created supplier including the social networks

### Requirement: MCP tool actualizar_proveedor

The server SHALL expose tool `actualizar_proveedor` with required `id` and partial `payload`. It SHALL call `supplierService.updateSupplier(id, { payload, userId: MCP_USER_ID })`. The tool description MUST document that when `social_networks` is sent it replaces the full list and each entry MUST include `catalog_id` (UUID from catalog) and `account_name`. The description MUST instruct Claude to call `listar_catalogo_redes` before updating social networks.

#### Scenario: Update supplier social networks

- **WHEN** Claude invokes `actualizar_proveedor` with a new `social_networks` array using valid `catalog_id` values
- **THEN** the tool returns the updated supplier with replaced social networks

### Requirement: MCP tool listar_empresas

The server SHALL expose tool `listar_empresas` that queries the `company` table directly via Knex, returning at minimum `id`, `business_name`, `short_name`, and display RUT fields needed to select a company for contract generation.

#### Scenario: List companies for contract context

- **WHEN** Claude invokes `listar_empresas`
- **THEN** the tool returns `ok: true` with an array of companies each including `id`, `business_name`, `short_name`, and formatted `rut`

### Requirement: MCP tool validar_contrato

The server SHALL expose tool `validar_contrato` that calls `documentBuilderService.generateAndPersist` with `body.dryRun: true`. Parameters MUST include `companyId`, `supplierId`, and `template: { kind: 'standard', id }`; optional `missingFieldOverrides`; optional `clientId` as UUID string. When `clientId` is provided, it MUST be forwarded in the generate body so client variables participate in placeholder resolution.

The tool description MUST state clearly that this tool does NOT generate a PDF or persist any document—it only checks whether template variables can be resolved. The tool description MUST explain that when `ok` is false and `code` is `MISSING_PLACEHOLDERS`, the field `data.missingFields` contains missing fields with their `type`, optional `options`, optional `pairField`, and `source`.

The tool description MUST further explain:

- For `type: 'select'` with string options, Claude MUST present options and pass the chosen string in `missingFieldOverrides`.
- For `type: 'select'` with object options containing a `values` property, Claude MUST add ALL entries from `values` to `missingFieldOverrides`, not only the field key.
- The `pairField` property indicates which secondary variable is auto-filled together with the primary; secondary fields never appear in `missingFields`.
- For `type: 'number'`, ask for a non-negative integer; backend formats thousands and may auto-generate paired text fields (e.g. `precio_texto` from `precio_numero`).
- Source rules: `supplier` → update supplier in DB first; `client` → update client first; `company` → inform user; `contract` → pass in `missingFieldOverrides`.

#### Scenario: Validation succeeds

- **WHEN** all template placeholders resolve for the given supplier, company, and optional client
- **THEN** the tool returns `ok: true` with `valid: true` and no GCS or database writes occur

#### Scenario: Validation with clientId

- **WHEN** Claude invokes `validar_contrato` with valid `clientId` and templates reference `client_brand`
- **THEN** client fields are loaded and included in substitution checks

#### Scenario: Missing placeholders reported with enriched fields

- **WHEN** template variables cannot be resolved
- **THEN** the tool returns `ok: false` with code `MISSING_PLACEHOLDERS` and `data.missingFields` as an array of `{ key, label, type, source, options?, pairField? }`
- **AND** the response does NOT include `missingFieldKeys`

#### Scenario: Tool description mentions values options

- **WHEN** the MCP server registers `validar_contrato`
- **THEN** the tool description instructs Claude to spread all `values` entries into `missingFieldOverrides` when a select option includes a `values` object

### Requirement: MCP tool generar_contrato

The server SHALL expose tool `generar_contrato` that calls `documentBuilderService.generateAndPersist` without `dryRun`. Parameters MUST match the HTTP generate body (`companyId` as `requestedCompanyId`, `supplierId`, `template`, optional `missingFieldOverrides`, optional `overwrite`, optional `clientId` as UUID). When `clientId` is omitted, generation MUST proceed without client context.

#### Scenario: Generate contract PDF

- **WHEN** Claude invokes `generar_contrato` with valid company, supplier, and standard template
- **THEN** the tool returns `ok: true` with generated document metadata including draft id and file name

#### Scenario: Generate with clientId

- **WHEN** Claude invokes `generar_contrato` with valid `clientId` in addition to company, supplier, and template
- **THEN** the draft is persisted with `client_id` set and client variables substituted in the PDF

#### Scenario: Duplicate draft without overwrite

- **WHEN** an active duplicate draft exists for the same supplier, template, and month and `overwrite` is not true
- **THEN** the tool returns `ok: false` with code `DUPLICATE_DRAFT` and existing draft info
- **AND** duplicate detection does not vary by `clientId`

### Requirement: Claude Desktop configuration merge

Implementation tasks SHALL merge (not replace) the user's `claude_desktop_config.json` to add server key `incrementa-gestion-mcp` while preserving existing servers such as `contratos-mcp`. The entry MUST inject env vars `DATABASE_URL`, `PGSSLMODE`, `GCS_BUCKET`, and `GOOGLE_APPLICATION_CREDENTIALS`.

#### Scenario: Existing MCP servers preserved

- **WHEN** the operator applies Claude Desktop configuration
- **THEN** previously configured `mcpServers` entries remain present alongside `incrementa-gestion-mcp`

### Requirement: npm script to run MCP server

`backend/package.json` SHALL include script `"mcp": "node mcp.mjs"` for local smoke testing outside Claude Desktop.

#### Scenario: Run MCP via npm

- **WHEN** the developer runs `npm run mcp` in the backend directory with required env vars set
- **THEN** the MCP server starts on stdio without errors

### Requirement: MCP tool obtener_url_contrato

The server SHALL expose tool `obtener_url_contrato` that accepts required parameter `documentId` (UUID of a `draft_document` row). The handler SHALL query `draft_document` for `id`, `file_name`, and `gcs_path`; if found with a non-empty `gcs_path`, it SHALL call `gcsService.getSignedUrl({ gcsPath, expiresInMinutes: 60 })` and return a browser-openable signed URL. The tool description MUST instruct Claude to call this tool immediately after `generar_contrato` when the user wants to view the PDF, or when the user asks to open a previously generated draft; it MUST state the URL is valid for 60 minutes. The handler MUST NOT query the `document` table.

#### Scenario: Signed URL after contract generation

- **WHEN** Claude invokes `obtener_url_contrato` with `documentId` equal to the id returned by a successful `generar_contrato` call
- **THEN** the tool returns `ok: true` with `data.signedUrl`, `data.file_name`, `data.documentId`, `data.expiresInMinutes` equal to 60, and `data.expiresAt` as ISO 8601 timestamp

#### Scenario: Draft not found

- **WHEN** Claude invokes `obtener_url_contrato` with a UUID that does not exist in `draft_document`
- **THEN** the tool returns `ok: false` with code `NOT_FOUND` and a Spanish message indicating the draft was not found

#### Scenario: Draft missing gcs_path

- **WHEN** Claude invokes `obtener_url_contrato` for a row where `gcs_path` is null or empty
- **THEN** the tool returns `ok: false` with code `GCS_PATH_MISSING` and a Spanish message indicating no storage file is associated

### Requirement: MCP tools receive gcsService dependency

`registerMcpTools` SHALL accept `gcsService` in its dependencies object. `backend/mcp.mjs` SHALL pass the same `gcsService` instance used by `createDocumentBuilderService`.

#### Scenario: obtener_url_contrato uses injected gcsService

- **WHEN** the `obtener_url_contrato` handler resolves a draft with `gcs_path`
- **THEN** it calls `gcsService.getSignedUrl` on the injected instance rather than importing a global module

### Requirement: MCP tool listar_catalogo_redes

The server SHALL expose tool `listar_catalogo_redes` that calls `supplierService.listSocialNetworkCatalog()` directly (without internal HTTP). The tool description MUST state that Claude should call this tool before creating or updating supplier social networks to obtain valid `catalog_id` UUIDs. The response MUST return `ok: true` with `data.items` where each item includes at least `id`, `code`, and `name`.

#### Scenario: List social network catalog

- **WHEN** Claude invokes `listar_catalogo_redes`
- **THEN** the tool returns `ok: true` with catalog entries including `id`, `code`, and `name` for each network

#### Scenario: Catalog used before create

- **WHEN** Claude needs to set social networks on `crear_proveedor`
- **THEN** the tool description directs Claude to invoke `listar_catalogo_redes` first to resolve `catalog_id` values

### Requirement: MCP tool listar_clientes

The server SHALL expose tool `listar_clientes` that calls `clientService.listClients({ search? })`. The tool description MUST state that it lists clients registered in the Incrementa back office, returns `id`, `name`, `brand`, `brand_account`, and `product_campaigns`, and SHOULD be used to obtain `clientId` before generating a contract when a brand context is needed. Optional parameter `search` SHALL filter by client `name` or `brand` (case-insensitive).

#### Scenario: List clients without search

- **WHEN** Claude invokes `listar_clientes` with no parameters
- **THEN** the tool returns `ok: true` with all clients and their product campaigns

#### Scenario: List clients with search

- **WHEN** Claude invokes `listar_clientes` with `search` matching a brand name
- **THEN** the tool returns `ok: true` with matching clients only

### Requirement: MCP tools receive clientService dependency

`registerMcpTools` SHALL accept `clientService` in its dependencies object. `backend/mcp.mjs` SHALL instantiate `clientService` and pass it to `registerMcpTools` alongside existing services.

#### Scenario: listar_clientes uses injected service

- **WHEN** the `listar_clientes` tool is invoked
- **THEN** `clientService.listClients` is called directly without HTTP round-trip

### Requirement: MCP tool listar_documentos_pendientes_firma

The server SHALL expose tool `listar_documentos_pendientes_firma` with no parameters. The handler SHALL call `contractSigningService.listPendingSignature({ db })`. The tool description MUST state it lists contracts pending electronic signature (active drafts not signed or rejected) and returns id, supplier, client, template, company, and contract date.

#### Scenario: List pending signature drafts

- **WHEN** Claude invokes `listar_documentos_pendientes_firma`
- **THEN** the tool returns `ok: true` with pending draft items

### Requirement: MCP tool firmar_contrato_electronico

The server SHALL expose tool `firmar_contrato_electronico` with required parameter `draftDocumentId` (UUID). The handler SHALL call `contractSigningService.signContract` with `signerUserProfileId` resolved via `getUserProfileIdByUserId(MCP_USER_ID)`.

The tool description MUST require explicit user confirmation before invocation. It MUST explain that signing appends a signature page, uploads to GCS, creates the signed document record, and emails the company.

#### Scenario: Sign contract via MCP

- **WHEN** Claude invokes `firmar_contrato_electronico` with a valid pending draft id after user confirmation
- **THEN** the tool returns `ok: true` with document id and file name

#### Scenario: MCP signer uses service profile

- **WHEN** `firmar_contrato_electronico` completes successfully
- **THEN** `signed_by` on the document reflects the MCP service user profile name

### Requirement: MCP tools receive contractSigningService dependency

`registerMcpTools` SHALL accept `contractSigningService` and `emailService` in its dependencies object. `backend/mcp.mjs` SHALL instantiate both and pass them to `registerMcpTools`.

#### Scenario: Signing tool uses injected service

- **WHEN** `firmar_contrato_electronico` is invoked
- **THEN** `contractSigningService.signContract` is called directly without HTTP

