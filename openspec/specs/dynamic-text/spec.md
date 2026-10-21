# dynamic-text Specification

## Purpose
TBD - created by archiving change texto-dinamico-base. Update Purpose after archive.

## Requirements
### Requirement: Dynamic text catalog is the only backend source

`backend/services/dynamicTextCatalog.js` MUST export `DYNAMIC_TEXT_CATALOG` and `getDynamicTextDefinition(id)`. The catalog MUST contain exactly these two entries, and no others:

- `servicios_entregables`: `label` `Entregables (cláusula 2.3)`, `instruccion` `Escribe qué publicará el influencer: cantidad en palabras y en cifra, formato y red social de cada entregable.`, `ejemplos` in this order: `un (1) reel en Instagram`, `cinco (5) reels en TikTok y cuatro (4) reels en Facebook`, `dos (2) stories y un (1) reel en Instagram`.
- `cuentas_publicacion`: `label` `Cuentas de publicación (cláusula 2.5)`, `instruccion` `Escribe la cuenta del influencer en cada red social nombrada en los entregables.`, `ejemplos` in this order: `su cuenta de Instagram @danarebolledo`, `su cuenta de TikTok @danarebolledo y su cuenta de Facebook Dana Rebolledo`.

`getDynamicTextDefinition(id)` MUST return that entry for a catalog id and `undefined` for any other id. Instruction and example strings in the backend MUST be read from this catalog. `VARIABLE_META` labels for these ids MUST be the catalog `label` and MUST NOT be a second copy of the string.

#### Scenario: Known id returns the catalog entry

- **WHEN** `getDynamicTextDefinition('servicios_entregables')` is called
- **THEN** it returns the label, instruction, and three examples listed for that id

#### Scenario: Unknown id is undefined

- **WHEN** `getDynamicTextDefinition('evento_servicio')` is called
- **THEN** the result is `undefined`

### Requirement: Missing dynamic text field includes instruction, examples, and paragraph context

When `getVariableMeta(key).type` is `dynamic_text`, `resolveFieldDefinition` MUST add `instruccion`, `ejemplos`, and `contexto` to the field. `instruccion` and `ejemplos` MUST equal the catalog entry. `contexto` MUST be the plain text of the first `paragraph` node, in depth-first document order, that contains a `variable` node whose `variableId` is `key`.

Inside that paragraph the walk MUST follow `tipTapDocToPlainTextAsync`: text nodes are copied, a `hardBreak` is a newline, and a `variable` node becomes `{{id}}`, except the target id, which MUST be rendered as `⟨…⟩` (U+27E8, U+2026, U+27E9). The paragraph MUST NOT gain the `\n\n` separator used between blocks in the full document, and trailing whitespace of the paragraph MUST be stripped. If the id appears in more than one paragraph, only the first is used. If `templateDoc` is omitted, or no paragraph contains the id, `contexto` MUST be `null`. A `heading` MUST NOT be used as context.

`buildMissingFields` and `resolveFieldDefinition` MUST accept an optional `templateDoc` alongside `clientRow` and `supplierRow`. `generateAndPersist` MUST pass the materialized template document it already builds. Fields whose type is not `dynamic_text` MUST NOT include `instruccion`, `ejemplos`, or `contexto`.

#### Scenario: Dry run exposes the first paragraph with the hole marked

- **WHEN** `generateAndPersist` runs with `dryRun: true` and no overrides, and the template's paragraph plain text is `En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}} en el perfil oficial {{client_product_campaign}}.` with `servicios_entregables` as a variable node
- **THEN** the missing field for `servicios_entregables` has `type` `dynamic_text`, the catalog `instruccion` and `ejemplos` for that id, and `contexto` `En concreto, los Servicios comprenden la generación y publicación de ⟨…⟩ en el perfil oficial {{client_product_campaign}}.`

#### Scenario: Context is null without a template document

- **WHEN** `resolveFieldDefinition('cuentas_publicacion', {})` is called
- **THEN** the field has the catalog `instruccion` and `ejemplos` and `contexto` is `null`

#### Scenario: A second paragraph is ignored

- **WHEN** the same dynamic text id appears in two paragraphs
- **THEN** `contexto` is the plain text of the first paragraph only

### Requirement: Dynamic text is normalized and limited to 500 characters

Before `preprocessMissingFieldOverrides`, and after the existing price check, `generateAndPersist` MUST normalize every non-empty override whose variable type is `dynamic_text`. A value is non-empty when it is not `null` and `String(value)` is not `''`. Normalization MUST trim both ends and collapse every internal whitespace run, including newlines, to a single space (`String(value).trim().replace(/\s+/g, ' ')`).

