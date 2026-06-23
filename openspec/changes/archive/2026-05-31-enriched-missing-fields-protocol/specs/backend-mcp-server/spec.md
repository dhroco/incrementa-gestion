## MODIFIED Requirements

### Requirement: MCP tool validar_contrato

The server SHALL expose tool `validar_contrato` that calls `documentBuilderService.generateAndPersist` with `body.dryRun: true`. Parameters MUST include `companyId`, `supplierId`, and `template: { kind: 'standard', id }`; optional `missingFieldOverrides`; optional `clientId` as UUID string. When `clientId` is provided, it MUST be forwarded in the generate body so client variables participate in placeholder resolution. The tool description MUST state clearly that this tool does NOT generate a PDF or persist any document—it only checks whether template variables can be resolved. The tool description MUST further explain that when `ok` is false and `code` is `MISSING_PLACEHOLDERS`, the field `data.missingFields` contains missing fields with their `type`: for `type: 'select'`, Claude MUST present `options` to the user and ask them to choose before calling `generar_contrato` with the value in `missingFieldOverrides`; for `type: 'text'`, ask for free text; for `type: 'date'`, ask for a date.

#### Scenario: Validation succeeds

- **WHEN** all template placeholders resolve for the given supplier, company, and optional client
- **THEN** the tool returns `ok: true` with `valid: true` and no GCS or database writes occur

#### Scenario: Validation with clientId

- **WHEN** Claude invokes `validar_contrato` with valid `clientId` and templates reference `client_brand`
- **THEN** client fields are loaded and included in substitution checks

#### Scenario: Missing placeholders reported with enriched fields

- **WHEN** template variables cannot be resolved
- **THEN** the tool returns `ok: false` with code `MISSING_PLACEHOLDERS` and `data.missingFields` as an array of `{ key, label, type, options? }`
- **AND** the response does NOT include `missingFieldKeys`
