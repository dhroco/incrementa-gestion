## ADDED Requirements

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
