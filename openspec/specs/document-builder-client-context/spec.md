# document-builder-client-context Specification

## Purpose
TBD - created by archiving change modulo-clientes. Update Purpose after archive.
## Requirements
### Requirement: Draft document client reference

Migration `202606010003_add_client_to_draft_document.js` MUST add nullable column `draft_document.client_id` UUID referencing `client.id` with `ON DELETE SET NULL` and an index on `client_id`. New draft inserts from document generation MUST set `client_id` when a valid client was supplied; otherwise NULL. Existing draft list APIs MUST NOT expose `client_id` in list responses (field stored only for generation context).

#### Scenario: Persist client on generate

- **WHEN** document generation succeeds with optional `clientId` referencing an existing client
- **THEN** the inserted or updated `draft_document` row has `client_id` equal to that client id

#### Scenario: Generate without client

- **WHEN** document generation succeeds without `clientId` in the body
- **THEN** the `draft_document` row has `client_id` NULL

### Requirement: Document Builder optional client selection

The Document Builder UI MUST show an optional client selection step after the supplier is selected (`stage1Ok`) and before template selection. The user MUST be able to proceed without selecting a client. The selected `clientId` MUST be sent in the body of `postDocumentBuilderGenerate` when present. The UI MUST load clients via `fetchClientsList` from `clientsApi.js`.

#### Scenario: Client step appears after supplier

- **WHEN** an authorized user has selected company and supplier in Document Builder
- **THEN** a client selector is visible before template selection
- **AND** the user may leave client unselected

#### Scenario: Generate includes clientId

- **WHEN** the user selects a client and generates a document
- **THEN** the generate request body includes `clientId` equal to the selected client uuid

### Requirement: Client variable substitution

`buildSubstitutionMap` in `documentBuilderVariableContext.js` MUST accept signature `(supplier, company, client, overrides)` where `client` may be null. When client is provided, the map MUST define:

- `client_name` → `client.name`
- `client_brand` → `client.brand`
- `client_brand_account` → `client.brand_account`

The map MUST also define `client_product_campaign` with base value empty string (`''`). The resolved value MUST come only from `overrides.client_product_campaign` when present; it MUST NOT be auto-filled from `client.product_campaigns`. When `client` is null, client keys MUST not resolve to client data (empty or undefined per existing placeholder engine behavior). All callers in `documentBuilderService.js` MUST pass the loaded client row or `null`.

#### Scenario: Substitution with client

- **WHEN** a template contains `{{client_brand}}` and generation runs with client brand "Marca X"
- **THEN** the generated document text contains "Marca X"

#### Scenario: Substitution without client

- **WHEN** generation runs without `clientId` and the template contains `{{client_name}}`
- **THEN** the placeholder is unresolved or empty per existing engine behavior unless overridden via `missingFieldOverrides`

#### Scenario: Product campaign requires override

- **WHEN** a template contains `{{client_product_campaign}}` and generation runs without `missingFieldOverrides.client_product_campaign`
- **THEN** `client_product_campaign` is reported as a missing field

#### Scenario: Product campaign resolved via override

- **WHEN** generation runs with `missingFieldOverrides.client_product_campaign: 'Verano 2026'`
- **THEN** the generated document text contains "Verano 2026"

### Requirement: Variable catalog client group

The frontend variable catalog in `frontend/src/data/variableCatalog.js` MUST define group `client` with variables `client_name`, `client_brand`, `client_brand_account`, and `client_product_campaign` with label **Producto/Campaña** and description indicating it is the product or campaign for this contract. Spanish labels MUST be consistent with other groups.

#### Scenario: Editor lists client variables

- **WHEN** a user opens the variable catalog in the template editor
- **THEN** group `client` lists `client_name`, `client_brand`, `client_brand_account`, and `client_product_campaign`

### Requirement: Document Builder generate API accepts optional clientId

