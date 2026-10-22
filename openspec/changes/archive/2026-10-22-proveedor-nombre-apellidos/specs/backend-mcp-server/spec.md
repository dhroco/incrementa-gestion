## ADDED Requirements

### Requirement: MCP supplier tools accept name parts

`crear_proveedor` and `actualizar_proveedor` MUST accept optional `first_names`, `last_name`, `maternal_last_name`, `rep_first_names`, `rep_last_name`, and `rep_maternal_last_name` and MUST pass them through to `supplierService` with no separate validation path. The tool descriptions MUST state that the six keys are optional. When the keys are omitted, create and update MUST behave as they do today, including create and update with only `full_name` or `nombre_rep_legal`. When any part key is present, the service name-part rules apply, including Spanish errors and parts winning over a composed name in the same payload.

#### Scenario: Create supplier from name parts

- **WHEN** a client invokes `crear_proveedor` with valid persona natural fields and `first_names`, `last_name`, and `maternal_last_name`
- **THEN** the tool returns `ok: true`
- **AND** the created supplier `full_name` is the composition of those parts

#### Scenario: Create supplier with only the full name

- **WHEN** a client invokes `crear_proveedor` with `full_name` and without the part keys
- **THEN** the tool returns `ok: true`
- **AND** the created supplier keeps that full name
- **AND** the stored parts are derived from it

#### Scenario: Update supplier last name

- **WHEN** a client invokes `actualizar_proveedor` with only `last_name` for an existing persona natural
- **THEN** the tool returns `ok: true`
- **AND** the supplier `full_name` is recomposed from the merged parts

#### Scenario: Incomplete parts return the service error

- **WHEN** a client invokes `crear_proveedor` with `first_names` and without `last_name`
- **THEN** the tool returns `ok: false` with message `El apellido paterno es obligatorio.`
- **AND** no supplier row is inserted