If the normalized string's `length` is greater than 500, `generateAndPersist` MUST return `{ ok: false, status: 400, code: 'VALIDATION_ERROR', message }` and MUST NOT preprocess, persist, or upload. `message` MUST be exactly `El texto de «<label>» no puede superar los 500 caracteres.` using that id's catalog label. This MUST hold for `dryRun: true` and for a real generate. A normalized string of length 500 MUST pass. An absent or `''` override MUST skip this check. The normalized string MUST be the value that preprocessing, substitution, and `contract_overrides` receive. Commas and parentheses in that string MUST be kept. Preprocessing MUST NOT otherwise rewrite a `dynamic_text` value.

#### Scenario: Line breaks and double spaces are stored collapsed

- **WHEN** a real generate receives a `servicios_entregables` override that contains line breaks and repeated spaces
- **THEN** `contract_overrides.servicios_entregables` is that text with ends trimmed and every internal whitespace run replaced by one space

#### Scenario: 501 characters are rejected

- **WHEN** `generateAndPersist` receives a normalized-length 501 `servicios_entregables` value, with or without `dryRun`
- **THEN** the result is `ok: false`, `status` 400, `code` `VALIDATION_ERROR`, and `message` exactly `El texto de «Entregables (cláusula 2.3)» no puede superar los 500 caracteres.`
- **AND** nothing is inserted or uploaded

#### Scenario: 500 characters pass

- **WHEN** the only unresolved placeholder is `servicios_entregables` and the override normalizes to 500 characters
- **THEN** the result is not a `VALIDATION_ERROR` for length

#### Scenario: Punctuation is substituted unchanged

- **WHEN** a generate substitutes `cinco (5) reels en TikTok y cuatro (4) reels en Facebook`
- **THEN** the substituted document contains that string, including the commas and parentheses

### Requirement: Constructor asks for dynamic text in a textarea with a live preview

`MissingFieldInput` MUST be exported from `DocumentBuilderPage.jsx`. For `field.type === 'dynamic_text'` it MUST render:

- `field.instruccion` above the control
- a `<textarea>` of 3 rows with `className` `clause-input` and `maxLength` 500
- a counter whose text is `N / 500`, where `N` is the length of the current control value
- the text `Ejemplos:` followed by `field.ejemplos` as a list, with no control that copies an example into the textarea
- when `contexto` is a string, a preview that replaces `⟨…⟩` with the current value inside a highlighted span, or with `…` when the value is empty

The highlight MUST use `var(--color-selection)` and font-weight 600. Select, date, number, and text fields MUST keep their current controls.

#### Scenario: Empty dynamic text shows instruction, examples, and the hole

- **WHEN** `MissingFieldInput` receives a `dynamic_text` field with `instruccion`, `ejemplos`, and a `contexto` that contains `⟨…⟩`, and the value is empty
- **THEN** the textarea, the instruction, each example, and a preview containing `…` are visible
- **AND** the counter reads `0 / 500`

#### Scenario: Typing updates the preview and the counter

- **WHEN** the user types into that textarea
- **THEN** the preview shows the typed text in place of the hole and the counter shows the new length

#### Scenario: An example is not inserted on click

- **WHEN** the user clicks an example
- **THEN** the textarea value does not change

### Requirement: Template editor distinguishes dynamic text

`variableCatalog.js` group `contrato` MUST list `servicios_entregables` and `cuentas_publicacion` with `type: 'dynamic_text'`, the catalog `id` and `label`, and `description` equal to the catalog `instruccion`. Other catalog entries MUST NOT gain a `type`.

`VariableRenderer` MUST set `data-kind="dynamic_text"` on the chip when the catalog entry for that variable has `type: 'dynamic_text'`. `styles.module.css` MUST paint that chip with background `var(--color-form-field-readonly-bg)`, and border and text `var(--color-selection)`, overriding the group color. Hover MUST set border and text to `var(--color-main-headerbar)`. No new hex color MUST be introduced.

In `VariableCatalog.jsx`, each entry with `type: 'dynamic_text'` MUST show the label `Texto dinámico`.

#### Scenario: Editor chip is marked dynamic text

- **WHEN** the template editor renders the variable `servicios_entregables`
- **THEN** the chip has `data-kind` `dynamic_text`

#### Scenario: Catalog modal labels the type

- **WHEN** the user opens the variable catalog and sees `cuentas_publicacion`
- **THEN** the row shows `Texto dinámico` and the description is the catalog instruction for that id
