## MODIFIED Requirements

### Requirement: Generate formats price with the template currency

`generateAndPersist` MUST load the template row before `preprocessMissingFieldOverrides` and MUST call `preprocessMissingFieldOverrides(overridesRaw, { currencyCode: templateRow.currency_code })`. `validateSelectOverrides` MUST still run on the raw overrides and MUST stay before preprocessing. After preprocessing, `loadCompanyRow` and the country-coherence check MUST keep their current relative order. A missing template MUST still return `ok: false`, status 404, and message `Plantilla no encontrada.` A country mismatch MUST still return the same validation error as today.

When `overridesRaw.precio_numero` is not `null` and `String(overridesRaw.precio_numero).trim()` is not empty, `generateAndPersist` MUST validate it with `parsePriceInput` after the template row is found and before `preprocessMissingFieldOverrides`. When `parsePriceInput` returns `ok: false`, `generateAndPersist` MUST return `{ ok: false, status: 400, code: 'VALIDATION_ERROR', message }` using that function's message, and MUST NOT upload to GCS or insert into `draft_document`. This MUST hold when `dryRun` is `true` and when it is omitted. A `null` or blank `precio_numero` MUST skip this check.

On a real generate (`dryRun` not set) of an accepted price, the persisted `contract_overrides` MUST contain `precio_numero` already formatted for that template currency.

#### Scenario: USD template stores US dollar price

- **WHEN** an authorized client generates without dry-run using a template with `currency_code` `USD` whose `country_code` matches the supplier, and overrides include `precio_numero` `1290`
- **THEN** the stored `contract_overrides.precio_numero` is `US$1,290`

#### Scenario: CLP template stores Chilean price

- **WHEN** an authorized client generates without dry-run using a template with `currency_code` `CLP` whose `country_code` matches the supplier, and overrides include `precio_numero` `1290`
- **THEN** the stored `contract_overrides.precio_numero` is `$1.290`

#### Scenario: Grouped USD price is stored formatted

- **WHEN** an authorized client generates without dry-run using a template with `currency_code` `USD` whose `country_code` matches the supplier, and overrides include `precio_numero` `1,290`
- **THEN** the stored `contract_overrides.precio_numero` is `US$1,290`

#### Scenario: Dry run rejects a price that is not a clean integer

- **WHEN** `generateAndPersist` is called with `body.dryRun: true` and `precio_numero` `1,290.50`
- **THEN** the result is `ok: false`, `status` 400, `code` `VALIDATION_ERROR`, and `message` exactly `El precio debe ser un número entero, sin decimales ni símbolos. Por ejemplo: 1290, 1.290 o 1,290.`
- **AND** no row is inserted into `draft_document` and nothing is uploaded to GCS

#### Scenario: Real generate rejects a price that is not a clean integer

- **WHEN** `generateAndPersist` is called without `dryRun` and `precio_numero` `1,290.50`
- **THEN** the result is `ok: false`, `status` 400, `code` `VALIDATION_ERROR`, and `message` exactly `El precio debe ser un número entero, sin decimales ni símbolos. Por ejemplo: 1290, 1.290 o 1,290.`
- **AND** no row is inserted into `draft_document` and nothing is uploaded to GCS
