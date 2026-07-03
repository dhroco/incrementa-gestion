## ADDED Requirements

### Requirement: MCP remote HTTP server on Cloud Run pre-prod

The system SHALL expose the incrementa-gestion MCP server as a remote Streamable HTTP endpoint at `/mcp` on Cloud Run service `incrementa-mcp` in pre-prod only (`incrementa-gestion-dev`). The endpoint SHALL be publicly reachable without authentication in this phase. The service SHALL reuse the backend container image with command `node mcp-http.mjs`.

#### Scenario: Remote client reaches MCP in pre-prod

- **WHEN** a Claude Desktop or Claude.ai client configured with the pre-prod MCP URL sends a Streamable HTTP request to `/mcp`
- **THEN** the MCP session initializes and tools are available

#### Scenario: MCP not deployed to production

- **WHEN** `ENVIRONMENT=prod` is set on a container running `mcp-http.mjs`
- **THEN** the process exits before serving requests

### Requirement: MCP remote HTTP health endpoint for operations

The Cloud Run MCP service SHALL respond to `GET /health` with HTTP 200 and `{ "status": "ok" }` for liveness checks.

#### Scenario: Cloud Run health probe

- **WHEN** an operator curls `GET <mcp-service-url>/health`
- **THEN** the response is 200 with `{ "status": "ok" }`

### Requirement: Future OAuth phase documented

This capability intentionally omits user authentication. A subsequent change SHALL add OAuth per user before production exposure. Documentation reference: `docs/mcp-remoto-opciones-auth.html`.

#### Scenario: Open endpoint is interim only

- **WHEN** reviewing this capability's security model
- **THEN** the spec states that unauthenticated access is limited to pre-prod test data and will be replaced by OAuth
