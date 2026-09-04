## ADDED Requirements

### Requirement: Select override values must match resolved options

`generateAndPersist` MUST validate every non-empty `missingFieldOverrides` entry whose field, after mapping secondaries through `SECONDARY_FIELDS`, resolves via `resolveFieldDefinition(key, { clientRow, supplierRow })` to `type: 'select'` with a non-empty `options` array. `resolveFieldDefinition` MUST be the same function `buildMissingFields` uses to set `type` and `options`, so the allowed values cannot drift from the `missingFields` catalog.

Comparison MUST be exact string equality against:

- each option when options are strings (e.g. `FORMATO_REEL_OPTIONS` for `formato_reel`);
- `option.values[<primaryKey>]` when options are `{ label, values }` objects — plus the pair rule in "Supplier social network override must match a stored pair".

The check MUST run on the raw overrides, before `preprocessMissingFieldOverrides`. A mismatch MUST return `ok: false`, HTTP-equivalent status 400, `code: 'VALIDATION_ERROR'`, and a Spanish (es-CL) message that names the field `label` and lists the valid options in `missingFields` order (string options as-is; object options by `label`). The message MUST NOT include the rejected value. Fields that resolve to `text`, `date`, `number`, or select without options MUST NOT be rejected by this rule.

The check MUST apply to real generate and to `dryRun: true` (REST and MCP). It MUST NOT run on `signContract` or on download of an existing draft.

#### Scenario: formato_reel catalog value accepted then formatted

- **WHEN** generation receives `missingFieldOverrides: { formato_reel: "Video", cantidad_reels: "3" }`
- **THEN** the catalog check passes
- **AND** the substitution map has `formato_reel` equal to `"videos"` (existing preprocess)

#### Scenario: formato_reel outside catalog rejected

- **WHEN** generation or dry-run receives `missingFieldOverrides.formato_reel` equal to `"Publicación"`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the message is in Spanish, names `Formato de reel`, and lists Reel, Video, Historia, Story, Post, Carrusel and Short
- **AND** the message does not contain `"Publicación"`
- **AND** no PDF is uploaded and no draft row is written

#### Scenario: formato_reel different casing rejected

- **WHEN** generation or dry-run receives `missingFieldOverrides.formato_reel` equal to `"video"`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the listed options include `"Video"` and do not treat `"video"` as a match

#### Scenario: Non-select override is not catalog-checked

- **WHEN** generation receives `missingFieldOverrides.lugar_contrato` equal to any non-empty string
- **THEN** this select catalog rule does not reject the value

#### Scenario: Signing a draft does not re-check select catalogs

- **WHEN** `signContract` runs on a draft that has `content_snapshot` and `contract_overrides.formato_reel` equal to the already-rendered `"videos"`
- **THEN** signing proceeds without a `VALIDATION_ERROR` from this rule

### Requirement: Supplier social network override must match a stored pair

When `resolveFieldDefinition('proveedor_red_social', { supplierRow })` yields `type: 'select'` with `{ label, values }` options built from `supplierRow.social_networks`, `generateAndPersist` MUST:

1. Accept a non-empty `proveedor_red_social` only if it equals some `option.values.proveedor_red_social` by exact comparison.
2. When both `proveedor_red_social` and `proveedor_cuenta_social` are non-empty, accept them only if some option has `values` equal to that pair. A cross combination (network from one row, account from another) MUST be rejected even if each piece exists on the supplier.

If the field resolves to `type: 'text'` (no social networks), this pair rule MUST NOT apply. A pair mismatch MUST use the same `VALIDATION_ERROR` path as other select failures, listing option `label` values (e.g. `Instagram — @marca`).

#### Scenario: Matching social pair accepted

- **WHEN** the supplier has social networks `{ name: "Instagram", account_name: "@marca" }` and `{ name: "TikTok", account_name: "@otra" }`
- **AND** generation or dry-run receives `proveedor_red_social: "Instagram"` and `proveedor_cuenta_social: "@marca"`
- **THEN** the pair check passes

#### Scenario: Crossed social pair rejected

- **WHEN** the supplier has social networks `{ name: "Instagram", account_name: "@marca" }` and `{ name: "TikTok", account_name: "@otra" }`
- **AND** generation or dry-run receives `proveedor_red_social: "Instagram"` and `proveedor_cuenta_social: "@otra"`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the message is in Spanish, names `Red Social`, and lists `Instagram — @marca` and `TikTok — @otra`
- **AND** the message does not contain the rejected network or account values
- **AND** no PDF is uploaded and no draft row is written

#### Scenario: Unknown social network rejected

- **WHEN** the supplier has social network `{ name: "Instagram", account_name: "@marca" }`
- **AND** generation or dry-run receives `proveedor_red_social: "Facebook"`
- **THEN** the result is `ok: false`, status 400, `code: 'VALIDATION_ERROR'`
- **AND** the listed options include `Instagram — @marca`

#### Scenario: No social networks keeps free text

- **WHEN** the supplier has no `social_networks`
- **AND** generation receives `proveedor_red_social: "Instagram"`
- **THEN** this pair rule does not reject the value
