## MODIFIED Requirements

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
