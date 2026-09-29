## ADDED Requirements

### Requirement: Contract reviewer calls Claude with the fixed system prompt

`backend/lib/contractReviewer.js` MUST export `createContractReviewer({ apiKey, client } = {})`, `isReviewerConfigured()`, and `ContractReviewerError`. With no arguments, `apiKey` MUST come from `ANTHROPIC_API_KEY` in `backend/config.js` and `client` MUST be `new Anthropic({ apiKey })` from `@anthropic-ai/sdk`. A passed `client` MUST be used instead of constructing one. Constructing the reviewer MUST NOT call the network.

`review({ sectionText, dynamicTexts, datos })` MUST call `client.messages.parse` with `model` `claude-opus-5`, `max_tokens` 16000, the system text below exactly, one user message whose text is the JSON of `{ sectionText, dynamicTexts, datos }`, and `output_config.format` set to `zodOutputFormat(ReviewSchema)` from `@anthropic-ai/sdk/helpers/zod` using the `zod` already depended on by the backend.

`ReviewSchema` MUST require `verdict` of `ok` or `observaciones`, and `observations` as an array of objects whose `dynamicTextId`, `clause`, `problem`, and `suggestion` are strings.

The system text MUST be exactly:

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

#### Scenario: The call uses the model, the system text, and the input JSON

- **WHEN** `review` is called with a fake `client` and an input object
- **THEN** `messages.parse` receives `model` `claude-opus-5`, the system text above, and a user message with the JSON of that input

### Requirement: Verdict and observations cannot contradict

`review` MUST return `parsed_output` reconciled as follows. If `observations` has one or more items, `verdict` MUST be `observaciones` and those items MUST be kept. If `observations` is empty, `verdict` MUST be `ok` and `observations` MUST be `[]`. The returned `model` MUST be the response `model` when it is a non-empty string, and MUST be `claude-opus-5` otherwise.

#### Scenario: ok plus observations becomes observaciones

- **WHEN** `parsed_output` has `verdict` `ok` and a non-empty `observations` array
- **THEN** `review` returns `verdict` `observaciones` and that same array

#### Scenario: An empty list forces ok

- **WHEN** `parsed_output` has `verdict` `observaciones` and `observations` `[]`
- **THEN** `review` returns `verdict` `ok` and `observations` `[]`

### Requirement: Reviewer failures hide the API key

If `stop_reason` is `refusal`, if `parsed_output` is `null`, or if the SDK throws, `review` MUST throw `ContractReviewerError` with `code` `REVIEW_UNAVAILABLE`. The error message MUST NOT contain the API key. `isReviewerConfigured()` MUST be false when no key and no `client` are available, and `review` MUST throw that same error without calling the network.

#### Scenario: Refusal, null output, and a thrown SDK error

- **WHEN** the fake client returns `stop_reason` `refusal`, or `parsed_output` `null`, or throws
- **THEN** each case throws `ContractReviewerError` with `code` `REVIEW_UNAVAILABLE`

#### Scenario: The key is absent from the error

- **WHEN** `review` fails and the key was passed as `apiKey`
- **THEN** the error message and the error string do not contain that key

### Requirement: contract_review stores one review and the draft points at it

Migration `backend/migrations/202609290002_contract_review.js` MUST create table `contract_review` with `id` uuid primary key default `gen_random_uuid()`, `company_id`, `supplier_id`, and `template_id` using the same types and foreign keys as `draft_document` (`company` and `supplier` `ON DELETE CASCADE`, `template` `ON DELETE RESTRICT`), and `created_by` uuid NOT NULL referencing `user_profile.id` `ON DELETE RESTRICT`. It MUST also add `input_hash` text NOT NULL, `verdict` text NOT NULL with a check of `ok` or `observaciones`, `observations` jsonb NOT NULL default `'[]'`, `reviewed_text` text NOT NULL, `model` text NOT NULL, and `created_at` timestamptz NOT NULL default `now()`.

The same migration MUST add nullable `draft_document.review_id` referencing `contract_review.id` `ON DELETE NO ACTION` and nullable `draft_document.review_override_reason` text. `down` MUST drop those two columns and then drop `contract_review`. This change MUST NOT run the migration. `NO ACTION` still blocks deleting a review while a draft cites it, and it is checked at the end of the statement so a cascading delete of the company or the supplier can remove the review and the draft together.

