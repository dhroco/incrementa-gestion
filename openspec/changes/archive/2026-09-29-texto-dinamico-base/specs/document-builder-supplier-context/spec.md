## ADDED Requirements

### Requirement: Contrato group lists dynamic text variables

The frontend variable catalog group `contrato` in `frontend/src/data/variableCatalog.js` MUST include `servicios_entregables` with label `Entregables (cláusula 2.3)` and `cuentas_publicacion` with label `Cuentas de publicación (cláusula 2.5)`. Each MUST have `type: 'dynamic_text'`. The `description` of each MUST be the `instruccion` of the same id in the backend dynamic text catalog. Entries that are not dynamic text MUST NOT gain a `type` property. The variables this group already lists MUST remain listed.

#### Scenario: Entregables listed under contrato

- **WHEN** a user opens the contrato group in the variable catalog
- **THEN** `servicios_entregables` is listed with label `Entregables (cláusula 2.3)`, `type` `dynamic_text`, and description `Escribe qué publicará el influencer: cantidad en palabras y en cifra, formato y red social de cada entregable.`

#### Scenario: Cuentas de publicación listed under contrato

- **WHEN** a user opens the contrato group in the variable catalog
- **THEN** `cuentas_publicacion` is listed with label `Cuentas de publicación (cláusula 2.5)`, `type` `dynamic_text`, and description `Escribe la cuenta del influencer en cada red social nombrada en los entregables.`

#### Scenario: Existing contrato variables stay untyped

- **WHEN** a user opens the contrato group in the variable catalog
- **THEN** `fecha_contrato` is still listed and has no `type`
