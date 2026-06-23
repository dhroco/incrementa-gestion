# social-network-catalog Specification

## Purpose
TBD - created by archiving change social-network-catalog-backend. Update Purpose after archive.
## Requirements
### Requirement: Social network catalog table

The system SHALL persist a master catalog of social network platforms in table `social_network_catalog` with columns `id` (UUID primary key), `code` (unique text, lowercase without spaces), `name` (display label), and `sort_order` (integer). The table MUST NOT include an icon column. The migration that creates this table SHALL insert exactly eight catalog entries in this `sort_order` sequence: Instagram (`instagram`), Facebook (`facebook`), LinkedIn (`linkedin`), X (`x`), TikTok (`tiktok`), YouTube (`youtube`), WhatsApp Business (`whatsapp_business`), Pinterest (`pinterest`). There SHALL be no admin CRUD API for modifying catalog rows; catalog changes occur only via migrations.

#### Scenario: Catalog table exists after migration

- **WHEN** migration `202605300021` (or the numbered migration for this change) completes successfully
- **THEN** table `social_network_catalog` exists with the specified columns and unique constraint on `code`
- **AND** exactly eight rows exist with the defined codes and sort order

#### Scenario: Duplicate code rejected at database level

- **WHEN** an insert or update sets `social_network_catalog.code` to a value that already exists
- **THEN** PostgreSQL rejects the operation via unique constraint

### Requirement: Social network catalog list service

`supplierService.js` (or equivalent module) SHALL expose `listSocialNetworkCatalog()` that returns all catalog rows ordered by `sort_order` ascending. Each item MUST include `id`, `code`, `name`, and `sort_order`.

#### Scenario: Service returns ordered catalog

- **WHEN** `listSocialNetworkCatalog()` is called on a database with the seeded catalog
- **THEN** the result contains eight items ordered by `sort_order` from 1 to 8
- **AND** the first item has `code` equal to `instagram`

### Requirement: Social network catalog API

The backend MUST expose `GET /api/social-networks/catalog` requiring authentication and CASL authorization `read` on subject `Supplier`. The response MUST be HTTP 200 with a JSON body containing an `items` array; each element MUST include `id`, `code`, `name`, and `sort_order`.

#### Scenario: Authorized client loads catalog

- **WHEN** an authenticated client with `read` permission on `Supplier` calls `GET /api/social-networks/catalog`
- **THEN** the server responds HTTP 200 with `items` containing all catalog entries ordered by `sort_order`

#### Scenario: Unauthorized catalog access

- **WHEN** a client without `read` permission on `Supplier` calls `GET /api/social-networks/catalog`
- **THEN** the server responds with HTTP 403