#### Scenario: down reverses both changes

- **WHEN** `down` runs after `up`
- **THEN** `draft_document` no longer has `review_id` or `review_override_reason`, and `contract_review` does not exist

### Requirement: Review input is the SEGUNDO section, the dynamic texts, and three contrast fields

Pure functions, shared by `reviewDraft` and by the generate check, MUST build `{ sectionText, dynamicTexts, datos }` and `input_hash`.

`sectionText` MUST be the plain text of the already substituted document from the first top-level block whose trimmed text starts with `SEGUNDO` through the block before the first whose trimmed text starts with `TERCERO`. If either marker is missing, `sectionText` MUST be the plain text of every paragraph whose trimmed text starts with `2.` followed by a digit. Block text MUST follow `tipTapDocToPlainTextAsync`.

`dynamicTexts` MUST list each template variable whose `getVariableMeta` type is `dynamic_text`, in first-appearance depth-first order, as `{ id, label, instruccion, value }` using the catalog `label` and `instruccion` and the normalized value.

`datos` MUST be `{ redesDelProveedor, mes_ejecucion, fecha_contrato }` and nothing else. `redesDelProveedor` MUST map `supplier.social_networks` in stored order to `{ red, cuenta }` from `name` and `account_name`, using `null` when that string is missing, or `[]` when the supplier has no networks. `mes_ejecucion` and `fecha_contrato` MUST come from the preprocessed overrides, or `null` when absent or blank.

`input_hash` MUST be the hex sha256 of the UTF-8 JSON of `{ sectionText, dynamicTexts, datos }` with keys in that order. The payload MUST NOT include a RUT, an address, or a price.

#### Scenario: The reviewer payload has no RUT, address, or price

- **WHEN** `reviewDraft` calls the fake reviewer for a supplier that has a RUT and an address and a contract that has a price
- **THEN** the object passed to `review` contains only `sectionText`, `dynamicTexts`, and `datos`, and its JSON does not contain that RUT, that address, or that price

### Requirement: reviewDraft persists the verdict

`createDocumentBuilderService` MUST accept `contractReviewer`. `reviewDraft({ userId, requestedCompanyId, body })` MUST take the same body as `generateAndPersist` and MUST run the same validations, preprocessing, and substitution. It MUST NOT upload, MUST NOT detect duplicate drafts, and MUST NOT insert into `draft_document`.

When the template has at least one `dynamic_text` and the reviewer returns, `reviewDraft` MUST insert one `contract_review` row with the shared `input_hash`, the reconciled `verdict` and `observations`, `reviewed_text` equal to `sectionText`, the returned `model`, and the same `company_id`, `supplier_id`, `template_id`, and `created_by` the draft would use. It MUST return `{ ok: true, data: { reviewId, verdict, observations } }`. A body with `dryRun: true` MUST still substitute, call the reviewer, and insert that row. It MUST NOT return the dry-run `{ valid: true }` payload.

#### Scenario: A review row is stored and returned

- **WHEN** `reviewDraft` runs with a template that has `dynamic_text` and a fake reviewer that returns `ok`
- **THEN** the result is `ok: true` with that `verdict` and a `reviewId`, and the inserted row has the matching `input_hash`, `reviewed_text`, and `model`

#### Scenario: A dry run body still reviews

- **WHEN** `reviewDraft` runs with `dryRun: true` on a template that has `dynamic_text`
- **THEN** the reviewer is called, a `contract_review` row is inserted, and the result is that review rather than `{ valid: true }`

### Requirement: reviewDraft rejects missing fields, templates without dynamic text, and an unavailable reviewer

If placeholders are missing, `reviewDraft` MUST return the same 422 `MISSING_PLACEHOLDERS` result as a dry run. If the template has no `dynamic_text` variable, it MUST return `{ ok: false, status: 400, code: 'REVIEW_NOT_NEEDED', message: 'Esta plantilla no tiene textos dinámicos que revisar.' }` and MUST NOT call the reviewer. If the reviewer is not configured or `review` throws, it MUST return `{ ok: false, status: 503, code: 'REVIEW_UNAVAILABLE', message: 'No se pudo revisar la redacción en este momento. Intenta de nuevo en unos minutos.' }` and MUST NOT insert a row.

