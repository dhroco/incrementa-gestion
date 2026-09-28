# chilean-rut-validation Specification

## Purpose
TBD - created by archiving change rut-dv-estricto. Update Purpose after archive.
## Requirements
### Requirement: parseRut treats the last character as the verificador digit

Both `backend/utils/rut.js` `parseRut` and `frontend/src/utils/rut.js` `parseRut` MUST apply the same rules. After removing spaces, dots, and hyphens and uppercasing `k` to `K`, the last character MUST be the verificador digit and the remainder MUST be the body. The function MUST NOT infer a missing digit from the length, MUST NOT drop unexpected characters, and MUST NOT replace or compute a digit from the input.

The backend result MUST be `{ ok: true, rut_body, rut_dv }` or `{ ok: false, code, message }`. The frontend result MUST be `{ ok: true, rutBody, rutDv }` or `{ ok: false, message }`. On success both copies MUST return the body and the digit as written, with `k` normalized to `K`.

Empty input (`''`, `null`, or whitespace only) MUST fail with message `El RUT es obligatorio.` and, on the backend, code `RUT_EMPTY`.

A body that is not all digits, or whose length is not 7 or 8, MUST fail with message `El RUT ingresado no es válido.` and backend code `RUT_INVALID`. A verificador digit other than `0`–`9` or `K` MUST fail the same way.

A verificador digit other than `computeRutDv(body)` MUST fail with message `El dígito verificador no corresponde al RUT ingresado.` and backend code `RUT_DV_MISMATCH`. The failure MUST NOT include the expected digit or the submitted value.

#### Scenario: Valid 8-digit RUT with or without separators

- **WHEN** `parseRut` receives `12.345.678-5`, `12345678-5`, or `123456785`
- **THEN** the result is ok with body `12345678` and digit `5`

#### Scenario: Valid 7-digit RUT

- **WHEN** `parseRut` receives `1.234.567-4` or `12345674`
- **THEN** the result is ok with body `1234567` and digit `4`

#### Scenario: Verificador K is accepted in either case

- **WHEN** `parseRut` receives `10.000.013-K` or `10.000.013-k`
- **THEN** the result is ok with body `10000013` and digit `K`
- **AND** `1.000.005-K` is ok with body `1000005` and digit `K`
- **AND** `1.000.013-0` is ok with body `1000013` and digit `0`

#### Scenario: Mistyped verificador is rejected

- **WHEN** `parseRut` receives `12.345.678-9`, `1.234.567-9`, or `10.000.013-0`
- **THEN** the result is not ok
- **AND** the message is `El dígito verificador no corresponde al RUT ingresado.`
- **AND** the backend code is `RUT_DV_MISMATCH`
- **AND** the result does not contain a corrected digit

#### Scenario: Eight digits without a hyphen are body plus digit

- **WHEN** `parseRut` receives `12345678`
- **THEN** the result is not ok with message `El dígito verificador no corresponde al RUT ingresado.`
- **AND** the backend code is `RUT_DV_MISMATCH`

#### Scenario: Wrong length is invalid

- **WHEN** `parseRut` receives `123456` or `1234567890`
- **THEN** the result is not ok with message `El RUT ingresado no es válido.`
- **AND** the backend code is `RUT_INVALID`

#### Scenario: A non-digit inside the body is invalid

- **WHEN** `parseRut` receives `1K34567-4`
- **THEN** the result is not ok with message `El RUT ingresado no es válido.`
- **AND** the backend code is `RUT_INVALID`

#### Scenario: Empty input is required

- **WHEN** `parseRut` receives `''`, `null`, or `'  '`
- **THEN** the result is not ok with message `El RUT es obligatorio.`
- **AND** the backend code is `RUT_EMPTY`

### Requirement: Company payload rejects a verificador that does not match

`validateCompanyPayload` MUST surface `parseRut` failures for the company RUT and for each legal representative. A mismatched digit MUST NOT be stored as the módulo 11 digit. A representative body submitted without a digit MUST be invalid.

#### Scenario: Company RUT with a mistyped digit

