## MODIFIED Requirements

### Requirement: Seeds exclude removed profiles and test users

After this change, `backend/seeds/001_profiles_seed.js` SHALL seed only `ADMINISTRADOR_PLATAFORMA`. `backend/seeds/002_navigation_authorization_seed.js` SHALL NOT insert grants for `CONTADOR` or `USUARIO_EMPRESA_ADMINISTRADOR`, and SHALL NOT define or upsert navigation nodes whose code matches `ILIKE '%CONTADOR%'` (including `NAV_ITEM_ADMIN_GLOBAL_CONTADORES`, its READ/CREATE/EDIT actions, and `NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS`). `backend/seeds/010_gfa_user_profile_and_inheritance_seed.js` SHALL NOT seed `contador@incrementa.la`, `empresa@incrementa.la`, nor their Keycloak user entries for those profiles.

#### Scenario: Fresh seed run has single business profile

- **WHEN** `knex seed:run` executes on an empty database after migrations
- **THEN** `profile` contains `ADMINISTRADOR_PLATAFORMA` and does not contain `CONTADOR` or `USUARIO_EMPRESA_ADMINISTRADOR`

#### Scenario: Fresh seed run has no contador navigation nodes

- **WHEN** `knex seed:run` executes after migrations including `drop_contador_navigation_nodes`
- **THEN** `navigation_node` contains no row with code matching `ILIKE '%CONTADOR%'`

## ADDED Requirements

### Requirement: Residual contador navigation cleanup migration

The backend SHALL include migration `202605280001_drop_contador_navigation_nodes.js` that removes all `profile_navigation_grant` rows and `navigation_node` rows associated with codes matching `ILIKE '%CONTADOR%'`, completing the navigation cleanup omitted by the original drop-contador migration.

#### Scenario: Post-migration diagnostic query is empty

- **WHEN** querying grants joined to navigation nodes where `nn.code ILIKE '%CONTADOR%'`
- **THEN** zero rows are returned for any profile including `ADMINISTRADOR_PLATAFORMA`
