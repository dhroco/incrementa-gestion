## MODIFIED Requirements

### Requirement: MCP tool validar_contrato

The server SHALL expose tool `validar_contrato` that calls `documentBuilderService.generateAndPersist` with `body.dryRun: true`. Parameters MUST include `companyId`, `supplierId`, and `template: { kind: 'standard', id }`; optional `missingFieldOverrides`; optional `clientId` as UUID string. When `clientId` is provided, it MUST be forwarded in the generate body so client variables participate in placeholder resolution.

The tool description MUST state clearly that this tool does NOT generate a PDF or persist any document—it only checks whether template variables can be resolved. The tool description MUST explain that when `ok` is false and `code` is `MISSING_PLACEHOLDERS`, the field `data.missingFields` contains missing fields with their `type`, optional `options`, optional `pairField`, and `source`.

The tool description MUST further explain:

- Source rules: `supplier` → update supplier in DB first; `client` → update client first; `company` → inform user; `contract` → pass in `missingFieldOverrides`.
- For `type: 'select'` with **more than one** option: it is **forbidden** to choose on the agent's own. The agent MUST list the options numbered and wait for an explicit user reply. The agent MUST NOT infer the choice from conversation context (including a product, brand, or campaign mentioned earlier). If the user's reply does not match an option **exactly**, the agent MUST ask again. Mapping to the closest option is forbidden (`Dryoff` and `DRYOFF` are distinct; the backend treats them as such). If the field has **exactly one** option, the agent MAY use it without asking.
- For `type: 'select'` with object options containing a `values` property, the agent MUST add ALL entries from `values` to `missingFieldOverrides` (the full pair), not only the field key.
- The `pairField` property indicates which secondary variable is auto-filled together with the primary; secondary fields never appear in `missingFields`.
- For `type: 'number'`, ask for a non-negative integer; backend formats thousands and may auto-generate paired text fields (e.g. `precio_texto` from `precio_numero`).

These description rules are a **prompt mitigation, not a control**. The backend receives a value, not a conversation, and MUST NOT be specified as verifying that the agent asked. The effective defense against a valid-but-wrong catalog choice remains draft → human signature. This MUST NOT replace catalog validation in `generateAndPersist`.

The handler MUST NOT add Zod or service-side checks that the conversation occurred. Schema and `generateAndPersist` behavior are unchanged by this description.

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

#### Scenario: Tool description forbids choosing a multi-option select

- **WHEN** the MCP server registers `validar_contrato`
- **THEN** the tool description forbids choosing a `type='select'` with more than one option on the agent's own
- **AND** it requires numbered options and an explicit user reply
- **AND** it forbids inferring the choice from conversation context
- **AND** it forbids mapping a non-exact reply to the closest option

### Requirement: MCP tool generar_contrato

The server SHALL expose tool `generar_contrato` that calls `documentBuilderService.generateAndPersist` without `dryRun`. Parameters MUST match the HTTP generate body (`companyId` as `requestedCompanyId`, `supplierId`, `template`, optional `missingFieldOverrides`, optional `overwrite`, optional `clientId` as UUID). When `clientId` is omitted, generation MUST proceed without client context.

The tool description MUST require, as a prerequisite before calling the tool, that the agent list to the user **all** values that will be used (`missingFieldOverrides`) and wait for explicit confirmation. The description MUST state that this is the last chance to catch a wrong value before it is printed on a PDF with legal effects.

This confirmation instruction is a **prompt mitigation, not a control**. The handler MUST NOT verify that confirmation occurred. Schema and `generateAndPersist` behavior are unchanged by this description. Catalog validation of select overrides remains the service's responsibility (Part 1).

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

#### Scenario: Tool description requires confirmation of overrides

- **WHEN** the MCP server registers `generar_contrato`
- **THEN** the tool description requires listing all `missingFieldOverrides` values to the user and waiting for explicit confirmation before calling the tool