- **WHEN** `validateCompanyPayload` is called with `requireAll: true` and a payload whose `rut` is `12.345.678-9` and whose other required fields are valid
- **THEN** the result is `ok: false`
- **AND** the errors include `El dígito verificador no corresponde al RUT ingresado.`

#### Scenario: Legal representative body and matching digit

- **WHEN** `validateCompanyPayload` receives `rut_body_legal_representative_1` `12345678` and `rut_dv_legal_representative_1` `5`
- **THEN** the result is ok
- **AND** the normalized data stores body `12345678` and digit `5`

#### Scenario: Legal representative digit does not match

- **WHEN** `validateCompanyPayload` receives `rut_body_legal_representative_1` `12345678` and `rut_dv_legal_representative_1` `9`
- **THEN** the result is `ok: false`

#### Scenario: Legal representative body without a digit

- **WHEN** `validateCompanyPayload` receives `rut_body_legal_representative_1` `12345678` and no `rut_dv_legal_representative_1`
- **THEN** the result is `ok: false`

### Requirement: formatRutInput does not correct a mistyped digit

`formatRutInput` MUST keep its current contract: when `parseRut` fails, it MUST return the trimmed input unchanged. `formatRut(body, dv)` MUST keep formatting the two parts without calling `parseRut`.

#### Scenario: Blur keeps a mistyped RUT

- **WHEN** `formatRutInput` receives `12.345.678-9`
- **THEN** it returns `12.345.678-9`

### Requirement: Company form rejects a legal representative verificador that does not match

`validateHeadquartersForCompanySubmit` MUST validate each legal representative RUT with the same verificador rules as `parseRut`. An empty representative RUT MUST be valid. A verificador digit that does not match MUST fail with message `El dígito verificador no corresponde al RUT ingresado.` and MUST NOT be replaced with the computed digit. The failure message MUST NOT include the expected digit or the submitted value. A valid first representative MUST NOT skip validation of the second.

The scenarios below use this valid headquarters base, varying only the representative fields named in each scenario: `businessName` `Dynamics Corp. SpA`, `shortName` `Dynamics`, `rut` `76.123.456-0`, `email` `''`.

#### Scenario: Legal representative 1 with a mistyped digit

- **WHEN** `validateHeadquartersForCompanySubmit` is called with `rutLegal1` `12.345.678-9` and `rutLegal2` empty
- **THEN** the result is `{ ok: false, message: 'El dígito verificador no corresponde al RUT ingresado.' }`

#### Scenario: Legal representative 2 with a mistyped digit

- **WHEN** `validateHeadquartersForCompanySubmit` is called with `rutLegal1` empty and `rutLegal2` `12.345.678-9`
- **THEN** the result is `{ ok: false, message: 'El dígito verificador no corresponde al RUT ingresado.' }`

#### Scenario: Eight digits without a hyphen are body plus digit

- **WHEN** `validateHeadquartersForCompanySubmit` is called with `rutLegal1` `12345678` and `rutLegal2` empty
- **THEN** the result is `{ ok: false, message: 'El dígito verificador no corresponde al RUT ingresado.' }`

#### Scenario: Legal representative 1 with a matching digit

- **WHEN** `validateHeadquartersForCompanySubmit` is called with `rutLegal1` `12.345.678-5` and `rutLegal2` empty
- **THEN** the result is `{ ok: true }`

#### Scenario: Legal representative 2 with a matching digit

- **WHEN** `validateHeadquartersForCompanySubmit` is called with `rutLegal1` empty and `rutLegal2` `12.345.678-5`
- **THEN** the result is `{ ok: true }`

#### Scenario: Both legal representatives are optional

- **WHEN** `validateHeadquartersForCompanySubmit` is called with `rutLegal1` and `rutLegal2` empty
- **THEN** the result is `{ ok: true }`

#### Scenario: A valid first representative does not skip the second

- **WHEN** `validateHeadquartersForCompanySubmit` is called with `rutLegal1` `12.345.678-5` and `rutLegal2` `12.345.678-9`
- **THEN** the result is `{ ok: false, message: 'El dígito verificador no corresponde al RUT ingresado.' }`


