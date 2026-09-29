## ADDED Requirements

### Requirement: Contract reviewer calls Claude with a fixed system prompt

`backend/lib/contractReviewer.js` MUST export `createContractReviewer({ apiKey, client } = {})`, `isReviewerConfigured()`, and `ContractReviewerError`. With no arguments, the API key MUST be read from `ANTHROPIC_API_KEY` in `backend/config.js` and the client MUST be `new Anthropic({ apiKey })` from `@anthropic-ai/sdk`. An injected `client` MUST be used instead of constructing one. Constructing the reviewer without a key MUST NOT throw. `isReviewerConfigured()` MUST be false when no key and no `client` were provided, and true when a `client` is injected.

`review({ sectionText, dynamicTexts, datos })` MUST call `client.messages.parse` with `model: 'claude-opus-5'`, `max_tokens: 16000`, one `user` message whose text is the JSON of `{ sectionText, dynamicTexts, datos }`, and `output_config.format` set with `zodOutputFormat(ReviewSchema)` from `@anthropic-ai/sdk/helpers/zod` using the `zod` package the backend already depends on.

`ReviewSchema` MUST be an object with `verdict` enum `'ok' | 'observaciones'` and `observations`, an array of objects with string fields `dynamicTextId`, `clause`, `problem`, and `suggestion`.

The `system` string MUST be exactly:

```
Eres revisor de redacción de contratos de prestación de servicios de influencers, en español formal de Chile o México.
Recibes la sección SEGUNDO de un contrato ya completada (sectionText), los textos dinámicos que escribió una persona al crearlo (dynamicTexts, con su instrucción) y datos del contrato para contrastar (datos).
Revisa SOLO los textos dinámicos y cómo encajan en su cláusula. No opines sobre el resto del contrato.
Verifica:
1. Gramática y concordancia de la cláusula completa con el texto dinámico puesto: número, género y conectores.
2. Que las cantidades vayan en palabras y en cifra entre paréntesis, como "cinco (5)".
3. Que cada red social nombrada en los entregables esté entre datos.redesDelProveedor, y que la cláusula de cuentas nombre una cuenta para cada red de los entregables, y ninguna red que no esté en ellos.
4. Que el texto dinámico no agregue obligaciones, montos, plazos ni condiciones que no correspondan a lo que pide su instrucción.
5. Registro formal: sin abreviaturas, emojis ni lenguaje coloquial.
No inventes datos. Si falta información para decidir, dilo como observación.
Responde con verdict "ok" y observations vacía si no hay nada que corregir. Si hay algo, verdict "observaciones" y una observación por problema: dynamicTextId, clause (el número de cláusula, como "2.3"), problem (en una frase) y suggestion (el texto dinámico completo reescrito, listo para reemplazar al actual; nunca otra parte de la cláusula).
```

The return value MUST be `{ verdict, observations, model }` taken from `parsed_output`, with `model` equal to `'claude-opus-5'`. The API key MUST NOT appear in any thrown message or log.

#### Scenario: Parse is called with the model, the system prompt, and the input JSON

- **WHEN** `review` is called with a section, dynamic texts, and datos, and the injected client returns a parsed verdict
- **THEN** `messages.parse` receives `model: 'claude-opus-5'`, the exact system string above, and a user message with that JSON
- **AND** the result includes `model: 'claude-opus-5'`

### Requirement: Reviewer forces verdict and observations to agree

When `parsed_output.verdict` is `'ok'`, `review` MUST return `observations: []` even if the model sent observations. When `parsed_output.observations` has one or more items, `review` MUST return `verdict: 'observaciones'`.

#### Scenario: Ok with observations becomes observaciones

- **WHEN** the parsed output has `verdict: 'ok'` and a non-empty `observations` array
- **THEN** `review` returns `verdict: 'observaciones'` and those observations

#### Scenario: Ok without observations stays ok

- **WHEN** the parsed output has `verdict: 'ok'` and `observations: []`
- **THEN** `review` returns `verdict: 'ok'` and `observations: []`

### Requirement: Reviewer failure is REVIEW_UNAVAILABLE

