## ADDED Requirements

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
