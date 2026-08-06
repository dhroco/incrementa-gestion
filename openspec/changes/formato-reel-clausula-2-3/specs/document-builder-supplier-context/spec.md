## ADDED Requirements

### Requirement: Contract variable formato_reel

The system SHALL define contract variable `formato_reel` (label "Formato de reel", group `contrato`, source `contract`) holding the publication format that accompanies `cantidad_reels` in clause 2.3.

`VARIABLE_META` MUST declare it with `type: 'select'`, and `buildMissingFields` MUST populate `field.options` with the closed catalog `FORMATO_REEL_OPTIONS`: Reel, Video, Historia, Story, Post, Carrusel, Short.

`backend/utils/formatReels.js` MUST expose `formatFormatoReel(formato, cantidad)`, which renders the format in lowercase agreeing in number with `cantidad_reels`: singular when the quantity is exactly 1, plural otherwise. Matching MUST ignore case, diacritics and a trailing `s`, so "Vídeos", "videos" and "Video" resolve to the same catalog entry. Catalog entries carry explicit plurals so anglicisms are not mangled ("reel" → "reels", never "reeles"). A format outside the catalog MUST be lowercased and pluralized with the generic Spanish rule (vowel → `s`, `-ión` → `-iones`, otherwise `es`). An empty value MUST be returned untouched. When the quantity is absent or not an integer, the singular MUST be used.

The frontend variable catalog MUST list `formato_reel` under group `contrato`.

#### Scenario: Singular format

- **WHEN** `formato_reel` is "Reel" and `cantidad_reels` is 1
- **THEN** the rendered format is `"reel"`

#### Scenario: Plural format

- **WHEN** `formato_reel` is "Video" and `cantidad_reels` is 3
- **THEN** the rendered format is `"videos"`

#### Scenario: Anglicism plural is not over-applied

- **WHEN** `formato_reel` is "Reel" and `cantidad_reels` is 2
- **THEN** the rendered format is `"reels"` and never `"reeles"`

#### Scenario: Format outside the catalog

- **WHEN** `formato_reel` is "Publicación" and `cantidad_reels` is 3
- **THEN** the rendered format is `"publicaciones"`

#### Scenario: Missing quantity falls back to singular

- **WHEN** `formato_reel` is "Video" and `cantidad_reels` is empty
- **THEN** the rendered format is `"video"`

#### Scenario: Format offered as a select

- **WHEN** generation reports `formato_reel` as a missing field
- **THEN** the field has `type` `select` and `options` listing Reel, Video, Historia, Story, Post, Carrusel and Short

### Requirement: Clause 2.3 pairs quantity and format

Every active standard template SHALL express clause 2.3 as "… la generación y publicación de `{{cantidad_reels}}` `{{formato_reel}}` en …", with the `formato_reel` variable node immediately following the `cantidad_reels` node, separated by a single space.

Inactive templates MUST NOT be modified.

#### Scenario: Clause 2.3 renders a single reel

- **WHEN** a contract is generated with `cantidad_reels` 1 and `formato_reel` "Reel"
- **THEN** clause 2.3 reads "… la generación y publicación de un (1) reel en …"

#### Scenario: Clause 2.3 renders several videos

- **WHEN** a contract is generated with `cantidad_reels` 3 and `formato_reel` "Video"
- **THEN** clause 2.3 reads "… la generación y publicación de tres (3) videos en …"

## MODIFIED Requirements

### Requirement: Contract variable cantidad_reels renders words and figures

`cantidad_reels` SHALL be rendered as cardinal words followed by the figure in parentheses, without a noun: 1 → `"un (1)"`, 3 → `"tres (3)"`, 21 → `"veintiún (21)"`. The noun is supplied separately by `formato_reel`.

`backend/utils/formatReels.js` MUST expose `formatCantidadReels(value)` for this, reusing `cardinal` exported from `backend/utils/formatDuracion.js` so apocopation matches `duracion_ejecucion` and `dias_cesion`. Thousands separators in the input MUST be accepted. An empty or non-numeric value MUST be returned untouched.

`preprocessMissingFieldOverrides` MUST resolve `formato_reel` before rewriting `cantidad_reels`, since number agreement depends on the parsed integer.

The substitution map MUST initialize `formato_reel` to the empty string alongside `cantidad_reels` so unresolved detection works.

#### Scenario: Quantity in words and figures

- **WHEN** generation receives `missingFieldOverrides: { cantidad_reels: '3' }`
- **THEN** the substitution map has `cantidad_reels` equal to `"tres (3)"`

#### Scenario: Quantity apocopation

- **WHEN** generation receives `missingFieldOverrides: { cantidad_reels: '21' }`
- **THEN** the substitution map has `cantidad_reels` equal to `"veintiún (21)"`

#### Scenario: Non-numeric quantity is left alone

- **WHEN** generation receives `missingFieldOverrides: { cantidad_reels: 'varios' }`
- **THEN** the substitution map has `cantidad_reels` equal to `"varios"`
