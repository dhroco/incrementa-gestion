## ADDED Requirements

### Requirement: Date variables rendered in Chilean legal format

All date-typed template variables SHALL be rendered as "15 de marzo de 2024" — day without leading zero, month name in lowercase Spanish, four-digit year. This applies to `fecha_contrato`, `fecha_escritura` (Fecha Escritura Pública) and `fecha_estatuto` (Fecha Certificado Estatuto).

`backend/utils/formatFechaEs.js` MUST expose `formatFechaEs(value)` as the single implementation, and both `documentBuilderVariableContext.js` and `documentBuilderService.js` MUST use it. Neither file may keep its own `MESES_ES` list or private date formatter.

The function MUST accept both forms the value arrives in:

- A `Date` instance, which is what `pg` returns for `date` columns. Its **local** components MUST be read, never the UTC ones: `pg` builds the value at local midnight, so `toISOString()` would shift the day backwards in timezones west of Greenwich, Chile included.
- An ISO string (`YYYY-MM-DD`, optional time), which is what the form and the MCP send as an override. It MUST be parsed component-wise, for the same reason.

Any other value MUST be returned unchanged, so an already-formatted date passes through. An invalid `Date`, `null` and `undefined` MUST yield the empty string.

#### Scenario: Supplier date stored in the database

- **WHEN** an empresa supplier has `fecha_certificado_estatuto` stored and a contract is generated
- **THEN** `fecha_estatuto` renders as "27 de mayo de 2025"
- **AND** it never renders the JavaScript `Date` English form such as "Tue May 27 2025 00:00:00 GMT-0400 (Chile Standard Time)"

#### Scenario: Date supplied as an override

- **WHEN** generation receives `missingFieldOverrides: { fecha_escritura: '2024-03-15' }`
- **THEN** the substitution map has `fecha_escritura` equal to `"15 de marzo de 2024"`

#### Scenario: Day is not shifted by timezone

- **WHEN** the value is a `Date` built at local midnight on 31 December 2024
- **THEN** it renders as "31 de diciembre de 2024"

#### Scenario: Day has no leading zero

- **WHEN** the value is `'2024-03-05'`
- **THEN** it renders as "5 de marzo de 2024"

#### Scenario: Already formatted value passes through

- **WHEN** the value is `'15 de marzo de 2024'`
- **THEN** it is returned unchanged

#### Scenario: Empty values

- **WHEN** the value is `null`, `undefined` or an invalid `Date`
- **THEN** the result is the empty string

### Requirement: Date overrides are formatted before substitution

`preprocessMissingFieldOverrides` SHALL format every date-typed override through `formatFechaEs`, driven by a single list `DATE_OVERRIDE_KEYS` containing `fecha_contrato`, `fecha_escritura` and `fecha_estatuto`.

This is required because an override replaces the value already formatted by `buildSubstitutionMap`; without it, a supplier-sourced date entered by hand reaches the PDF as a raw ISO string.

#### Scenario: Personería override does not bypass formatting

- **WHEN** a supplier has no `fecha_escritura_publica` stored and the user supplies `fecha_escritura` as `'2024-03-15'`
- **THEN** the PERSONERÍA clause reads "de fecha 15 de marzo de 2024" and never "de fecha 2024-03-15"

#### Scenario: Contract date keeps its existing behaviour

- **WHEN** generation receives `missingFieldOverrides: { fecha_contrato: '2026-08-06' }`
- **THEN** the substitution map has `fecha_contrato` equal to `"6 de agosto de 2026"`
