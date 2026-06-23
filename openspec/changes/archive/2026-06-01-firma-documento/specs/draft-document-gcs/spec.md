## ADDED Requirements

### Requirement: Draft status transitions on electronic sign

When `contractSigningService.signContract` completes successfully, the service SHALL UPDATE the originating `draft_document` row setting `status = 'signed'`. The row SHALL NOT be deleted. The original `gcs_path` and PDF object SHALL remain unchanged.

Drafts with status `'signed'` or `'rejected'` SHALL NOT appear in `listPendingSignature` results and SHALL NOT be signable.

#### Scenario: Draft marked signed after sign

- **WHEN** a pending draft is signed successfully
- **THEN** its `status` becomes `'signed'`
- **AND** the row remains in `draft_document`

#### Scenario: Signed draft excluded from pending list

- **WHEN** `listPendingSignature` runs after a draft was signed
- **THEN** that draft id is not included in results