`review` MUST throw `ContractReviewerError` with `code: 'REVIEW_UNAVAILABLE'` when `stop_reason` is `'refusal'`, when `parsed_output` is `null`, or when the SDK throws. The error message MUST NOT contain the API key.

#### Scenario: Refusal

- **WHEN** `messages.parse` returns `stop_reason: 'refusal'`
- **THEN** `review` throws `ContractReviewerError` with `code: 'REVIEW_UNAVAILABLE'`

#### Scenario: Null parsed output

- **WHEN** `messages.parse` returns `parsed_output: null`
- **THEN** `review` throws `ContractReviewerError` with `code: 'REVIEW_UNAVAILABLE'`

#### Scenario: SDK exception

- **WHEN** `messages.parse` throws
- **THEN** `review` throws `ContractReviewerError` with `code: 'REVIEW_UNAVAILABLE'`
- **AND** the error message does not contain the API key

### Requirement: Review input is the substituted SEGUNDO section and contrast data only

`backend/services/contractReviewInput.js` MUST export pure functions used by both `reviewDraft` and the generate-time check. The input object MUST be `{ sectionText, dynamicTexts, datos }` with keys in that order.

`sectionText` MUST be the plain text of the already substituted document, from the block whose trimmed text starts with `SEGUNDO` through the block before the one whose trimmed text starts with `TERCERO`. Blocks are `paragraph` and `heading` nodes in document order. Their plain text MUST use the same node walk as `tipTapDocToPlainTextAsync`, and the selected blocks MUST be joined with `\n\n`. If either marker is missing, `sectionText` MUST instead be every `paragraph` whose trimmed text starts with `2.` followed by a digit, joined the same way.

`dynamicTexts` MUST list each template variable whose type is `dynamic_text`, in order of first appearance, as `{ id, label, instruccion, value }` with keys in that order. `label` and `instruccion` MUST come from the dynamic-text catalog. `value` MUST be the normalized override.

`datos` MUST be `{ redesDelProveedor, mes_ejecucion, fecha_contrato }` and MUST NOT include any other key. `redesDelProveedor` MUST be `[{ red, cuenta }]` mapped from `supplier.social_networks` (`name` to `red`, `account_name` to `cuenta`) in supplier order, or `null` when the supplier has no networks. `mes_ejecucion` and `fecha_contrato` MUST be the normalized overrides, or `null` when absent. The input MUST NOT contain a RUT, an address, or a price.

`input_hash` MUST be the hex sha256 of `JSON.stringify` of that object with the key order above and no added whitespace.

#### Scenario: Reviewer input excludes RUT, address, and price

- **WHEN** `reviewDraft` calls the reviewer for a template that has `{{servicios_entregables}}` and `{{cuentas_publicacion}}` in SEGUNDO
- **THEN** the object passed to `review` has `sectionText`, `dynamicTexts`, and `datos` only
- **AND** it does not contain a RUT, an address, or a price
- **AND** each dynamic text includes `id`, `label`, `instruccion`, and the normalized `value`

#### Scenario: Missing section markers fall back to numbered paragraphs

- **WHEN** the substituted document has no block starting with `SEGUNDO` or no block starting with `TERCERO`
- **THEN** `sectionText` is the plain text of the paragraphs whose trimmed text starts with `2.` followed by a digit

### Requirement: reviewDraft persists the verdict

`createDocumentBuilderService` MUST accept `contractReviewer`. `reviewDraft({ userId, requestedCompanyId, body })` MUST take the same body as `generateAndPersist` and MUST follow the same path as `dryRun` through validation, preprocessing, and substitution. It MUST NOT upload to GCS and MUST NOT write `draft_document`.

When the template has at least one `dynamic_text` and the reviewer returns a verdict, `reviewDraft` MUST insert one `contract_review` row with the hash, verdict, observations, reviewed text, and model, and MUST return `{ ok: true, data: { reviewId, verdict, observations } }`.

Missing placeholders MUST return the same 422 `MISSING_PLACEHOLDERS` result as `dryRun`.

#### Scenario: reviewDraft stores the row and returns the verdict

