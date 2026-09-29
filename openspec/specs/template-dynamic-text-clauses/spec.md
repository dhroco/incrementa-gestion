# template-dynamic-text-clauses Specification

## Purpose
TBD - created by archiving change texto-dinamico-plantillas. Update Purpose after archive.

## Requirements
### Requirement: Dynamic text clause rewrite

`backend/migrations/202609290001_dynamic_text_clauses.js` MUST export a pure function `rewriteDynamicTextClauses(contentJson, code)`. It MUST return a new document and MUST NOT mutate `contentJson`. The expected current paragraph of each variant is the `parrafo` object in `docs/disenos/prompts/texto-dinamico-plantillas.fixtures.json` (read-only). Tests MUST copy those objects into the test file. The migration MUST NOT import `docs/**`.

Before replacing a paragraph, the function MUST match its nodes, in order, by `type`, `text`, and `attrs.variableId`, and by the `marks` of text nodes. A variable node's other `attrs` are not part of that match. There MUST be exactly one matching paragraph for clause 2.3. When the code has an account variant, there MUST be exactly one matching account paragraph. Any other node in the document MUST stay identical.

The code MUST select the variants below. A code not in this table MUST throw an `Error` whose Spanish message includes that code. A paragraph that does not match (including a document that is already rewritten) MUST throw an `Error` whose Spanish message includes the code and what failed to match. The input MUST stay unchanged when the function throws.

| Codes | Clause 2.3 | Account clause |
| --- | --- | --- |
| CONTRATO_0001, CONTRATO_0002, CONTRATO_0003, CONTRATO_0004, CONTRATO_0005, CONTRATO_0006, CONTRATO_0007, CONTRATO_0009 | `A` | `A_negrita` (2.5) |
| CONTRATO_0008 | `A_colaboracion` | `A_negrita` (2.5) |
| CONTRATO_0010, CONTRATO_0011, CONTRATO_0012, CONTRATO_0013, CONTRATO_0014, CONTRATO_0015 | `A` | `A` (2.5) |
| CONTRATO_0016 | `MX` | `MX` (2.5) |
| CONTRATO_0017 | `MX` | none |
| PL0001, PL0002, PL0003, PL0004 | `PL` | `PL` (2.6) |

Each new `variable` node MUST copy `bold`, `italic`, `underline`, and `uppercase` from the first variable it replaces, and MUST set `group` to `contrato`, `variableId` to the id below, and `label` to the catalog label. Clause 2.3 replaces starting at `cantidad_reels`. The account clause of `A`, `A_negrita`, and `MX` replaces starting at `proveedor_cuenta_social`. The `PL` account clause replaces starting at `proveedor_red_social`. Catalog labels are `Entregables (cláusula 2.3)` for `servicios_entregables` and `Cuentas de publicación (cláusula 2.5)` for `cuentas_publicacion`. The new variable node MUST NOT have `marks`. Paragraph `attrs` MUST stay as in the input. Nodes the wording does not replace, including `company_nombre_comercial` and its `marks`, MUST stay identical.

Clause 2.3 result, with variables written as `{{id}}` in the plain text:

- `A`: nodes `2.3 ` (bold mark), `En concreto, los Servicios comprenden la generación y publicación de `, variable `servicios_entregables`, `, en el o los perfiles del Influencer y en el perfil oficial `, variable `client_product_campaign` (unchanged), `.`. Plain text: `2.3 En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}}, en el o los perfiles del Influencer y en el perfil oficial {{client_product_campaign}}.`
- `A_colaboracion`: the same nodes as `A`, except the last text node is ` bajo la colaboración pagada.`. Plain text: `2.3 En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}}, en el o los perfiles del Influencer y en el perfil oficial {{client_product_campaign}} bajo la colaboración pagada.`
- `MX`: nodes `2.3 ` (bold mark), `En concreto, los Servicios comprenden la generación y publicación de `, variable `servicios_entregables`, `, contenido que debe ser publicado tanto en el o los perfiles del Influencer, como en el de `, variable `client_brand` (unchanged), `, bajo la modalidad de “colaboración pagada” identificando la cuenta ` (curly quotes U+201C and U+201D), variable `client_brand_account` (unchanged), `.`. Plain text: `2.3 En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}}, contenido que debe ser publicado tanto en el o los perfiles del Influencer, como en el de {{client_brand}}, bajo la modalidad de “colaboración pagada” identificando la cuenta {{client_brand_account}}.`
- `PL`: nodes `2.3 En concreto, los Servicios comprenden la generación y publicación de ` (no marks), variable `servicios_entregables`, `, en el o los perfiles del Influencer y en el perfil oficial `, variable `client_brand_account` (unchanged), `.`. Plain text: `2.3 En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}}, en el o los perfiles del Influencer y en el perfil oficial {{client_brand_account}}.`