#### Scenario: A template without dynamic text is not reviewed

- **WHEN** `reviewDraft` runs for a template that has no `dynamic_text` variable
- **THEN** the result is status 400, code `REVIEW_NOT_NEEDED`, and message `Esta plantilla no tiene textos dinámicos que revisar.`

#### Scenario: A missing reviewer is unavailable

- **WHEN** `reviewDraft` runs for a template with `dynamic_text` and the reviewer is not configured
- **THEN** the result is status 503, code `REVIEW_UNAVAILABLE`, and message `No se pudo revisar la redacción en este momento. Intenta de nuevo en unos minutos.`

### Requirement: Generating with dynamic text requires a review of the current values

When `generateAndPersist` is not a dry run and the template has at least one `dynamic_text`, it MUST require `body.reviewId` after substitution and before building the PDF, using the shared hash of that substituted document. The `contract_review` row MUST exist for the same company, supplier, and template and MUST have that `input_hash`. Otherwise it MUST return `{ ok: false, status: 409, code: 'REVIEW_REQUIRED', message: 'Revisa la redacción antes de generar: no hay una revisión de los textos actuales.' }` and MUST NOT build the PDF, upload, or insert a draft. Duplicate replacement MUST NOT run before this check passes.

`body.dryRun === true` MUST keep the current success and `MISSING_PLACEHOLDERS` behavior and MUST NOT require `reviewId`.

#### Scenario: Generate without reviewId is rejected

- **WHEN** a real generate uses a template with `dynamic_text` and omits `reviewId`
- **THEN** the result is status 409, code `REVIEW_REQUIRED`, and message `Revisa la redacción antes de generar: no hay una revisión de los textos actuales.`
- **AND** nothing is inserted or uploaded

#### Scenario: A review of different values is rejected

- **WHEN** `reviewId` points at a review for the same company, supplier, and template whose `input_hash` was computed with a different dynamic text
- **THEN** the result is status 409 and code `REVIEW_REQUIRED`

#### Scenario: Dry run does not require a review

- **WHEN** `generateAndPersist` is called with `dryRun: true` on a template with `dynamic_text` and no `reviewId`
- **THEN** the result is not `REVIEW_REQUIRED`

### Requirement: Observations can be overridden only with a recorded reason

If the matching review has `verdict` `observaciones`, `generateAndPersist` MUST require `body.generarIgual.motivo` whose `trim` length is at least 10. A missing motivo, or one whose trimmed length is 9 or less, MUST return `{ ok: false, status: 409, code: 'REVIEW_HAS_OBSERVATIONS', message: 'La revisión tiene observaciones. Corrige el texto o usa «Generar igual» indicando el motivo.' }` and MUST NOT persist a draft.

When the motivo is valid, the inserted `draft_document` MUST store `review_id` and `review_override_reason` equal to the trimmed motivo. When the matching verdict is `ok`, the insert MUST store `review_id` and `review_override_reason` null.

A template with no `dynamic_text` MUST generate without `reviewId`, and the insert MUST leave `review_id` and `review_override_reason` null.

Normalized dynamic text MUST still be what `contract_overrides` and `content_snapshot` store. A `servicios_entregables` value of `'  cinco (5) reels\n\nen   TikTok  '` MUST be stored as `'cinco (5) reels en TikTok'`. A value that contains commas and parentheses MUST appear unchanged in `content_snapshot`.

#### Scenario: Nine characters are not enough

- **WHEN** the matching review is `observaciones` and the trimmed motivo has length 9
- **THEN** the result is status 409 and code `REVIEW_HAS_OBSERVATIONS`

#### Scenario: A valid motivo is stored with the review

- **WHEN** the matching review is `observaciones` and the trimmed motivo has length 10 or more
- **THEN** the draft is generated and the inserted row has that `review_id` and `review_override_reason` equal to the trimmed motivo

#### Scenario: An ok review is stored without a motivo

- **WHEN** the matching review is `ok` and `generarIgual` is omitted
- **THEN** the draft is generated with that `review_id` and `review_override_reason` null

