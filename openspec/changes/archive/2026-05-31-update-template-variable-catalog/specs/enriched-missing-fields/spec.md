## MODIFIED Requirements

### Requirement: Variable metadata map for missing placeholders

`documentBuilderService.js` MUST define a static extensible map `VARIABLE_META` keyed by placeholder name. Each entry MUST include at least `label` (Spanish string), `type` (`text`, `date`, `select`, or `number`), and `source` (`supplier`, `client`, `company`, or `contract`). A function `getVariableMeta(key)` MUST return the map entry or default `{ label: key, type: 'text' }` for unknown keys.

The map MUST NOT include: `proveedor_tipo`, `contract_type`, `work_schedule`, `signing_city`, or `contract_date`.

The map MUST include at minimum:

- `proveedor_red_social`: `{ label: 'Red Social', type: 'select', source: 'supplier' }`
- `proveedor_cuenta_social`: `{ label: 'Cuenta Red Social', type: 'text', source: 'supplier' }`
- `client_product_campaign`: `{ label: 'Producto/Campaña', type: 'select', source: 'client' }`
- `fecha_contrato`: `{ label: 'Fecha del contrato', type: 'date', source: 'contract' }`
- `lugar_contrato`: `{ label: 'Lugar del contrato', type: 'text', source: 'contract' }`
- `mes_ejecucion`: `{ label: 'Mes de ejecución', type: 'text', source: 'contract' }`
- `cantidad_reels`: `{ label: 'Cantidad de reels', type: 'number', source: 'contract' }`
- `precio_numero`: `{ label: 'Precio', type: 'number', source: 'contract' }`
- `precio_texto`: `{ label: 'Precio en texto', type: 'text', source: 'contract' }`

#### Scenario: Known date variable returns typed metadata

- **WHEN** `getVariableMeta('fecha_contrato')` is called
- **THEN** it returns `{ label: 'Fecha del contrato', type: 'date', source: 'contract' }`

#### Scenario: Unknown variable falls back to text

- **WHEN** `getVariableMeta('custom_field_xyz')` is called
- **THEN** it returns `{ label: 'custom_field_xyz', type: 'text' }`

#### Scenario: Removed variables not in map

- **WHEN** `getVariableMeta('signing_city')` is called
- **THEN** it returns the default fallback `{ label: 'signing_city', type: 'text' }` (not a curated entry)

### Requirement: Missing placeholders enriched response

When `generateAndPersist` detects unresolved template placeholders, it MUST return HTTP-equivalent status 422 with code `MISSING_PLACEHOLDERS` and `data.missingFields` as an array of objects `{ key, label, type, source, options?, pairField? }`. Each object MUST be built from `getVariableMeta(key)` after applying secondary-to-primary normalization via `SECONDARY_FIELDS`. The response MUST NOT include `missingFieldKeys`. Secondary fields MUST NOT appear in the array.

`buildMissingFields(missingKeys, { clientRow, supplierRow })` MUST:

1. Replace each secondary key in `missingKeys` with its primary per `SECONDARY_FIELDS`
2. Deduplicate the resulting set
3. Return only primary fields, with optional `pairField` naming the secondary

For `key === 'client_product_campaign'`, when `clientRow.product_campaigns` has at least one item, the field MUST have `type: 'select'` and `options` as simple string names.

For `key === 'proveedor_red_social'`, when `supplierRow.social_networks` has items, options MUST be objects with `label` and `values`; when empty, `type` MUST fall back to `'text'`.

#### Scenario: Missing fields include metadata

- **WHEN** generation runs with unresolved `lugar_contrato` and `fecha_contrato`
- **THEN** `data.missingFields` contains two objects with correct `key`, Spanish `label`, and `type`

#### Scenario: Client product campaign with options

- **WHEN** generation runs with unresolved `client_product_campaign` and the selected client has campaigns `["Verano 2026", "Black Friday"]`
- **THEN** the corresponding missing field has `type: 'select'` and `options` equal to those name strings

#### Scenario: Dry run returns same missing fields shape

- **WHEN** `generateAndPersist` is called with `body.dryRun: true` and placeholders are unresolved
- **THEN** the response is `ok: false` with code `MISSING_PLACEHOLDERS` and `data.missingFields` (no persistence)

#### Scenario: Dry run success when all resolved

- **WHEN** `generateAndPersist` is called with `body.dryRun: true` and all placeholders resolve
- **THEN** the response is `ok: true` with `data.valid: true` and no GCS or database writes

### Requirement: Document Builder typed missing-field inputs

The Document Builder UI MUST render the section «Información adicional requerida» from `missingFields` returned by dry-run or generate error. Input control MUST match `field.type`:

- `text` → text input
- `date` → date input (ISO `YYYY-MM-DD`)
- `number` → number input with `min="0"`
- `select` with string `options` → select element listing option strings
- `select` with object `options` (each having `label` and `values`) → select listing labels; on selection, all `values` entries are stored in overrides

The **Generar** button MUST be disabled until every field in the current `missingFields` list has a non-empty value in `missingFieldOverrides`. Secondary fields not present in `missingFields` MUST NOT affect validation. When dry-run succeeds (`ok: true`), the UI MUST indicate readiness to generate without showing missing-field inputs.

#### Scenario: Select field for product campaign

- **WHEN** dry-run returns a missing field with `type: 'select'` and `options: ['A', 'B']`
- **THEN** the UI shows a dropdown with those options

#### Scenario: Generate disabled until fields complete

- **WHEN** missing fields include `fecha_contrato` and the user has not set its override
- **THEN** the Generar button is disabled

#### Scenario: Ready state after successful dry-run

- **WHEN** dry-run returns `ok: true`
- **THEN** no missing-field form is shown and Generar is enabled (subject to other existing guards)
