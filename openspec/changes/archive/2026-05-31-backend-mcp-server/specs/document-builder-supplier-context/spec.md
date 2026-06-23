## ADDED Requirements

### Requirement: Document Builder dry-run validation

`generateAndPersist` in `documentBuilderService.js` SHALL accept `body.dryRun === true`. When dry run is active, the function MUST perform company scope resolution, supplier and template loading, placeholder substitution checks, and return success with `{ valid: true }` when all placeholders resolve. It MUST NOT upload to GCS, insert or update rows in `draft_document` or `document`, or delete existing GCS objects. When placeholders are missing, behavior MUST match the existing `MISSING_PLACEHOLDERS` response (HTTP-equivalent 422 semantics in the service result object).

#### Scenario: Dry run succeeds without side effects

- **WHEN** `generateAndPersist` is called with `body.dryRun: true` and all template variables resolve
- **THEN** the result is `ok: true` with validation success and no GCS or database mutations occur

#### Scenario: Dry run reports missing placeholders

- **WHEN** `generateAndPersist` is called with `body.dryRun: true` and unresolved template keys exist
- **THEN** the result is `ok: false` with code `MISSING_PLACEHOLDERS` and `missingFieldKeys`, without persisting a document

#### Scenario: Dry run skips duplicate draft check

- **WHEN** `generateAndPersist` is called with `body.dryRun: true` and an active duplicate draft would exist for the same month
- **THEN** validation still returns placeholder success without returning `DUPLICATE_DRAFT` and without writing data