The rewritten 2.3 MUST NOT contain `cantidad_reels`, `formato_reel`, or `proveedor_red_social`. The `MX` 2.3 MUST NOT contain `Instagram`.

Account-clause result:

- `A_negrita` and `A`: nodes `2.5 ` (bold mark), `El Influencer deberá publicar el contenido a través de `, variable `cuentas_publicacion`, `. Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de `, variable `company_nombre_comercial` (unchanged, including marks), ` para celebrar el presente Contrato.`. Plain text: `2.5 El Influencer deberá publicar el contenido a través de {{cuentas_publicacion}}. Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de {{company_nombre_comercial}} para celebrar el presente Contrato.`
- `MX`: the same structure as `A`, with the second text node `El Influencer se obliga a publicar el contenido a través de `. Plain text uses `se obliga a publicar` and the same sentence after the variable.
- `PL`: nodes `2.6 El Influencer deberá publicar el contenido a través de ` (no marks), variable `cuentas_publicacion`, `. Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de `, variable `company_nombre_comercial` (unchanged), ` para celebrar el presente Contrato.`. Plain text starts with `2.6 El Influencer deberá publicar el contenido a través de {{cuentas_publicacion}}. Esta condición es un elemento esencial`.

The rewritten account clause MUST NOT contain `proveedor_cuenta_social`. The `PL` account clause MUST NOT contain `proveedor_red_social`. The `A` and `A_negrita` account clause MUST contain the period immediately before `Esta condición`. `company_nombre_comercial` in `A_negrita` MUST keep its bold `marks`; in `A` that variable MUST keep having no `marks`.

CONTRATO_0017 MUST rewrite clause 2.3 as `MX` and MUST leave every other paragraph unchanged, including its clause 2.5.

#### Scenario: Variant A rewrites clause 2.3

- **WHEN** `rewriteDynamicTextClauses` receives a document whose clause 2.3 is the fixture paragraph `A`, plus another paragraph, and the code is `CONTRATO_0001`
- **THEN** the clause 2.3 plain text is `2.3 En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}}, en el o los perfiles del Influencer y en el perfil oficial {{client_product_campaign}}.`
- **AND** the new variable node has `variableId` `servicios_entregables`, `group` `contrato`, `label` `Entregables (cláusula 2.3)`, and the format flags of the replaced `cantidad_reels` node
- **AND** `client_product_campaign` is unchanged
- **AND** the other paragraph and the input document are unchanged

#### Scenario: Collaboration template keeps the closing words

- **WHEN** `rewriteDynamicTextClauses` receives the fixture paragraph `A_colaboracion` and the code `CONTRATO_0008`
- **THEN** the plain text ends with `{{client_product_campaign}} bajo la colaboración pagada.`

#### Scenario: Mexican clause 2.3 drops the hardcoded network

- **WHEN** `rewriteDynamicTextClauses` receives the fixture paragraph `MX` for clause 2.3 and the code `CONTRATO_0016`
- **THEN** the plain text is `2.3 En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}}, contenido que debe ser publicado tanto en el o los perfiles del Influencer, como en el de {{client_brand}}, bajo la modalidad de “colaboración pagada” identificando la cuenta {{client_brand_account}}.`
- **AND** the paragraph does not contain `Instagram`, `cantidad_reels`, `formato_reel`, or `proveedor_red_social`
- **AND** the quotes around `colaboración pagada` are U+201C and U+201D

#### Scenario: PL clause 2.3 keeps the unbolded opening

- **WHEN** `rewriteDynamicTextClauses` receives the fixture paragraph `PL` for clause 2.3 and the code `PL0001`
- **THEN** the plain text is `2.3 En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}}, en el o los perfiles del Influencer y en el perfil oficial {{client_brand_account}}.`
- **AND** the opening text node has no marks

