## ADDED Requirements

### Requirement: MCP tool revisar_redaccion

The server SHALL expose tool `revisar_redaccion` with the same parameters as `validar_contrato`. The handler MUST call `documentBuilderService.reviewDraft` without `dryRun`.

The tool description MUST state all of the following:

- use it when `validar_contrato` returns `dynamic_text` fields, once every field is complete, and before `generar_contrato`
- the result includes `reviewId`, `verdict`, and `observations`
- the agent shows the person each observation together with its suggestion
- the exact phrase `PROHIBIDO aplicar una sugerencia sin que la persona la acepte`
- if the person accepts, the agent passes that suggestion as the new dynamic-text value and calls `revisar_redaccion` again

This description is a prompt mitigation, not a control. The handler MUST NOT verify that the person saw or accepted a suggestion. Enforcement remains in `reviewDraft` and in the generate-time review gate.

#### Scenario: Tool exists and forbids applying a suggestion

- **WHEN** the MCP server registers `revisar_redaccion`
- **THEN** the tool description includes `PROHIBIDO aplicar una sugerencia sin que la persona la acepte`

#### Scenario: Handler calls reviewDraft

- **WHEN** Claude invokes `revisar_redaccion` with company, supplier, and standard template
- **THEN** the handler calls `reviewDraft` with that body and returns its `reviewId`, `verdict`, and `observations`

## MODIFIED Requirements

### Requirement: MCP tool generar_contrato

The server SHALL expose tool `generar_contrato` that calls `documentBuilderService.generateAndPersist` without `dryRun`. Parameters MUST match the HTTP generate body (`companyId` as `requestedCompanyId`, `supplierId`, `template`, optional `missingFieldOverrides`, optional `overwrite`, optional `clientId` as UUID, optional `reviewId` as string, optional `generarIgual` as `{ motivo: string }`). When `clientId` is omitted, generation MUST proceed without client context. When `reviewId` or `generarIgual` is provided, the handler MUST forward them on the generate body. The handler MUST NOT decide that a review is required and MUST NOT invent a motivo; `generateAndPersist` enforces that.

The tool description MUST require, as a prerequisite before calling the tool, that the agent list to the user **all** values that will be used (`missingFieldOverrides`) and wait for explicit confirmation. The description MUST state that this is the last chance to catch a wrong value before it is printed on a PDF with legal effects.

This confirmation instruction is a **prompt mitigation, not a control**. The handler MUST NOT verify that confirmation occurred. Catalog validation of select overrides remains the service's responsibility (Part 1). The review gate is also the service's responsibility.

Existing sentences of the description MUST stay byte-for-byte, including `confirmación explícita`. The description MUST end with additional text that states both of the following, without rewriting those sentences:

- when the contract has dynamic texts, generation requires the `reviewId` of the latest review of the current values
- `generarIgual` is used only when the person asks for it, and the motivo is dictated by the person, including the exact phrase `PROHIBIDO decidirlo o redactarlo por cuenta propia`

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
- **AND** the description still includes `confirmación explícita`

#### Scenario: Tool accepts reviewId and forbids inventing the motivo

- **WHEN** the MCP server registers `generar_contrato`
- **THEN** its parameters include optional `reviewId` and optional `generarIgual`
- **AND** the description includes `PROHIBIDO decidirlo o redactarlo por cuenta propia`

### Requirement: validar_contrato describes dynamic text

The `validar_contrato` tool description MUST include `dynamic_text` in the existing type list, which MUST read `type (text/date/select/number/dynamic_text)`. No other existing sentence of that description MUST change. Existing sentences of the `generar_contrato` description MUST stay; review rules are appended only, as specified by the `generar_contrato` requirement.

The `validar_contrato` description MUST end with a paragraph that states all of the following:

- a `dynamic_text` field brings `instruccion`, `ejemplos`, and `contexto`
- the agent shows the person the instruction, the examples, and the context, and asks for the literal text
- the agent is forbidden to draft, complete, correct, or infer that text on its own, even when the conversation suggests it
- if the person asks for help, the agent may propose a text and MUST use it only after the person approves it explicitly
- the approved text is passed in `missingFieldOverrides` as approved

That paragraph MUST include the exact phrase `PROHIBIDO redactarlo, completarlo, corregirlo o inferirlo por cuenta propia`.

This description is a prompt mitigation, not a control. The handler MUST NOT verify that the person dictated or approved the text.

#### Scenario: Description lists dynamic text and forbids drafting it

- **WHEN** the MCP server registers `validar_contrato`
- **THEN** the tool description includes `dynamic_text` and the phrase `PROHIBIDO redactarlo, completarlo, corregirlo o inferirlo por cuenta propia`

#### Scenario: Existing validation phrases remain

- **WHEN** the MCP server registers `validar_contrato`
- **THEN** the description still includes `NO genera PDF`, `PROHIBIDO elegir por cuenta propia`, and `pairField`

#### Scenario: generar_contrato keeps its confirmation sentence

- **WHEN** the MCP server registers `generar_contrato`
- **THEN** its description still includes `confirmación explícita`
- **AND** it also includes `PROHIBIDO decidirlo o redactarlo por cuenta propia`
