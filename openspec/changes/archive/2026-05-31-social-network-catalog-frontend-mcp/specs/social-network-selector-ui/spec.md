## ADDED Requirements

### Requirement: Social network SVG icon assets

The frontend MUST store social network icon SVG files in `frontend/src/assets/social-networks/`, one file per catalog `code` (e.g. `instagram.svg`, `whatsapp_business.svg`). The directory MUST include a `generic.svg` fallback for catalog codes without a dedicated asset. Icons MUST be loaded locally at build time; the UI MUST NOT fetch icon URLs from external CDNs at runtime.

#### Scenario: Known catalog code resolves icon

- **WHEN** the catalog contains an entry with `code` equal to `instagram`
- **THEN** the UI displays `instagram.svg` from the local assets directory

#### Scenario: Unknown catalog code uses fallback

- **WHEN** the catalog contains a `code` with no matching SVG file
- **THEN** the UI displays `generic.svg`

### Requirement: SocialNetworkSelector component

The frontend MUST provide a single React component `SocialNetworkSelector` in `frontend/src/components/SocialNetworkSelector.jsx` with dedicated styles in `SocialNetworkSelector.css`. The component MUST NOT be split into additional subcomponents. It MUST accept `value` (array of supplier social networks), optional `onChange`, optional `readOnly` (default false), and optional `fieldError`. On mount it MUST load the catalog once via `GET /api/social-networks/catalog` and MUST NOT reload the catalog on every render.

#### Scenario: Catalog loads once on mount

- **WHEN** `SocialNetworkSelector` mounts in edit mode
- **THEN** `fetchSocialNetworkCatalog` is called exactly once
- **AND** subsequent re-renders do not trigger additional catalog fetches

#### Scenario: Edit mode shows catalog grid

- **WHEN** `SocialNetworkSelector` renders with `readOnly={false}` and the catalog has loaded
- **THEN** the UI displays a grid of selectable cards/chips, one per catalog entry, each showing icon and network name

#### Scenario: Toggle selection shows handle input

- **WHEN** a user clicks an unselected network card in edit mode
- **THEN** the card becomes visually selected
- **AND** an inline text input appears for entering the account handle with placeholder indicating format (e.g. `@miempresa`)

#### Scenario: Deselect removes network

- **WHEN** a user clicks a selected network card in edit mode
- **THEN** the network is removed from the emitted `value` array

#### Scenario: Read-only mode shows assigned networks only

- **WHEN** `SocialNetworkSelector` renders with `readOnly={true}`
- **THEN** only networks present in `value` are displayed with icon, network name, and account handle
- **AND** no selection or input controls are shown

#### Scenario: Read-only empty state

- **WHEN** `SocialNetworkSelector` renders in read-only mode with an empty `value` array
- **THEN** the UI shows a message in Spanish indicating no social networks are registered

#### Scenario: Field error displayed

- **WHEN** `fieldError` is provided in edit mode
- **THEN** the error message is visible to the user in Spanish

### Requirement: Social network catalog API client

The frontend MUST expose `fetchSocialNetworkCatalog` in `suppliersApi.js` that calls authenticated `GET /api/social-networks/catalog` and returns the `items` array with at least `id`, `code`, and `name`.

#### Scenario: Authorized catalog fetch

- **WHEN** the client calls `fetchSocialNetworkCatalog` with a valid access token
- **THEN** the promise resolves with catalog items ordered as returned by the API

### Requirement: SocialNetworkSelector initializes from existing supplier

When editing an existing supplier, `SocialNetworkSelector` MUST initialize with networks already assigned to the supplier, with their handles preloaded. Each entry MUST use `catalog_id` and `account_name` from the supplier detail response.

#### Scenario: Edit supplier preloads networks

- **WHEN** a user opens edit page for a supplier that has Instagram and LinkedIn accounts
- **THEN** those networks appear selected with their existing handles in the input fields