- **WHEN** `reviewDraft` runs with every placeholder resolved on a template that has dynamic text, and the reviewer returns `ok`
- **THEN** a `contract_review` row is inserted
- **AND** the result is `{ ok: true, data: { reviewId, verdict: 'ok', observations: [] } }`

### Requirement: reviewDraft rejects a review that is not needed or not available

When the template has no `dynamic_text` variable, `reviewDraft` MUST return `{ ok: false, status: 400, code: 'REVIEW_NOT_NEEDED', message: 'Esta plantilla no tiene textos dinámicos que revisar.' }` and MUST NOT call the reviewer.

When the reviewer is not configured or `review()` throws, `reviewDraft` MUST return `{ ok: false, status: 503, code: 'REVIEW_UNAVAILABLE', message: 'No se pudo revisar la redacción en este momento. Intenta de nuevo en unos minutos.' }`.

#### Scenario: Template without dynamic text

- **WHEN** `reviewDraft` runs for a template with no `dynamic_text` variable
- **THEN** the result is status 400, code `REVIEW_NOT_NEEDED`, and the message `Esta plantilla no tiene textos dinámicos que revisar.`

#### Scenario: Reviewer missing

- **WHEN** `reviewDraft` runs for a template with dynamic text and no configured reviewer
- **THEN** the result is status 503, code `REVIEW_UNAVAILABLE`, and the message `No se pudo revisar la redacción en este momento. Intenta de nuevo en unos minutos.`

### Requirement: Generating with dynamic text requires a review of the current values

`generateAndPersist` without `dryRun`, and only when the template has at least one `dynamic_text`, MUST require `body.reviewId` after substitution and before building the PDF. The review row MUST exist and MUST match the current company, supplier, template, and the `input_hash` recomputed from the same substituted document. Otherwise it MUST return `{ ok: false, status: 409, code: 'REVIEW_REQUIRED', message: 'Revisa la redacción antes de generar: no hay una revisión de los textos actuales.' }` and MUST NOT upload a PDF.

`dryRun: true` MUST NOT require `reviewId`. A template with no `dynamic_text` MUST generate without `reviewId`, as it does today.

The substitution used for the hash MUST run before the overwrite deletion of a previous draft, so a rejected review does not delete that draft. The existing `DUPLICATE_DRAFT` return when `overwrite` is not `true` MUST stay before generation and MUST NOT require a review.

#### Scenario: Generate without reviewId

- **WHEN** `generateAndPersist` runs without `dryRun` on a template with dynamic text and without `reviewId`
- **THEN** the result is status 409 and code `REVIEW_REQUIRED`

#### Scenario: Review of different values

- **WHEN** `generateAndPersist` receives a `reviewId` whose stored hash is not the hash of the current substituted input
- **THEN** the result is status 409 and code `REVIEW_REQUIRED`

#### Scenario: Template without dynamic text still generates

- **WHEN** `generateAndPersist` runs without `dryRun` and without `reviewId` on a template with no `dynamic_text`
- **THEN** generation succeeds without a review

### Requirement: Observations require an explicit override reason

When the matching review has `verdict: 'observaciones'`, `generateAndPersist` MUST require `body.generarIgual.motivo` whose `trim()` length is at least 10. If it is missing or shorter, the result MUST be `{ ok: false, status: 409, code: 'REVIEW_HAS_OBSERVATIONS', message: 'La revisión tiene observaciones. Corrige el texto o usa «Generar igual» indicando el motivo.' }` and MUST NOT persist a draft.

When the motivo is valid, the inserted `draft_document` MUST store `review_id` and `review_override_reason` equal to that trimmed motivo. When the verdict is `'ok'`, the inserted row MUST store `review_id` and `review_override_reason` MUST be null.

#### Scenario: Observations without a motivo

- **WHEN** the matching review verdict is `observaciones` and `generarIgual` is omitted
- **THEN** the result is status 409 and code `REVIEW_HAS_OBSERVATIONS`

#### Scenario: Motivo of nine characters

- **WHEN** the matching review verdict is `observaciones` and the trimmed motivo has length 9
- **THEN** the result is status 409 and code `REVIEW_HAS_OBSERVATIONS`

