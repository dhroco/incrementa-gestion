## ADDED Requirements

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
