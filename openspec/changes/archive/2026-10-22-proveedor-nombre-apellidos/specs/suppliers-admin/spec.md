## ADDED Requirements

### Requirement: Person name split and compose

The backend MUST provide `splitFullName` and `composeFullName` in `backend/utils/personName.js`. `splitFullName` MUST accept a value and return `{ firstNames, lastName, maternalLastName }` as strings. A non-string, or a string that is empty after trim, MUST return three empty strings. Otherwise it MUST collapse repeated whitespace, split on spaces, and preserve accents and capitalization. The particles `de`, `del`, `la`, `las`, `los`, `y`, `e`, `san`, `santa`, `da`, `di`, `van`, and `von` MUST be matched case-insensitively and glued to the following word as one group, including a run of particles (`de la Fuente`). A trailing particle with no following word MUST remain its own group so that no token is dropped. Group assignment MUST be: one group → `firstNames` only; two groups → `firstNames` and `lastName`; three groups → one each; four or more → `maternalLastName` is the last group, `lastName` is the penultimate group, and `firstNames` is the remaining groups joined by a single space. `composeFullName` MUST trim each part, omit empty parts, and join the rest with a single space. For every fixture in the person-name tests, `composeFullName(splitFullName(x))` MUST equal `x` after trimming and collapsing whitespace.

#### Scenario: Four given-name tokens with a particle

- **WHEN** `splitFullName` is called with `María José Pérez Soto`
- **THEN** the result is `firstNames` `María José`, `lastName` `Pérez`, and `maternalLastName` `Soto`

#### Scenario: Particle group stays with the paternal surname

- **WHEN** `splitFullName` is called with `Ana de la Fuente Soto`
- **THEN** the result is `firstNames` `Ana`, `lastName` `de la Fuente`, and `maternalLastName` `Soto`

#### Scenario: Given names include a particle and there are four groups

- **WHEN** `splitFullName` is called with `Juan de la Cruz Pérez Soto`
- **THEN** the result is `firstNames` `Juan de la Cruz`, `lastName` `Pérez`, and `maternalLastName` `Soto`

#### Scenario: Two groups and a single token

- **WHEN** `splitFullName` is called with `Juan Pérez`
- **THEN** the result is `firstNames` `Juan`, `lastName` `Pérez`, and `maternalLastName` empty
- **AND** `splitFullName('Madonna')` returns `firstNames` `Madonna` and both surnames empty

#### Scenario: Whitespace and empty input

- **WHEN** `splitFullName` is called with `  Pedro   Soto  Ruiz  `
- **THEN** repeated spaces are collapsed in the parts
- **AND** a non-string or blank input returns three empty strings
- **AND** `composeFullName` omits empty parts and trims the remaining ones

### Requirement: Supplier name-part columns

The system MUST add nullable text columns `first_names`, `last_name`, and `maternal_last_name` on `supplier_persona_natural`, and `rep_first_names`, `rep_last_name`, and `rep_maternal_last_name` on `supplier_empresa`, in migration `202610210001_supplier_name_parts.js`. The migration MUST export `up` and `down`. `up` MUST backfill existing rows by calling `splitFullName` from `backend/utils/personName.js` on `full_name` or `nombre_rep_legal`, and only where that source has text and the part columns are NULL. Before writing parts, `up` MUST insert each affected child row into `supplier_child_backup` with `child_kind` `persona_natural` or `empresa`, `row_json` equal to the full row, and `note` `supplier-name-parts`. If that insert fails, `up` MUST throw and MUST NOT update any part column. After the fill, `up` MUST verify that `composeFullName` of the stored parts equals the source name after whitespace normalization; on any mismatch it MUST throw an error that lists the supplier ids and MUST NOT leave a partial fill committed. The fill MUST NOT rewrite `full_name` or `nombre_rep_legal`. `down` MUST drop the six new columns and MUST NOT modify `supplier_child_backup`.

#### Scenario: Existing names are split after a backup

- **WHEN** `up` runs against persona natural and empresa rows that have a source name and NULL parts
- **THEN** each affected row is inserted into `supplier_child_backup` with note `supplier-name-parts` before parts are written
- **AND** the part columns are filled from `splitFullName`
- **AND** `full_name` and `nombre_rep_legal` are unchanged

#### Scenario: Backup failure writes nothing

- **WHEN** inserting into `supplier_child_backup` throws
- **THEN** `up` throws
- **AND** no part column is updated

#### Scenario: Round-trip mismatch aborts

- **WHEN** a filled row's composed parts do not match the stored name after whitespace normalization
- **THEN** `up` throws an error that includes that supplier id
- **AND** the fill is not left committed

#### Scenario: Down drops only the new columns

- **WHEN** `down` runs
- **THEN** the six part columns are removed
- **AND** `supplier_child_backup` is left unchanged

