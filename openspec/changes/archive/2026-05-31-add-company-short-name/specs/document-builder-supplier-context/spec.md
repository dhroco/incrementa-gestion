## ADDED Requirements

### Requirement: Company commercial name substitution

`buildSubstitutionMap` in `documentBuilderVariableContext.js` MUST map `company_nombre_comercial` to the trimmed string value of `company.short_name`, or empty string when absent. `documentBuilderService.js` `VARIABLE_META` MUST define `company_nombre_comercial` with `label: 'Nombre Comercial'`, `type: 'text'`, and `source: 'company'`. The frontend variable catalog group `empresa` MUST list `company_nombre_comercial` immediately after `company_legal_name` with description stating it is the abbreviated or commercial name used in contracts.

#### Scenario: Template resolves commercial name from company

- **WHEN** a template contains `{{company_nombre_comercial}}` and the selected company has `short_name` `"Dynamics"`
- **THEN** the generated document text contains `"Dynamics"`

#### Scenario: Variable catalog lists commercial name

- **WHEN** a user opens the empresa group in the variable catalog
- **THEN** `company_nombre_comercial` appears after `company_legal_name`

#### Scenario: Missing short_name resolves empty

- **WHEN** a template contains `{{company_nombre_comercial}}` and company row has empty `short_name`
- **THEN** the substitution map value for `company_nombre_comercial` is an empty string
