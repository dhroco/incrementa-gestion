## MODIFIED Requirements

### Requirement: Document validation by catalog type

`supplierService.validatePayload` MUST resolve `document_type_code` from the payload or, when omitted, from the unique catalog row for `country_code`. It MUST validate `document_number` through a validator registry keyed by `validator_key`. The registry MUST have three keys:

- `rut_cl` MUST call `parseRut` from `backend/utils/rut.js` and MUST NOT reimplement the módulo 11 check. A verificador digit that does not match MUST be rejected with message `El dígito verificador no corresponde al RUT ingresado.` and MUST NOT be replaced with the computed digit
- `pattern` MUST apply `identity_document_type.pattern` (a regex, or a JSON object keyed by `persona_natural` / `empresa`) after trim and uppercase only, and MUST persist the identifier with its punctuation intact
- `pattern_compact` MUST apply the same `pattern` field after also stripping spaces, dots, and hyphens, and MUST persist that compacted form

The catalog row chooses the normalizer; `pattern` MUST NOT compact. The supplier's own identifier MUST use the pattern for `supplier_type`. The legal representative identifier MUST always validate as `persona_natural`. REST and MCP MUST use this same path. Error messages MUST be in Spanish (es-CL) and MUST NOT include the submitted document value.

Input aliases `rut` (persona natural), `rut_empresa` (empresa), and `rut_rep_legal` MUST be accepted when `document_number` / `rep_document_number` are omitted, and MUST persist to the same columns.

#### Scenario: Invalid Chilean RUT still rejected

- **WHEN** an authorized client posts a Chilean supplier with an invalid RUT
- **THEN** the response is HTTP 400 with the Spanish message `El RUT ingresado no es válido.`
- **AND** the message does not echo the submitted value

#### Scenario: Chilean RUT with a mismatched verificador is rejected

- **WHEN** a Chilean document of type `rut_cl` is validated with `document_number` `12.345.678-9`
- **THEN** validation fails with message `El dígito verificador no corresponde al RUT ingresado.`
- **AND** the value is not stored as canonical `12345678-5`

#### Scenario: Chilean RUT with a matching verificador is stored canonically

- **WHEN** a Chilean document of type `rut_cl` is validated with `document_number` `12.345.678-5`
- **THEN** validation succeeds
- **AND** the canonical value is `12345678-5`

#### Scenario: Mexican persona natural RFC accepted

- **WHEN** an authorized client posts a persona natural supplier with `country_code` `MX` and RFC `LEGF870121MGA`
- **THEN** the response is HTTP 201
- **AND** the stored identifier is that RFC

#### Scenario: Mexican persona natural RFC with wrong length rejected

- **WHEN** an authorized client posts a persona natural supplier with `country_code` `MX` and a 12-character RFC
- **THEN** the response is HTTP 400 with a Spanish message that the RFC is not valid
- **AND** the message does not contain the submitted RFC

#### Scenario: Empresa RFC and persona-física representative

- **WHEN** an authorized client posts an empresa supplier with `country_code` `MX`, a 12-character company RFC, and a 13-character representative RFC
- **THEN** the response is HTTP 201
- **AND** both identifiers are stored

#### Scenario: Alias rut maps to document_number

- **WHEN** an authorized client posts a Chilean persona natural with `rut` `12.345.678-5` and no `document_number`
- **THEN** the stored `document_number` is `12345678-5`

#### Scenario: Pattern type preserves country punctuation

- **WHEN** a catalog row exists with `validator_key` `pattern` and regex `^[0-9]{2}-[0-9]{8}-[0-9]$` (for example CUIT/AR)
- **AND** an authorized client posts a supplier with that `country_code` and `document_number` `20-12345678-9`
- **THEN** the supplier is created
- **AND** the stored `document_number` is `20-12345678-9`
- **AND** posting the same country with `20123456789` is rejected with HTTP 400 and a Spanish message that does not echo the submitted value

#### Scenario: Pattern compact accepts RFC with separators

- **WHEN** an authorized client posts a persona natural supplier with `country_code` `MX` and `document_number` `LEGF-870121-MGA`
- **THEN** the response is HTTP 201
- **AND** the stored `document_number` is `LEGF870121MGA`
