## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: MCP tool validar_contrato

The server SHALL expose tool `validar_contrato` that calls `documentBuilderService.generateAndPersist` with `body.dryRun: true`. Parameters MUST include `companyId`, `supplierId`, and `template: { kind: 'standard', id }`; optional `missingFieldOverrides`; optional `clientId` as UUID string. When `clientId` is provided, it MUST be forwarded in the generate body so client variables participate in placeholder resolution. The tool description MUST state clearly that this tool does NOT generate a PDF or persist any document—it only checks whether template variables can be resolved.

#### Scenario: Validation succeeds

- **WHEN** all template placeholders resolve for the given supplier, company, and optional client
- **THEN** the tool returns `ok: true` with `valid: true` and no GCS or database writes occur

#### Scenario: Validation with clientId

- **WHEN** Claude invokes `validar_contrato` with valid `clientId` and templates reference `client_brand`
- **THEN** client fields are loaded and included in substitution checks

#### Scenario: Missing placeholders reported

- **WHEN** template variables cannot be resolved
- **THEN** the tool returns `ok: false` with code `MISSING_PLACEHOLDERS` and `missingFieldKeys`

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