#### Scenario: Account clause uses the publication accounts

- **WHEN** `rewriteDynamicTextClauses` receives the fixture account paragraph `A` and the code `CONTRATO_0010`
- **THEN** the account plain text is `2.5 El Influencer deberá publicar el contenido a través de {{cuentas_publicacion}}. Esta condición es un elemento esencial del siguiente acuerdo, debido a que los seguidores con los que cuenta el Influencer en esa cuenta, son la razón principal de {{company_nombre_comercial}} para celebrar el presente Contrato.`
- **AND** the new variable node has `variableId` `cuentas_publicacion`, `group` `contrato`, `label` `Cuentas de publicación (cláusula 2.5)`, and the format flags of the replaced `proveedor_cuenta_social` node
- **AND** `company_nombre_comercial` has no marks

#### Scenario: Bold commercial name stays on the early templates

- **WHEN** `rewriteDynamicTextClauses` receives the fixture account paragraph `A_negrita` and the code `CONTRATO_0001`
- **THEN** the account plain text matches variant `A`
- **AND** `company_nombre_comercial` still has a bold mark

#### Scenario: Mexican account clause keeps the obligation verb

- **WHEN** `rewriteDynamicTextClauses` receives the fixture account paragraph `MX` and the code `CONTRATO_0016`
- **THEN** the account plain text contains `se obliga a publicar el contenido a través de {{cuentas_publicacion}}.`
- **AND** it does not contain `Instagram` or `proveedor_cuenta_social`

#### Scenario: PL account clause is numbered 2.6

- **WHEN** `rewriteDynamicTextClauses` receives the fixture account paragraph `PL` and the code `PL0001`
- **THEN** the account plain text starts with `2.6 El Influencer deberá publicar el contenido a través de {{cuentas_publicacion}}. Esta condición es un elemento esencial`
- **AND** the paragraph does not contain `proveedor_red_social` or `proveedor_cuenta_social`

#### Scenario: CONTRATO_0017 rewrites only clause 2.3

- **WHEN** `rewriteDynamicTextClauses` receives a document with the `MX` clause 2.3 fixture and a different clause 2.5 paragraph, and the code is `CONTRATO_0017`
- **THEN** clause 2.3 is the rewritten `MX` text
- **AND** the clause 2.5 paragraph is unchanged

#### Scenario: A mismatch throws and leaves the input

- **WHEN** `rewriteDynamicTextClauses` receives a document whose clause 2.3 is already the rewritten `A` text, and the code is `CONTRATO_0001`
- **THEN** it throws an `Error` whose message includes `CONTRATO_0001` and what failed to match
- **AND** the input document is unchanged

#### Scenario: An unknown code throws

- **WHEN** `rewriteDynamicTextClauses` is called with code `CONTRATO_9999`
- **THEN** it throws an `Error` whose message includes `CONTRATO_9999`

### Requirement: Template backup migration

Migration `202609290001_dynamic_text_clauses` `up` MUST load templates `CONTRATO_0001` through `CONTRATO_0017` and `PL0001` through `PL0004` by `template.code`. If any of those 21 codes is missing, `up` MUST throw an `Error` whose Spanish message includes the missing codes, and MUST NOT insert into `template_content_backup` or update `template.content_json`. If all 21 exist, `up` MUST compute `rewriteDynamicTextClauses` for every one of them before the first insert. Only after all 21 rewrites succeed, `up` MUST insert each previous `content_json` into `template_content_backup` with note `texto-dinamico-plantillas: 2.3 y cuenta con texto dinámico` and then store the rewritten document. Existing migration files MUST NOT be edited. This change MUST NOT run the migration or open a database connection.

`down` MUST restore `template.content_json` from `template_content_backup` rows with that note and MUST delete those rows. It MUST NOT change any other column.

#### Scenario: Backup note matches the restore key

- **WHEN** `up` has rewritten the 21 templates
- **THEN** each previous `content_json` is stored in `template_content_backup` with note `texto-dinamico-plantillas: 2.3 y cuenta con texto dinámico`
- **AND** `down` copies those documents back onto `template` and deletes the rows with that note
