# drop-company-templates-module Specification

## Purpose
TBD - created by archiving change drop-company-templates-module. Update Purpose after archive.
## Requirements
### Requirement: No company template CRUD or navigation

The system MUST NOT expose API endpoints, frontend routes, sidebar entries, or navigation grants for company-scoped templates (`template_company`). Users MUST NOT be able to create, list, view, or edit templates por empresa.

#### Scenario: Company templates API removed
- **WHEN** an authenticated client requests `GET /api/company-templates`
- **THEN** the server responds with HTTP 404

#### Scenario: Company templates menu absent
- **WHEN** an authorized user loads the application sidebar for gestión de contratos
- **THEN** no menu item or route for templates por empresa is shown

#### Scenario: Navigation grants removed
- **WHEN** database migration `202605290009` completes
- **THEN** no rows exist in `navigation_node` or `profile_navigation_grant` whose `code` contains `TEMPLATES_POR_EMPRESA`

### Requirement: template_company table dropped

Migration `202605290008` MUST drop the `company_template_id` column from `generated_document` (after dropping constraint `generated_document_one_template_ck` if present) and MUST drop table `template_company` with CASCADE.

#### Scenario: Schema cleanup
- **WHEN** migration `202605290008` runs successfully
- **THEN** table `template_company` does not exist and `generated_document` has no column `company_template_id`

#### Scenario: Standard template module unaffected
- **WHEN** migration `202605290008` runs
- **THEN** tables `template` and `template_standard` remain intact with existing standard template data

### Requirement: Standard templates module remains fully functional

The standard templates module (`/api/standard-templates/*`, `StandardTemplates*.jsx`, `StandardTemplateEditor` in standard mode) MUST continue to support list, create, view, edit, and preview without regression.

#### Scenario: Standard template list works
- **WHEN** an authorized user with standard template read grant opens templates estándar
- **THEN** the list loads from `/api/standard-templates` as before

#### Scenario: Standard template editor works
- **WHEN** an authorized user creates or edits a standard template
- **THEN** save persists via standard templates API and redirects to the standard templates list

