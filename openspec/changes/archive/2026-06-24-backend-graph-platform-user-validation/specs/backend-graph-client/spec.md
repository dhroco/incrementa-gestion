## ADDED Requirements

### Requirement: Graph configuration in backend config

`backend/config.js` SHALL expose `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, and `GRAPH_CLIENT_SECRET` for all environments (`local`, `dev`, `prod`) via `process.env`, with `process.env` taking precedence over file defaults. For `local` only, when environment variables are unset, `GRAPH_TENANT_ID` MAY default to `60322b4a-13bf-4f19-89ae-efe4a54ffed6` and `GRAPH_CLIENT_ID` MAY default to `dc734f4a-5f25-4e88-b728-aab4715f2122`. `GRAPH_CLIENT_SECRET` SHALL have no default in any environment and SHALL be required for Graph operations.

#### Scenario: Local development with Graph secret set

- **WHEN** `ENVIRONMENT` is `local`, `GRAPH_CLIENT_SECRET` is set, and tenant/client id env vars are unset
- **THEN** the effective `GRAPH_TENANT_ID` and `GRAPH_CLIENT_ID` use the local Entra defaults
- **AND** `isGraphConfigured()` returns true

#### Scenario: Graph unavailable without secret

- **WHEN** `GRAPH_CLIENT_SECRET` is unset or empty
- **THEN** `isGraphConfigured()` returns false
- **AND** platform user provisioning services respond with HTTP **503** and code `ADMIN_CLIENT_UNAVAILABLE`

#### Scenario: Local environment variables script

- **WHEN** a developer runs `backend/SET_VARS_AMBIENTE_LOCAL.cmd`
- **THEN** `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, and `GRAPH_CLIENT_SECRET` are available to the backend process

### Requirement: Graph client uses native fetch only

The backend SHALL provide `backend/lib/graphClient.js` that performs all Microsoft Graph REST calls using the runtime native `fetch` API. The module SHALL NOT import new npm packages for Graph or Azure SDK.

#### Scenario: Graph client unavailable without configuration

- **WHEN** required Graph configuration is missing
- **THEN** `getGraphClient()` returns `null`
- **AND** callers do not throw at module load time

### Requirement: Client credentials token with short-lived cache

The client SHALL obtain an access token from `https://login.microsoftonline.com/{GRAPH_TENANT_ID}/oauth2/v2.0/token` using `grant_type=client_credentials`, `client_id` from `GRAPH_CLIENT_ID`, `client_secret` from `GRAPH_CLIENT_SECRET`, and `scope=https://graph.microsoft.com/.default`. The client SHALL cache the token in process memory with an expiry derived from `expires_in`. Before each Graph operation, if fewer than **10** seconds remain until expiry, the client SHALL obtain a new token.

#### Scenario: Reuse cached token within TTL

- **WHEN** two Graph operations run within the cached token lifetime minus the 10-second margin
- **THEN** only one token request is made to the tenant token endpoint

### Requirement: Find user by email in Entra tenant

The Graph client SHALL expose `findUserByEmail(email)` that normalizes `email` with `normalizeAuthEmail`, then queries `GET https://graph.microsoft.com/v1.0/users` with OData filter `mail eq '{email}' or userPrincipalName eq '{email}' or otherMails/any(x:x eq '{email}')`, `$count=true`, and `$select=id,displayName,mail,userPrincipalName`. The request SHALL include header `ConsistencyLevel: eventual`. Single quotes in the email argument SHALL be escaped for OData (`'` → `''`). When `value` contains at least one user, the function SHALL return `{ id, fullName }` where `id` is the Graph user `id` (oid) and `fullName` is trimmed `displayName`, or the normalized email if `displayName` is empty or missing. When `value` is empty, it SHALL return `null`. On Graph client unavailable (`getGraphClient()` null), callers SHALL map to HTTP **503** consistent with other admin operations. On token, network, or Graph API errors (non-empty result expected but request failed), it SHALL throw `GraphClientError`.

#### Scenario: User found by mail attribute

- **WHEN** `findUserByEmail` is called for an email present in the tenant with `displayName: "Ana Pérez"`
- **THEN** the function returns `{ id: <oid>, fullName: "Ana Pérez" }`

#### Scenario: User found by userPrincipalName when mail differs

- **WHEN** the tenant user matches via `userPrincipalName` but not `mail`
- **THEN** the function returns `{ id: <oid>, fullName: <displayName or email> }`

#### Scenario: User without displayName

- **WHEN** Graph returns a user with empty or missing `displayName`
- **THEN** `fullName` equals the normalized email argument

#### Scenario: Unknown email returns null

- **WHEN** Graph returns an empty `value` array
- **THEN** the function returns `null` without throwing

#### Scenario: Graph infrastructure error throws

- **WHEN** the token endpoint or Graph users request fails due to network or server error
- **THEN** the function throws `GraphClientError`
- **AND** the caller maps this to HTTP **503**, not **422**

### Requirement: Graph client is read-only

The Graph client module SHALL NOT expose methods that perform write operations (POST, PATCH, PUT, DELETE) against Microsoft Graph user resources. Platform user HTTP flows SHALL use Graph only for read lookup.

#### Scenario: No write methods exported

- **WHEN** inspecting the public exports of `graphClient.js`
- **THEN** only read operations such as `findUserByEmail` are available for user management
- **AND** no PATCH or DELETE helpers are provided