The backend `generateAndPersist` MUST accept optional `clientId` in the request body. When provided, it MUST load the client via `clientService.getClientById`; if missing or invalid, respond with HTTP 400 and a Spanish message. When omitted, generation MUST proceed without client context. `findActiveDuplicateDraft` MUST NOT include `client_id` in its uniqueness key (supplier + company + template + month only).

#### Scenario: Generate with valid clientId

- **WHEN** an authorized client posts generate with valid `companyId`, `supplierId`, standard template, and valid `clientId`
- **THEN** the server returns success and persists `client_id` on the draft

#### Scenario: Invalid clientId rejected

- **WHEN** an authorized client posts generate with a non-existent `clientId`
- **THEN** the server responds with HTTP 400 and a Spanish validation message

#### Scenario: Duplicate draft ignores client

- **WHEN** an active duplicate draft exists for the same supplier, company, template, and month
- **AND** the new request uses a different `clientId`
- **THEN** duplicate detection behavior is unchanged (still reports `DUPLICATE_DRAFT` when applicable)

### Requirement: Client product campaign override must match resolved catalog

When `generateAndPersist` receives a non-empty `missingFieldOverrides.client_product_campaign`, and `resolveFieldDefinition('client_product_campaign', { clientRow })` yields `type: 'select'` with a non-empty `options` array, the override value MUST equal one of those options by exact string comparison (no case folding, no diacritic folding, no trim for the match). The options MUST be the same array `buildMissingFields` would expose for that field (campaign `name` values of the loaded client).

If the resolved field is not a select with options (no client, or client with no `product_campaigns`), the override MUST NOT be rejected by this catalog rule. Empty or absent `client_product_campaign` MUST continue to surface as a missing placeholder when the template requires it, not as a catalog error.

A mismatch MUST abort generation and dry-run before substitution and before any GCS or `draft_document` write. The result MUST be `ok: false`, HTTP-equivalent status 400, `code: 'VALIDATION_ERROR'`, and a Spanish (es-CL) `message` that names the field label (`Producto/Campaña`) and lists the valid options in the same order as `missingFields`. The message MUST NOT include the rejected value.

This rule MUST apply to REST and MCP because both call `generateAndPersist`. It MUST NOT apply to `signContract` or to PDF download of an already persisted draft.

#### Scenario: Campaign in catalog accepted

- **WHEN** generation or dry-run runs with a client whose campaigns are `["DRYOFF", "Solbiot"]`
- **AND** `missingFieldOverrides.client_product_campaign` is `"Solbiot"`
- **THEN** the catalog check passes
- **AND** generation continues (missing placeholders or success according to the rest of the template)

#### Scenario: Campaign not in catalog rejected

- **WHEN** generation or dry-run runs with a client whose campaigns are `["DRYOFF", "Solbiot"]`
- **AND** `missingFieldOverrides.client_product_campaign` is `"Producto Inventado"`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the message is in Spanish, names `Producto/Campaña`, and lists `DRYOFF` and `Solbiot`
- **AND** the message does not contain `"Producto Inventado"`
- **AND** no PDF is uploaded and no draft row is written

#### Scenario: Campaign with different casing rejected

- **WHEN** generation or dry-run runs with a client whose campaigns are `["DRYOFF", "Solbiot"]`
- **AND** `missingFieldOverrides.client_product_campaign` is `"Dryoff"`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the valid options listed in the message are `DRYOFF` and `Solbiot`

#### Scenario: Dry-run also rejects out-of-catalog campaign

- **WHEN** `generateAndPersist` is called with `body.dryRun: true` and an out-of-catalog `client_product_campaign`
- **AND** the loaded client has a non-empty campaign list
- **THEN** the result is the same `VALIDATION_ERROR` as a real generate
- **AND** no GCS or database mutations occur

#### Scenario: No campaign catalog skips the check

- **WHEN** generation runs without `clientId`, or with a client that has no `product_campaigns`
- **AND** `missingFieldOverrides.client_product_campaign` is `"Campaña Libre"`
- **THEN** this catalog rule does not reject the value

