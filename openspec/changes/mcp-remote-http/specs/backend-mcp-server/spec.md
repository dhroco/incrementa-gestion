## ADDED Requirements

### Requirement: Shared MCP server factory

The backend SHALL provide `backend/mcpServer.mjs` exporting `createMcpServer()` that constructs an `McpServer` named `incrementa-gestion-mcp`, instantiates the same service dependencies as the current stdio entrypoint (`db`, `supplierService`, `clientService`, `standardTemplatesService`, `documentBuilderService`, `contractsQueryService`, `contractSigningService`, `gcsService`, `getUserProfileIdByUserId`), and calls `registerMcpTools(server, deps)`. Both `backend/mcp.mjs` and `backend/mcp-http.mjs` MUST use this factory.

#### Scenario: Factory registers all existing tools

- **WHEN** `createMcpServer()` is invoked
- **THEN** the returned server exposes the same MCP tools as the pre-refactor stdio server

#### Scenario: Stdio entrypoint uses factory

- **WHEN** `backend/mcp.mjs` starts
- **THEN** it calls `createMcpServer()` and connects `StdioServerTransport` without duplicating service bootstrap

### Requirement: MCP HTTP entrypoint with Streamable HTTP transport

The backend SHALL provide `backend/mcp-http.mjs` as a standalone HTTP process (not mounted on Express `app.js`) that exposes MCP at path `/mcp` using `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/streamableHttp.js` in **stateless** mode (`sessionIdGenerator: undefined`), creating a new server and transport per MCP request. The process SHALL listen on `process.env.PORT` (default 8080) and host `0.0.0.0`. It SHALL handle HTTP methods required by the Streamable HTTP transport (at minimum POST, GET, and DELETE on `/mcp`).

#### Scenario: MCP Inspector connects locally

- **WHEN** a developer runs `node mcp-http.mjs` with required env vars and connects an MCP Streamable HTTP client to `http://localhost:<PORT>/mcp`
- **THEN** the client completes initialization and can list tools

#### Scenario: Stateless per-request lifecycle

- **WHEN** two consecutive MCP HTTP requests arrive at `/mcp`
- **THEN** each request uses a newly created `McpServer` and `StreamableHTTPServerTransport` without shared in-memory session state

### Requirement: MCP HTTP health check endpoint

`backend/mcp-http.mjs` SHALL expose `GET /health` returning HTTP 200 with JSON body `{ "status": "ok" }`.

#### Scenario: Health check success

- **WHEN** a client sends `GET /health` to the MCP HTTP process
- **THEN** the response status is 200 and the body is `{ "status": "ok" }`

### Requirement: MCP HTTP process has no authentication middleware

The MCP HTTP entrypoint SHALL NOT validate JWT, API keys, or OIDC tokens on `/mcp` requests in this change. Access control is deferred to a future OAuth phase.

#### Scenario: Unauthenticated MCP request accepted

- **WHEN** a client sends a valid Streamable HTTP MCP request to `/mcp` without an Authorization header
- **THEN** the request is processed by the MCP transport

### Requirement: MCP HTTP anti-production safeguard

At startup, `backend/mcp-http.mjs` SHALL read `ENVIRONMENT` from `config.js`. If `ENVIRONMENT === 'prod'`, the process MUST log a clear error message to stderr (Spanish) stating that open MCP HTTP mode is not allowed in production, and exit with code 1 without binding to a port.

#### Scenario: Production environment blocks startup

- **WHEN** `ENVIRONMENT=prod node mcp-http.mjs` is executed
- **THEN** the process exits with code 1 and does not listen on any port

#### Scenario: Dev environment allows startup

- **WHEN** `ENVIRONMENT=dev node mcp-http.mjs` is executed with valid database configuration
- **THEN** the process starts and listens on the configured port

### Requirement: MCP stdio entrypoint behavior unchanged

Refactoring to `createMcpServer()` MUST NOT change the stdio MCP behavior: `backend/mcp.mjs` SHALL still use `StdioServerTransport`, the npm script `"mcp": "node mcp.mjs"` SHALL remain, and Claude Desktop stdio configuration SHALL continue to work without modification.

#### Scenario: npm run mcp still works

- **WHEN** a developer runs `npm run mcp` in the backend directory with required env vars
- **THEN** the MCP server starts on stdio without errors

## MODIFIED Requirements

### Requirement: MCP stdio server process

The backend SHALL provide a standalone MCP server entrypoint at `backend/mcp.mjs` that uses `@modelcontextprotocol/sdk` with `StdioServerTransport`. The process MUST NOT share the Express HTTP port or lifecycle with `index.js` / `app.js`. The server name SHALL be `incrementa-gestion-mcp`. Server construction and tool registration SHALL be delegated to `createMcpServer()` from `backend/mcpServer.mjs`.

#### Scenario: Claude Desktop launches MCP process

- **WHEN** Claude Desktop starts the configured MCP server command `node backend/mcp.mjs`
- **THEN** the process connects via stdio and registers MCP tools without starting Express

#### Scenario: Stdio uses shared factory

- **WHEN** `backend/mcp.mjs` is loaded
- **THEN** it imports `createMcpServer` from `backend/mcpServer.mjs` rather than inlining service bootstrap

### Requirement: MCP tools receive contractSigningService dependency

`registerMcpTools` SHALL accept `contractSigningService` and `emailService` in its dependencies object. `createMcpServer()` in `backend/mcpServer.mjs` SHALL instantiate both and pass them to `registerMcpTools`.

#### Scenario: Signing tool uses injected service

- **WHEN** `firmar_contrato_electronico` is invoked
- **THEN** `contractSigningService.signContract` is called directly without HTTP

### Requirement: MCP tools receive clientService dependency

`registerMcpTools` SHALL accept `clientService` in its dependencies object. `createMcpServer()` SHALL instantiate `clientService` and pass it to `registerMcpTools` alongside existing services.

#### Scenario: listar_clientes uses injected service

- **WHEN** the `listar_clientes` tool is invoked
- **THEN** `clientService.listClients` is called directly without HTTP round-trip

### Requirement: MCP tools receive gcsService dependency

`registerMcpTools` SHALL accept `gcsService` in its dependencies object. `createMcpServer()` SHALL pass the same `gcsService` instance used by `createDocumentBuilderService`.

#### Scenario: obtener_url_contrato uses injected gcsService

- **WHEN** the `obtener_url_contrato` handler resolves a draft with `gcs_path`
- **THEN** it calls `gcsService.getSignedUrl` on the injected instance rather than importing a global module
