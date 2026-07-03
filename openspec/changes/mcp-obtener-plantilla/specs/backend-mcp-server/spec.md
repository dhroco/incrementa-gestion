## ADDED Requirements

### Requirement: MCP tool obtener_plantilla

The server SHALL expose tool `obtener_plantilla` with required parameter `id` (UUID of a standard template). The handler SHALL call `standardTemplatesService.getStandardTemplateById(id)`. When the service returns `{ ok: false, notFound: true }` or `ok` is not true, the tool MUST return `{ ok: false, code: 'NOT_FOUND', message }` with a Spanish message indicating the template was not found. When the service returns `{ ok: true, template }`, the handler SHALL convert `template.content_json` to plain text using injected `tipTapDocToPlainTextAsync`, rendering variable nodes as `{{variableId}}` without resolving values. The success response MUST return `{ ok: true, data: { id, name, code, supplier_type, status, description, content } }` where `content` is the plain-text string.

The tool description MUST be in Spanish and MUST explain that the tool is for viewing the readable text content of a standard template; that the `id` is obtained from `listar_plantillas`; and that template variables appear as `{{...}}` placeholders without filled values.

`registerMcpTools` SHALL accept `tipTapDocToPlainTextAsync` in its dependencies object. `backend/mcpServer.mjs` SHALL import it from `./utils/tipTapPlainText` via `createRequire` and pass it to `registerMcpTools`.

#### Scenario: Get existing template content

- **WHEN** Claude invokes `obtener_plantilla` with a valid template id
- **THEN** the tool returns `ok: true` with `data.content` as plain text
- **AND** variable nodes in the template appear as `{{variableId}}` tokens in `data.content`
- **AND** `data` includes `id`, `name`, `code`, `supplier_type`, `status`, and `description`

#### Scenario: Template not found

- **WHEN** Claude invokes `obtener_plantilla` with a UUID that does not exist
- **THEN** the tool returns `ok: false` with code `NOT_FOUND`
- **AND** the message is in Spanish indicating the template was not found

#### Scenario: Tool listed in MCP catalog

- **WHEN** a client calls MCP `tools/list` on the incrementa-gestion MCP server
- **THEN** the response includes tool name `obtener_plantilla`

#### Scenario: obtener_plantilla uses injected tipTapDocToPlainTextAsync

- **WHEN** the `obtener_plantilla` handler converts template content
- **THEN** it calls the `tipTapDocToPlainTextAsync` function from deps rather than importing the utility directly inside the handler
