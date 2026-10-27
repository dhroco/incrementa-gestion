## MODIFIED Requirements

### Requirement: MCP tool firmar_contrato_electronico

The server SHALL expose tool `firmar_contrato_electronico` with required parameter `draftDocumentId` (UUID). The handler SHALL resolve `signerUserProfileId` via `getUserProfileIdByUserId(MCP_USER_ID)`.

When `deps.firmeSigningService` is present and `getSigningMode(draftDocumentId)` is `firme`, the handler SHALL return the error code `USE_FIRME_FLOW` with message «Este contrato se firma con Firme: use «Aprobar y enviar a firma».» and SHALL NOT call `signContract`. When the mode is `blocked`, the handler SHALL return the error code `FIRMA_BLOQUEADA` with message «La firma está deshabilitada en producción hasta que se configure Firme.» and SHALL NOT call `signContract`. When `deps.firmeSigningService` is absent, or the mode is `internal`, the handler SHALL call `contractSigningService.signContract` as it does today.

The tool description MUST require explicit user confirmation before invocation. It MUST explain that signing appends a signature page, uploads to GCS, creates the signed document record, and emails the company.

#### Scenario: Sign contract via MCP

- **WHEN** Claude invokes `firmar_contrato_electronico` with a valid pending draft id after user confirmation and the mode is `internal` or no Firme service is injected
- **THEN** the tool returns `ok: true` with document id and file name

#### Scenario: MCP signer uses service profile

- **WHEN** `firmar_contrato_electronico` completes successfully
- **THEN** `signed_by` on the document reflects the MCP service user profile name

#### Scenario: Firme mode blocks the MCP tool

- **WHEN** `firmar_contrato_electronico` is invoked with `deps.firmeSigningService` and the mode is `firme`
- **THEN** the tool returns code `USE_FIRME_FLOW`
- **AND** `signContract` is not called

#### Scenario: Blocked mode blocks the MCP tool

- **WHEN** `firmar_contrato_electronico` is invoked with `deps.firmeSigningService` and the mode is `blocked`, including a supplier without a Chilean RUT
- **THEN** the tool returns code `FIRMA_BLOQUEADA`
- **AND** `signContract` is not called

#### Scenario: Missing Firme dependency keeps today's tool

- **WHEN** `firmar_contrato_electronico` is invoked without `deps.firmeSigningService`
- **THEN** the handler calls `signContract`

### Requirement: Shared MCP server factory

The backend SHALL provide `backend/mcpServer.mjs` exporting `createMcpServer()` that constructs an `McpServer` named `incrementa-gestion-mcp`, instantiates the same service dependencies as the stdio entrypoint (`db`, `supplierService`, `clientService`, `standardTemplatesService`, `documentBuilderService`, `contractsQueryService`, `contractSigningService`, `gcsService`, `getUserProfileIdByUserId`) plus the real `firmeSigningService` from `createFirmeSigningService()`, using a singleton Knex pool at module scope, and calls `registerMcpTools(server, deps)` with that `firmeSigningService`. Both `backend/mcp.mjs` and `backend/mcp-http.mjs` MUST use this factory. The factory SHALL NOT start a timer.

#### Scenario: Factory registers all existing tools

- **WHEN** `createMcpServer()` is invoked
- **THEN** the returned server exposes the same MCP tools as the pre-refactor stdio server

#### Scenario: Factory reuses singleton db

- **WHEN** `createMcpServer()` is called multiple times in the same process
- **THEN** each call returns a distinct `McpServer` instance sharing the same Knex `db` singleton

#### Scenario: Factory passes the Firme signing service

- **WHEN** `createMcpServer()` registers tools
- **THEN** `registerMcpTools` receives a `firmeSigningService`
- **AND** no interval or background sweep is started
