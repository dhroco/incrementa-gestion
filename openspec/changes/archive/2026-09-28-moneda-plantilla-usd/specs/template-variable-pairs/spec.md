## MODIFIED Requirements

### Requirement: Override preprocessing for numeric contract fields

Before calling `buildSubstitutionMap`, `generateAndPersist` MUST preprocess `missingFieldOverrides`. Formatting of `precio_numero` MUST follow the template currency passed as `preprocessMissingFieldOverrides(overrides, { currencyCode })`. When `currencyCode` is omitted, `null`, or empty, the service MUST format as `CLP`. A `currencyCode` other than `CLP` or `USD` MUST throw an `Error`.

- `precio_numero`: parse as integer with `parseIntegerOverride` (unchanged). Then format by currency:
  - `CLP`: prefix `$` and Chilean thousands (`es-CL`), e.g. `1290` → `"$1.290"`, `1500000` → `"$1.500.000"`, `0` → `"$0"`
  - `USD`: prefix `US$` and US thousands (`en-US`, `maximumFractionDigits: 0`), e.g. `1290` → `"US$1,290"`, `1500000` → `"US$1,500,000"`, `0` → `"US$0"`
- `precio_texto`: auto-generate from the parsed `precio_numero` via `numberToWords`, with no currency suffix, for both `CLP` and `USD` (e.g. `1290` → `"mil doscientos noventa"`)

`formatThousands` MUST remain the `es-CL` formatter and MUST be used for `CLP`. Formatting MUST apply only to override values, not to supplier or company data loaded from the database.

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
