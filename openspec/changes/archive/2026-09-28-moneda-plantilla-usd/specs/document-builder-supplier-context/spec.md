## ADDED Requirements

### Requirement: Template currency code

Table `template` MUST have `currency_code` (`varchar(3)`, NOT NULL, default `'CLP'`) with a check constraint named `template_currency_code_check` that admits only `'CLP'` and `'USD'`. Migration `202609280001_template_currency_code` MUST add that column and that check, and MUST NOT set any row to `'USD'` or rewrite `content_json`. Migration `202609280002_mx_price_clause_usd` MUST set `currency_code` to `'USD'` on templates `CONTRATO_0016` and `CONTRATO_0017`. Every other existing `template` row MUST remain `'CLP'` via the column default. `getTemplateRow` MUST select `t.currency_code`. Operational order MUST be migration `202609280001`, then the backend deploy, then migration `202609280002`. Before running `202609280002` in pre-production or production, the real codes of `CONTRATO_0016` and `CONTRATO_0017` MUST be confirmed.

#### Scenario: Mexican templates tagged USD

- **WHEN** the template currency migration completes
- **THEN** `CONTRATO_0016` and `CONTRATO_0017` have `currency_code` `USD`
- **AND** every other existing template row has `currency_code` `CLP`

### Requirement: Mexican price clause in US dollars

`rewriteMxPriceClause(contentJson)`, exported from `backend/migrations/202609280002_mx_price_clause_usd.js`, MUST return a new document and MUST NOT mutate its input. It MUST find the single paragraph in the document whose content contains a variable node with `variableId` `precio_numero`. That paragraph MUST have exactly these eight nodes, in order: bold text `3.1 `; text `El precio de los Servicios que `; variable `company_nombre_comercial`; text ` pagará al Influencer, corresponderá a una cantidad fija y única en moneda de curso legal en (Tipo de moneda País), de `; variable `precio_numero`; text ` `; variable `precio_texto`; text ` líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el “Precio”.` (curly quotes U+201C and U+201D around Precio).

The function MUST replace only nodes at indexes 3, 5, and 7, after verifying each current text exactly:

- index 3 becomes ` pagará al Influencer, corresponderá a una cantidad fija y única, en dólares de los Estados Unidos de América, de `
- index 5 becomes ` (`
- index 7 becomes ` dólares de los Estados Unidos de América) líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el “Precio”.`

Every other node, mark, attribute, and variable MUST stay identical, including any sibling paragraph. If there is not exactly one paragraph containing `precio_numero`, or that paragraph does not have exactly these eight nodes with these texts and variable ids, the function MUST throw an `Error` whose message states what failed to match, and MUST NOT return a partial document.

The migration `202609280002_mx_price_clause_usd` `up` MUST, for `CONTRATO_0016` and `CONTRATO_0017`, insert the current `content_json` into `template_content_backup` with note `moneda-plantilla-usd: cláusula 3.1 en dólares` and then store the rewritten document. It MUST call `rewriteMxPriceClause` in a way that a throw for either template aborts `up` before those templates are updated. Chilean template wording MUST NOT change. That migration's `down` MUST restore `content_json` from backups with that note, delete those backup rows, and set `currency_code` back to `'CLP'` on `CONTRATO_0016` and `CONTRATO_0017`. It MUST NOT drop `template_currency_code_check` or `currency_code`. Migration `202609280001_template_currency_code` `down` MUST drop `template_currency_code_check` and drop `currency_code`.

#### Scenario: Clause nodes rewritten and input unchanged

- **WHEN** `rewriteMxPriceClause` receives a document whose price paragraph is the eight-node clause above, plus another paragraph
- **THEN** nodes 3, 5, and 7 of the price paragraph have the new texts
- **AND** every other node of that paragraph and the other paragraph are identical to the input
- **AND** the input document is unchanged

#### Scenario: Plain text is the US dollar clause

- **WHEN** the rewritten price paragraph is rendered to plain text and `precio_numero` / `precio_texto` are replaced by `US$1,290` and `mil doscientos noventa`
- **THEN** the text is `3.1 El precio de los Servicios que {{company_nombre_comercial}} pagará al Influencer, corresponderá a una cantidad fija y única, en dólares de los Estados Unidos de América, de US$1,290 (mil doscientos noventa dólares de los Estados Unidos de América) líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el “Precio”.`

#### Scenario: Mismatch throws

- **WHEN** the price paragraph's node 3 text is already the rewritten dollar wording, or the document has no paragraph with `precio_numero`, or it has two
- **THEN** `rewriteMxPriceClause` throws an `Error` that states what did not match

### Requirement: Generate formats price with the template currency

`generateAndPersist` MUST load the template row before `preprocessMissingFieldOverrides` and MUST call `preprocessMissingFieldOverrides(overridesRaw, { currencyCode: templateRow.currency_code })`. `validateSelectOverrides` MUST still run on the raw overrides and MUST stay before preprocessing. After preprocessing, `loadCompanyRow` and the country-coherence check MUST keep their current relative order. A missing template MUST still return `ok: false`, status 404, and message `Plantilla no encontrada.` A country mismatch MUST still return the same validation error as today.

On a real generate (`dryRun` not set), the persisted `contract_overrides` MUST contain `precio_numero` already formatted for that template currency.

#### Scenario: USD template stores US dollar price

- **WHEN** an authorized client generates without dry-run using a template with `currency_code` `USD` whose `country_code` matches the supplier, and overrides include `precio_numero` `1290`
- **THEN** the stored `contract_overrides.precio_numero` is `US$1,290`

#### Scenario: CLP template stores Chilean price

- **WHEN** an authorized client generates without dry-run using a template with `currency_code` `CLP` whose `country_code` matches the supplier, and overrides include `precio_numero` `1290`
- **THEN** the stored `contract_overrides.precio_numero` is `$1.290`
