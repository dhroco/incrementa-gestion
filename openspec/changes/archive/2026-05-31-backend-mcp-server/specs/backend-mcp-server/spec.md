## ADDED Requirements

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

The server SHALL expose tool `listar_plantillas` that calls `standardTemplatesService.listStandardTemplates({ search? })`. The tool description MUST explain that it lists standard contract templates available for document generation and returns id, name, code, and status.

#### Scenario: List templates without filter

- **WHEN** Claude invokes `listar_plantillas` with no search term
- **THEN** the tool returns all standard templates ordered by recency

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

The server SHALL expose tool `crear_proveedor` accepting a supplier payload matching `supplierService.createSupplier` expectations (`supplier_type`, type-specific fields, optional `social_networks`). It SHALL pass `userId: MCP_USER_ID`.

#### Scenario: Create persona natural supplier

- **WHEN** Claude invokes `crear_proveedor` with valid persona natural fields
- **THEN** the tool returns `ok: true` with the created supplier including formatted RUT

### Requirement: MCP tool actualizar_proveedor

The server SHALL expose tool `actualizar_proveedor` with required `id` and partial `payload`. It SHALL call `supplierService.updateSupplier(id, { payload, userId: MCP_USER_ID })`.

#### Scenario: Update supplier social networks

- **WHEN** Claude invokes `actualizar_proveedor` with a new `social_networks` array
- **THEN** the tool returns the updated supplier with replaced social networks

### Requirement: MCP tool listar_empresas

The server SHALL expose tool `listar_empresas` that queries the `company` table directly via Knex, returning at minimum `id`, `name`, and display RUT fields needed to select a company for contract generation.

#### Scenario: List companies for contract context

- **WHEN** Claude invokes `listar_empresas`
- **THEN** the tool returns `ok: true` with an array of companies

### Requirement: MCP tool validar_contrato

The server SHALL expose tool `validar_contrato` that calls `documentBuilderService.generateAndPersist` with `body.dryRun: true`. Parameters MUST include `companyId`, `supplierId`, and `template: { kind: 'standard', id }`; optional `missingFieldOverrides`. The tool description MUST state clearly that this tool does NOT generate a PDF or persist any document—it only checks whether template variables can be resolved.

#### Scenario: Validation succeeds

- **WHEN** all template placeholders resolve for the given supplier and company
- **THEN** the tool returns `ok: true` with `valid: true` and no GCS or database writes occur

#### Scenario: Missing placeholders reported

- **WHEN** template variables cannot be resolved
- **THEN** the tool returns `ok: false` with code `MISSING_PLACEHOLDERS` and `missingFieldKeys`

### Requirement: MCP tool generar_contrato

The server SHALL expose tool `generar_contrato` that calls `documentBuilderService.generateAndPersist` without `dryRun`. Parameters MUST match the HTTP generate body (`companyId` as `requestedCompanyId`, `supplierId`, `template`, optional `missingFieldOverrides`, optional `overwrite`).

#### Scenario: Generate contract PDF

- **WHEN** Claude invokes `generar_contrato` with valid company, supplier, and standard template
- **THEN** the tool returns `ok: true` with generated document metadata including draft id and file name

#### Scenario: Duplicate draft without overwrite

- **WHEN** an active duplicate draft exists for the same supplier, template, and month and `overwrite` is not true
- **THEN** the tool returns `ok: false` with code `DUPLICATE_DRAFT` and existing draft info

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
