## MODIFIED Requirements

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
