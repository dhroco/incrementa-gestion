# template-variable-pairs Specification

## Purpose
TBD - created by archiving change update-template-variable-catalog. Update Purpose after archive.
## Requirements
### Requirement: Secondary field mapping constant

`documentBuilderService.js` MUST define:

```js
const SECONDARY_FIELDS = {
  proveedor_cuenta_social: 'proveedor_red_social',
  precio_texto: 'precio_numero'
}
```

Secondary fields MUST never appear in the `missingFields` response array. When a template placeholder resolves to a secondary key, `buildMissingFields` MUST replace it with the corresponding primary key before building field definitions.

#### Scenario: Price text missing maps to price number

- **WHEN** unresolved keys include `precio_texto`
- **THEN** `data.missingFields` contains one field with `key: 'precio_numero'` and `pairField: 'precio_texto'`
- **AND** no field with `key: 'precio_texto'` is returned

#### Scenario: Social account missing maps to social network select

- **WHEN** unresolved keys include `proveedor_cuenta_social`
- **THEN** `data.missingFields` contains one field with `key: 'proveedor_red_social'` and `pairField: 'proveedor_cuenta_social'`

#### Scenario: Both primary and secondary missing deduplicate

- **WHEN** unresolved keys include both `precio_numero` and `precio_texto`
- **THEN** `data.missingFields` contains exactly one field with `key: 'precio_numero'`

### Requirement: Supplier social network select with value pairs

When `proveedor_red_social` is a missing primary field and `supplierRow.social_networks` has at least one entry, the missing field MUST have `type: 'select'` and `options` as an array of objects:

```json
{ "label": "Instagram — @mihandle", "values": { "proveedor_red_social": "Instagram", "proveedor_cuenta_social": "@mihandle" } }
```

Each option MUST be built from `social_networks[].name` and `social_networks[].account_name`. When `social_networks` is empty or absent, the field MUST fall back to `type: 'text'`.

#### Scenario: Social network options from supplier

- **WHEN** dry-run detects missing `proveedor_red_social` and supplier has social network `{ name: 'Instagram', account_name: '@mihandle' }`
- **THEN** the missing field has `type: 'select'` and options containing the paired values object

#### Scenario: Empty social networks fallback

- **WHEN** dry-run detects missing `proveedor_red_social` and supplier has no social networks
- **THEN** the missing field has `type: 'text'`

### Requirement: Override preprocessing for numeric contract fields

Before calling `buildSubstitutionMap`, `generateAndPersist` MUST preprocess `missingFieldOverrides`:

- `cantidad_reels`: parse as integer, format with Chilean thousands separator (dot), e.g. `1000` → `"1.000"`
- `precio_numero`: parse as integer, format with Chilean thousands separator, e.g. `1500000` → `"1.500.000"`
- `precio_texto`: auto-generate from parsed `precio_numero` via `numberToWords`

Formatting MUST apply only to override values, not to supplier or company data loaded from the database.

#### Scenario: Reels count formatted

- **WHEN** overrides include `{ cantidad_reels: '1000' }`
- **THEN** the substitution map value for `cantidad_reels` is `"1.000"`

#### Scenario: Price number formatted and text generated

- **WHEN** overrides include `{ precio_numero: '1500000' }`
- **THEN** the substitution map includes `precio_numero: "1.500.000"` and auto-generated `precio_texto`

### Requirement: Frontend select with values dispatches multiple overrides

`MissingFieldInput` in `DocumentBuilderPage.jsx` MUST support select options that are either strings (current behavior) or objects with a `values` property. When the user selects an option with `values`, the component MUST dispatch `setMissingField` for every entry in `values`. When the option is a string, it MUST dispatch only for `field.key`.

#### Scenario: String option single dispatch

- **WHEN** user selects string option `"Verano 2026"` on `client_product_campaign`
- **THEN** only `client_product_campaign` is updated in missing field overrides

#### Scenario: Values option multi dispatch

- **WHEN** user selects option `{ label: "Instagram — @mihandle", values: { proveedor_red_social: "Instagram", proveedor_cuenta_social: "@mihandle" } }`
- **THEN** both `proveedor_red_social` and `proveedor_cuenta_social` are set in missing field overrides

### Requirement: Frontend number input for contract numeric fields

`MissingFieldInput` MUST render `type: 'number'` fields as `<input type="number" min="0">`. The raw numeric value is stored in overrides; formatted display with thousands separator applies only in the generated document via backend preprocessing.

#### Scenario: Price number input

- **WHEN** dry-run returns missing field `{ key: 'precio_numero', type: 'number' }`
- **THEN** the UI shows a number input with `min="0"`

