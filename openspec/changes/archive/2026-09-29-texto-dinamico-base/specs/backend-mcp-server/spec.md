## ADDED Requirements

### Requirement: validar_contrato describes dynamic text

The `validar_contrato` tool description MUST include `dynamic_text` in the existing type list, which MUST read `type (text/date/select/number/dynamic_text)`. No other existing sentence of that description MUST change. The description of `generar_contrato` MUST NOT change.

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

#### Scenario: generar_contrato description is untouched

- **WHEN** the MCP server registers `generar_contrato`
- **THEN** its description still includes `confirmación explícita` and does not add a dynamic-text rule