### Requirement: Supplier persona natural name parts

On create and on update, persona natural input MUST accept `first_names`, `last_name`, `maternal_last_name`, and `full_name`. If any of the three part keys is present, the service MUST require non-empty `first_names` and `last_name` and MUST reject with the Spanish messages `Los nombres son obligatorios.` and `El apellido paterno es obligatorio.` respectively. `maternal_last_name` MUST be optional. In that mode the service MUST persist `full_name` as `composeFullName` of the parts, and MUST ignore a `full_name` sent in the same body. If only `full_name` is sent, an empty or missing value MUST be rejected with `El nombre completo es obligatorio.` on create, the trimmed `full_name` MUST be stored as today, and the three part columns MUST be set from `splitFullName`. On a partial update, omitted name keys MUST be kept from the stored row; the service MUST then reapply the same mode so the stored parts and `full_name` match. An update that changes only `last_name` MUST recompose `full_name`. Empty parts MUST be stored as NULL.

#### Scenario: Create from parts composes the visible name

- **WHEN** an authorized client creates a persona natural with `first_names` `María José`, `last_name` `Pérez`, and `maternal_last_name` `Soto`, without `full_name`
- **THEN** the stored `full_name` is `María José Pérez Soto`
- **AND** the three part columns hold those values

#### Scenario: Create from full name derives parts

- **WHEN** an authorized client creates a persona natural with only `full_name` `Juan Pérez`
- **THEN** the stored `full_name` is `Juan Pérez`
- **AND** the stored parts are `Juan`, `Pérez`, and NULL

#### Scenario: Incomplete parts rejected

- **WHEN** an authorized client sends persona natural parts without `last_name`
- **THEN** the response is HTTP 400 with message `El apellido paterno es obligatorio.`
- **AND** no supplier row is inserted

#### Scenario: Parts win over a different full name

- **WHEN** an authorized client sends `first_names` `Ana`, `last_name` `Soto`, and `full_name` `Otro Nombre`
- **THEN** the stored `full_name` is `Ana Soto`
- **AND** the stored `full_name` is not `Otro Nombre`

#### Scenario: Partial update recomposes the visible name

- **WHEN** an authorized client updates only `last_name` to `Soto` on a persona natural whose stored given names are `Juan`
- **THEN** the stored `last_name` is `Soto`
- **AND** the stored `full_name` is recomposed from the merged parts

### Requirement: Supplier legal representative name parts

Empresa representative input MUST accept `rep_first_names`, `rep_last_name`, `rep_maternal_last_name`, and `nombre_rep_legal` with the same two modes as persona natural. The representative MUST remain optional. On create, when none of those keys is present, `nombre_rep_legal` and the three rep part columns MUST be NULL. When any rep part key is present, non-empty `rep_first_names` and `rep_last_name` MUST be required, using `Los nombres son obligatorios.` and `El apellido paterno es obligatorio.` When only `nombre_rep_legal` is sent, the parts MUST be derived with `splitFullName` and the trimmed text stored as today. On partial update, omitted rep keys MUST be kept and the stored parts and `nombre_rep_legal` MUST be left consistent with the mode that applies.

#### Scenario: Create empresa with representative parts

- **WHEN** an authorized client creates an empresa and sends `rep_first_names` and `rep_last_name` only
- **THEN** `nombre_rep_legal` is the composition of those parts
- **AND** `rep_maternal_last_name` is NULL

#### Scenario: Create empresa without a representative

- **WHEN** an authorized client creates an empresa without representative name keys
- **THEN** `nombre_rep_legal` and the three rep part columns are NULL

#### Scenario: Incomplete representative rejected

- **WHEN** an authorized client sends `rep_first_names` without `rep_last_name`
- **THEN** the response is HTTP 400 with message `El apellido paterno es obligatorio.`
- **AND** no supplier row is inserted

### Requirement: Supplier detail returns name parts

`GET /api/suppliers/:id` MUST include `first_names`, `last_name`, `maternal_last_name`, `rep_first_names`, `rep_last_name`, and `rep_maternal_last_name`, each `null` when the column is null. The six keys MUST appear for both supplier types. Existing detail fields MUST stay. `GET /api/suppliers` MUST NOT add these six keys to list items, and list search and ordering MUST keep using `full_name` and `razon_social`.

#### Scenario: Detail includes all six parts

- **WHEN** an authorized client requests an existing supplier
- **THEN** the response includes the six part fields
- **AND** a part that was not stored is `null`
- **AND** `full_name` or `nombre_rep_legal` is still present as today

#### Scenario: List shape is unchanged

- **WHEN** an authorized client requests `GET /api/suppliers`
- **THEN** list items do not include the six part keys

### Requirement: Supplier form captures name parts

