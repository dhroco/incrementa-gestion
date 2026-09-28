## ADDED Requirements

### Requirement: Strict integer price input

`parsePriceInput(value)`, exported from `backend/services/documentBuilderService.js`, MUST accept or reject a price without formatting it. It MUST convert `value` to text and apply `trim()` only at the ends. It MUST return `{ ok: true, value: <integer> }` when the trimmed text matches exactly one of `^\d+$`, `^\d{1,3}(\.\d{3})+$`, or `^\d{1,3}(,\d{3})+$`. A plain digit string is that integer. A grouped string MUST drop that single separator and the remaining digits MUST be the integer. A JavaScript number MUST be read through the same text rule.

It MUST return `{ ok: false, message }` for every other input. `message` MUST be exactly `El precio debe ser un número entero, sin decimales ni símbolos. Por ejemplo: 1290, 1.290 o 1,290.`

#### Scenario: Plain integers are accepted

- **WHEN** `parsePriceInput` receives `1290`, `0`, or `1500000`
- **THEN** each result is `{ ok: true, value }` with `1290`, `0`, and `1500000` respectively

#### Scenario: Dot-grouped thousands are accepted

- **WHEN** `parsePriceInput` receives `1.290`, `1.500.000`, or `12.345`
- **THEN** each result is `{ ok: true, value }` with `1290`, `1500000`, and `12345` respectively

#### Scenario: Comma-grouped thousands are accepted

- **WHEN** `parsePriceInput` receives `1,290` or `1,500,000`
- **THEN** each result is `{ ok: true, value }` with `1290` and `1500000` respectively

#### Scenario: Surrounding whitespace is trimmed

- **WHEN** `parsePriceInput` receives ` 1290 `
- **THEN** the result is `{ ok: true, value: 1290 }`

#### Scenario: A numeric value is accepted

- **WHEN** `parsePriceInput` receives the number `1290`
- **THEN** the result is `{ ok: true, value: 1290 }`

#### Scenario: Decimals, mixed separators, bad groups, and symbols are rejected

- **WHEN** `parsePriceInput` receives `1,290.50`, `1290.50`, `1290,5`, `12,5`, `1.29`, `1.290,000`, `1,290.000`, `1.2900`, `12.90`, `.290`, `1.`, `1..290`, `$1290`, `US$1,290`, `290 USD`, `1 290`, `-1290`, or `abc`
- **THEN** every result is `{ ok: false, message }` and `message` is exactly `El precio debe ser un número entero, sin decimales ni símbolos. Por ejemplo: 1290, 1.290 o 1,290.`

## MODIFIED Requirements

### Requirement: Override preprocessing for numeric contract fields

Before calling `buildSubstitutionMap`, `generateAndPersist` MUST preprocess `missingFieldOverrides`. Formatting of `precio_numero` MUST follow the template currency passed as `preprocessMissingFieldOverrides(overrides, { currencyCode })`. When `currencyCode` is omitted, `null`, or empty, the service MUST format as `CLP`. A `currencyCode` other than `CLP` or `USD` MUST throw an `Error`.

- `precio_numero`: parse with `parsePriceInput`, not with `parseIntegerOverride`. When the result is `ok`, format the integer by currency:
  - `CLP`: prefix `$` and Chilean thousands (`es-CL`), e.g. `1290` → `"$1.290"`, `1500000` → `"$1.500.000"`, `0` → `"$0"`
  - `USD`: prefix `US$` and US thousands (`en-US`, `maximumFractionDigits: 0`), e.g. `1290` → `"US$1,290"`, `1500000` → `"US$1,500,000"`, `0` → `"US$0"`
- When `parsePriceInput` rejects the price, `preprocessMissingFieldOverrides` MUST leave `precio_numero` as it arrived and MUST NOT set `precio_texto`.
- `precio_texto`: when the price is accepted, auto-generate it from the parsed integer via `numberToWords`, with no currency suffix, for both `CLP` and `USD` (e.g. `1290` → `"mil doscientos noventa"`).

`formatThousands` MUST remain the `es-CL` formatter and MUST be used for `CLP`. Formatting MUST apply only to override values, not to supplier or company data loaded from the database. `parseIntegerOverride` MUST remain the parser for `cantidad_reels` and MUST NOT be used for `precio_numero`.

#### Scenario: Price number formatted and text generated

- **WHEN** overrides include `{ precio_numero: '1500000' }` and no currency is passed
- **THEN** the substitution map includes `precio_numero: "$1.500.000"` and auto-generated `precio_texto`

#### Scenario: CLP price cells

- **WHEN** `preprocessMissingFieldOverrides` receives `precio_numero` `1290`, `1500000`, and `0` with `currencyCode` `CLP` or omitted
- **THEN** `precio_numero` is `"$1.290"`, `"$1.500.000"`, and `"$0"` respectively

#### Scenario: USD price cells

- **WHEN** `preprocessMissingFieldOverrides` receives `precio_numero` `1290`, `1500000`, and `0` with `currencyCode` `USD`
- **THEN** `precio_numero` is `"US$1,290"`, `"US$1,500,000"`, and `"US$0"` respectively

#### Scenario: Price text ignores currency

- **WHEN** overrides include `{ precio_numero: '1290' }` with `currencyCode` `CLP` and again with `USD`
- **THEN** both results set `precio_texto` to `"mil doscientos noventa"`

#### Scenario: Unknown currency throws

- **WHEN** `preprocessMissingFieldOverrides` is called with a `currencyCode` other than `CLP` or `USD`
- **THEN** it throws an `Error`

#### Scenario: Comma-grouped USD price is formatted

- **WHEN** `preprocessMissingFieldOverrides` receives `{ precio_numero: '1,290' }` with `currencyCode` `USD`
- **THEN** `precio_numero` is `"US$1,290"` and `precio_texto` is `"mil doscientos noventa"`

#### Scenario: Dot-grouped CLP price is formatted

- **WHEN** `preprocessMissingFieldOverrides` receives `{ precio_numero: '1.290' }` with `currencyCode` `CLP`
- **THEN** `precio_numero` is `"$1.290"`

#### Scenario: Invalid price is left unchanged

- **WHEN** `preprocessMissingFieldOverrides` receives `{ precio_numero: '1290.50' }` with a currency of `CLP` or `USD`
- **THEN** `precio_numero` stays `"1290.50"` and the result has no `precio_texto`
