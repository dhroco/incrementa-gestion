# remove-clauses-functionality Specification

## Purpose
TBD - created by archiving change remove-clauses-functionality. Update Purpose after archive.
## Requirements
### Requirement: No clause API surface

The backend MUST NOT register routes under `/api/clauses`. Requests to former clause endpoints MUST NOT be handled by clause controllers or middleware.

#### Scenario: Legacy clause endpoint unavailable
- **WHEN** an authenticated client sends `GET /api/clauses/universal`
- **THEN** the server responds with HTTP 404 (or equivalent not-found for unregistered routes)

### Requirement: No clause navigation or grants

The system MUST NOT expose navigation items or authorization actions for universal or company-scoped clauses. Seeds and navigation configuration MUST NOT insert `NAV_ITEM_CONTRATOS_CLAUSULAS_*` or `NAV_ACTION_CONTRATOS_CLAUSULAS_*` nodes.

#### Scenario: Menu after seed
- **WHEN** navigation is loaded for a user with contract-management access
- **THEN** the sidebar does not include entries for cláusulas universales or cláusulas por empresa

### Requirement: No clause database tables

After applying migration `202605280001_drop_clause_tables`, the database MUST NOT contain tables `clause`, `clause_universal`, or `clause_company`.

#### Scenario: Post-migration schema
- **WHEN** `knex migrate:latest` completes successfully
- **THEN** querying `information_schema.tables` for those names returns no rows

### Requirement: Template editor without embedded clauses

The Rich Text editor used for standard and company templates MUST NOT register the `embeddedUniversalClause` node extension and MUST NOT offer UI to open a clause catalog or insert embedded clauses.

#### Scenario: Template edit toolbar
- **WHEN** a user edits a standard or company template in the Rich Text editor
- **THEN** no control is available to insert or browse clauses

### Requirement: Template preview without clause resolution

Viewing or generating output from a template MUST NOT call clause APIs or resolve `embeddedUniversalClause` nodes. Other template content (paragraphs, variables, non-clause nodes) MUST render normally.

#### Scenario: Template with legacy embedded clause node
- **WHEN** `content_json` contains a node of type `embeddedUniversalClause`
- **THEN** preview and PDF generation complete without error and without fetching clause data

### Requirement: Templates CRUD unchanged

The system MUST continue to support listing, creating, reading, updating, and generating standard and company templates through existing non-clause APIs and pages.

#### Scenario: Standard template list
- **WHEN** a user with template read grant opens standard templates
- **THEN** the list loads and opens detail views without clause-related errors

### Requirement: No orphan clause code references

Application source under `frontend/src` and `backend` (excluding historical `migrations/`) MUST NOT import deleted clause modules or reference removed clause routes after the change is applied.

#### Scenario: Repository grep check
- **WHEN** searching application source for `clausesApi`, `clauseService`, or `embeddedUniversalClause` in import paths
- **THEN** no matches remain outside archived migration history