The persona natural block MUST show three fields labeled `Nombres`, `Apellido paterno`, and `Apellido materno` instead of `Nombre completo`. `Nombres` and `Apellido paterno` MUST be required; `Apellido materno` MUST NOT be required. The empresa `Representante legal` section MUST show the same three labels. The representative MUST stay optional: submitting with all three boxes empty MUST omit `rep_first_names`, `rep_last_name`, `rep_maternal_last_name`, and `nombre_rep_legal`. Submitting with any representative text MUST send the three part keys and MUST require given names and paternal surname with the same Spanish messages as the backend. Create and edit payloads MUST send the part keys and MUST NOT send `full_name` or `nombre_rep_legal`. `emptySupplierForm()` and the supplier-to-form mapping MUST keep `full_name` and `nombre_rep_legal` and MUST add the six part fields. Opening an existing supplier MUST fill the boxes from the detail parts. When the detail omits parts and a composed name is present, the client MUST fill the boxes with the same split rule as `splitFullName`. When no name text is present, the boxes MUST be empty. Read-only view MUST show the same three boxes. Validation copy MUST be Spanish. The fields MUST use the existing supplier form classes and MUST NOT add a library.

#### Scenario: Persona natural shows three boxes

- **WHEN** a user opens the persona natural form
- **THEN** the labels `Nombres`, `Apellido paterno`, and `Apellido materno` are shown
- **AND** `Nombre completo` is not shown
- **AND** maternal surname is not marked required

#### Scenario: Payload sends parts

- **WHEN** a user submits a valid persona natural form
- **THEN** the payload includes `first_names`, `last_name`, and `maternal_last_name`
- **AND** the payload does not include `full_name`

#### Scenario: Existing supplier fills the boxes

- **WHEN** the edit form loads a supplier whose detail includes the three persona natural parts
- **THEN** each box shows that part

#### Scenario: Empty representative sends nothing

- **WHEN** a user submits an empresa form with the three representative boxes empty
- **THEN** the payload does not include `rep_first_names`, `rep_last_name`, `rep_maternal_last_name`, or `nombre_rep_legal`

#### Scenario: Representative given names required when any part is typed

- **WHEN** a user fills only the representative maternal surname and submits
- **THEN** validation fails with `Los nombres son obligatorios.` or `El apellido paterno es obligatorio.`
- **AND** the message is Spanish

## MODIFIED Requirements

### Requirement: Supplier create API

The backend MUST expose `POST /api/suppliers` requiring `NAV_ACTION_PROVEEDORES_CREATE` (CASL `create` on `Supplier`). Creation MUST validate required fields by type (`persona_natural`: a name — non-empty `full_name`, or non-empty `first_names` and `last_name` — and `document_number`; `empresa`: `razon_social`, `document_number`), require `country_code` present in `identity_document_type`, resolve and validate the document via the catalog validator registry (Chilean RUT through existing `parseRut`; RFC through `pattern_compact` according to supplier type; other `pattern` types against the country's real identifier), require `email` (trimmed, lowercase, `isValidEmail`), accept optional `phone` with lax shape validation, validate each social network entry with required `catalog_id` (UUID referencing an existing `social_network_catalog` row) and `account_name`, insert supplier (including `email`, `phone`, and `country_code` on the base row) and social networks atomically in a transaction, and set `created_by` and `updated_by` to the authenticated user. Persona natural and empresa representative names MUST follow the name-part requirements: parts mode composes `full_name` or `nombre_rep_legal`, and text mode still accepts `full_name` or `nombre_rep_legal` alone and derives the parts. Requests with invalid or unknown `catalog_id` MUST fail with HTTP 400 and a message in Spanish. Requests missing or invalid `email` MUST fail with HTTP 400 and a Spanish message that does not echo the submitted mailbox. Requests with an invalid document MUST fail with HTTP 400 and a Spanish message that does not echo the submitted identifier.

#### Scenario: Create persona natural

- **WHEN** an authorized client posts valid persona natural data including a valid `email`, `country_code`, document identifier, and social networks containing valid `catalog_id` and `account_name`
- **THEN** the response is HTTP 201 and the supplier and networks are persisted with `catalog_id` foreign keys
- **AND** the persisted row includes the normalized `email` and canonical `document_number`

#### Scenario: Create persona natural with only the composed name

- **WHEN** an authorized client posts a persona natural with `full_name` and without the part keys
- **THEN** the response is HTTP 201
- **AND** the stored `full_name` is the trimmed submitted name
- **AND** the part columns are derived from that name

#### Scenario: Invalid RUT rejected

- **WHEN** an authorized client posts a supplier with an invalid RUT
- **THEN** the response is HTTP 400 with an error message in Spanish

#### Scenario: Invalid catalog_id rejected

- **WHEN** an authorized client posts social networks with a `catalog_id` that does not exist in `social_network_catalog`
- **THEN** the response is HTTP 400 with a Spanish validation message
- **AND** no supplier row is inserted
