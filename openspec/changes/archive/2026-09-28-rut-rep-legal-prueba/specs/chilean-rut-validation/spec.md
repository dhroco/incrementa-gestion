## ADDED Requirements

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