#### Scenario: Valid motivo is stored

- **WHEN** the matching review verdict is `observaciones` and the trimmed motivo has length 10 or more
- **THEN** generation succeeds
- **AND** the draft stores `review_id` and `review_override_reason`

#### Scenario: Ok review stores review_id only

- **WHEN** the matching review verdict is `ok`
- **THEN** generation succeeds
- **AND** the draft stores `review_id` and a null `review_override_reason`

### Requirement: contract_review table and draft columns

Migration `backend/migrations/202609290002_contract_review.js` MUST create table `contract_review` with uuid `id`, `company_id`, `supplier_id`, `template_id`, and `created_by` using the same types and foreign keys as `draft_document`; `input_hash` text not null; `verdict` text not null with a check of `IN ('ok','observaciones')`; `observations` jsonb not null default `'[]'`; `reviewed_text` text not null; `model` text not null; and `created_at` timestamptz not null default `now()`.

It MUST add nullable `draft_document.review_id` (foreign key to `contract_review`, `ON DELETE RESTRICT`) and nullable `draft_document.review_override_reason` text. `down` MUST drop those two columns and then the table. This change MUST NOT run the migration.

#### Scenario: Down reverses both changes

- **WHEN** `down` runs after `up`
- **THEN** `draft_document` no longer has `review_id` or `review_override_reason`
- **AND** table `contract_review` does not exist

### Requirement: Review HTTP route

The app MUST expose `POST /api/document-builder/review` with `authorize('use', 'DocumentBuilder')`. The handler in `documentBuilderController.js` MUST call `reviewDraft` the same way `postGenerate` calls `generateAndPersist`. `POST /api/document-builder/generate` MUST accept `reviewId` and `generarIgual: { motivo }` on the body and pass them through.

#### Scenario: Authorized review call

- **WHEN** an authorized client posts the generate body to `/api/document-builder/review`
- **THEN** the controller calls `reviewDraft` with that body and the query `companyId`

### Requirement: Constructor shows a review step only for dynamic text

When any missing field has `type === 'dynamic_text'`, `DocumentBuilderPage.jsx` MUST show a step labeled `Revisar redacción` between the missing fields and the existing generate button. While the request is in flight the button MUST show `Revisando…` and MUST be disabled.

After a verdict of `ok`, the page MUST show `Sin observaciones` and the existing generate button (`Generar PDF y guardar`) MUST become enabled and MUST send `reviewId`.

After `observaciones`, the page MUST list each observation with the dynamic text `label`, the clause, the problem, and the suggestion, plus a `Usar sugerencia` button. That button MUST set the suggestion as the value of that dynamic text and MUST clear the displayed review. Below the list, `Generar igual` MUST reveal a textarea and MUST generate with `generarIgual` only when the trimmed motivo has at least 10 characters.

Any change to a missing field MUST clear the displayed review. Codes `REVIEW_REQUIRED`, `REVIEW_HAS_OBSERVATIONS`, and `REVIEW_UNAVAILABLE` MUST be shown with their response message.

When no missing field has `type === 'dynamic_text'`, the page MUST NOT show the review step and the generate button MUST keep today's label and enablement.

Buttons MUST use the existing `.btn` class. The motivo textarea MUST use `clause-input`. No new color or radius is introduced.

#### Scenario: Ok enables generate

- **WHEN** a missing field is `dynamic_text` and the review API returns `ok`
- **THEN** the page shows `Sin observaciones`
- **AND** `Generar PDF y guardar` is enabled

#### Scenario: Use suggestion clears the review

- **WHEN** the review returns an observation and the user activates `Usar sugerencia`
- **THEN** that dynamic text value becomes the suggestion
- **AND** the displayed review is cleared

#### Scenario: Generar igual sends the motivo

- **WHEN** the review has observations and the user submits `Generar igual` with a motivo of at least 10 characters
- **THEN** generate is called with `reviewId` and `generarIgual.motivo`

#### Scenario: No dynamic text hides the step

- **WHEN** no missing field has `type === 'dynamic_text'`
- **THEN** `Revisar redacción` is not shown