#### Scenario: A template without dynamic text generates as before

- **WHEN** a real generate uses a template with no `dynamic_text` and omits `reviewId`
- **THEN** the result is `ok: true` and the draft row has `review_id` null

#### Scenario: Line breaks are collapsed on a reviewed generate

- **WHEN** a real generate with a matching `ok` review receives `servicios_entregables` `'  cinco (5) reels\n\nen   TikTok  '`
- **THEN** `contract_overrides.servicios_entregables` is `'cinco (5) reels en TikTok'`

### Requirement: Review is an authorized document-builder route

The app MUST expose `POST /api/document-builder/review` with `authorize('use', 'DocumentBuilder')`. The controller MUST call `reviewDraft` with `req.auth.userId`, `req.query.companyId`, and `req.body`, the same way `postGenerate` calls `generateAndPersist`. `POST /api/document-builder/generate` MUST accept `reviewId` and `generarIgual`.

`app.js` and `mcpServer.mjs` MUST inject `contractReviewer` into `createDocumentBuilderService`.

#### Scenario: The review route uses the document builder ability

- **WHEN** the app registers document-builder routes
- **THEN** `POST /api/document-builder/review` is behind `authorize('use', 'DocumentBuilder')`

### Requirement: The constructor reviews dynamic text before generate

When any missing field has `type` `dynamic_text`, `DocumentBuilderPage.jsx` MUST show a step between those fields and the existing generate button. The generate button label MUST remain `Generar PDF y guardar`. When no missing field has that type, the page MUST NOT show the step and MUST keep the current `canGenerate` rule.

The step MUST include a `Revisar redacción` button that posts the same generate body to the review route. While the request is in flight the button MUST show `Revisando…` and MUST be disabled. On `ok` the page MUST show `Sin observaciones` and enable `Generar PDF y guardar`, and generate MUST send `reviewId`. On `observaciones` the page MUST list each observation with the dynamic text `label`, the clause, the problem, and the suggestion, and MUST show `Usar sugerencia`. That button MUST set the suggestion as the value of that dynamic text. `Generar igual` MUST reveal a motivo textarea and MUST generate with `generarIgual` only when the trimmed motivo has at least 10 characters. `Generar PDF y guardar` MUST stay disabled while the current review has observations. If that generate returns `DUPLICATE_DRAFT`, confirming the replacement MUST resend `overwrite`, the same `reviewId`, and `generarIgual.motivo`.

Any change to a missing field MUST clear the shown review. If that change happens while a review request is in flight, the page MUST discard that response and MUST NOT show its verdict. The page MUST show the response message for `REVIEW_REQUIRED`, `REVIEW_HAS_OBSERVATIONS`, and `REVIEW_UNAVAILABLE`. Buttons MUST use the existing `btn` class. The motivo control MUST use `clause-input`. No new hex color MUST be introduced.

#### Scenario: An ok review enables generate

- **WHEN** the page has a `dynamic_text` field and the review API returns `ok`
- **THEN** `Sin observaciones` is visible and `Generar PDF y guardar` is enabled

#### Scenario: Using a suggestion clears the review

- **WHEN** the review API returns an observation and the user activates `Usar sugerencia`
- **THEN** that dynamic text value becomes the suggestion and the shown review is cleared

#### Scenario: Generar igual sends the motivo

- **WHEN** the user enters a motivo of at least 10 characters and activates `Generar igual`
- **THEN** generate is called with that `reviewId` and `generarIgual.motivo`

#### Scenario: Replacing a duplicate resends the motivo

- **WHEN** `Generar igual` with a motivo of at least 10 characters receives `DUPLICATE_DRAFT` and the user confirms the replacement
- **THEN** the next generate sends `overwrite`, the same `reviewId`, and `generarIgual.motivo`

#### Scenario: A field edit discards an in-flight review

- **WHEN** the user changes a missing field while the review request is still in flight and that request later returns `ok`
- **THEN** `Sin observaciones` is not shown and `Generar PDF y guardar` stays disabled

#### Scenario: Without dynamic text the step is absent

- **WHEN** the missing fields have no `dynamic_text` type
- **THEN** `Revisar redacción` is not shown
