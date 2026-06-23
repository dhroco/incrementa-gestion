## ADDED Requirements

### Requirement: Docker Compose provides Keycloak 26 on port 8080

The repository SHALL include a root-level `docker-compose.yml` that runs Keycloak 26 from `quay.io/keycloak/keycloak` in development mode, exposing HTTP on host port **8080** only, without binding host ports **3000** or **5173**, and without modifying any existing application source or config files.

#### Scenario: Developer starts Keycloak

- **WHEN** a developer runs `docker compose up` from the project root
- **THEN** a Keycloak container starts and listens on `http://localhost:8080`
- **AND** backend (3000) and frontend (5173) dev servers are unaffected by compose port mappings

### Requirement: Realm incrementa is auto-imported on startup

The system SHALL mount a realm export under `infra/keycloak/` so that Keycloak imports the realm named **`incrementa`** automatically on startup using `--import-realm` (or equivalent supported import mechanism).

#### Scenario: Fresh environment

- **WHEN** Keycloak starts with an empty data volume
- **THEN** the realm `incrementa` exists without manual Admin Console configuration

### Requirement: OIDC discovery endpoint is available

After Keycloak is healthy, the OIDC discovery document SHALL be available at:

`http://localhost:8080/realms/incrementa/.well-known/openid-configuration`

#### Scenario: Discovery returns JWKS reference

- **WHEN** a client performs `GET` on the discovery URL above
- **THEN** the response is valid JSON with HTTP 200
- **AND** the JSON contains the field `jwks_uri`

### Requirement: Confidential backend client supports ROPC

The realm SHALL define an OIDC client `incrementa-backend` that is **confidential** (client secret required) and has **Direct Access Grants** enabled so the Resource Owner Password Credentials grant can be used for local development login flows.

#### Scenario: Client configuration for password grant

- **WHEN** an operator inspects client `incrementa-backend` in the imported realm
- **THEN** access type is confidential
- **AND** Direct Access Grants is enabled

### Requirement: Test users with application-aligned roles

The imported realm SHALL include these enabled test users with the given credentials and realm roles:

| Email | Password | Realm role |
|-------|----------|------------|
| `admin@incrementa.la` | `Admin1234!` | `ADMIN_GLOBAL` |
| `contador@incrementa.la` | `Contador1234!` | `CONTADOR` |
| `empresa@incrementa.la` | `Empresa1234!` | `USUARIO_EMPRESA_ADMINISTRADOR` |

#### Scenario: Admin test user exists

- **WHEN** Keycloak has finished importing the realm
- **THEN** user `admin@incrementa.la` exists with realm role `ADMIN_GLOBAL`

### Requirement: Data persists across container restarts

Keycloak data SHALL be stored in a **named** Docker volume so realm configuration and users survive `docker compose restart` unless the volume is explicitly removed.

#### Scenario: Restart preserves realm

- **WHEN** Keycloak is restarted without removing the named volume
- **THEN** realm `incrementa` and the test users remain available

### Requirement: Operational documentation for developers

The path `infra/keycloak/` SHALL include a `README.md` that documents:

- Command to start/stop Keycloak via Docker Compose
- Admin Console URL and Keycloak admin credentials (development only)
- OIDC discovery URL (canonical for downstream changes)
- Client ID `incrementa-backend` and where to find `KEYCLOAK_CLIENT_SECRET` (via `.env.example` or equivalent)
- A section for **test user UUIDs** (`sub` claim) with instructions to record values after first import (placeholders until filled post-verification)

#### Scenario: New developer onboarding

- **WHEN** a developer reads `infra/keycloak/README.md`
- **THEN** they can start Keycloak and locate the discovery URL and documented credentials without reading application code

### Requirement: No application code changes in this change

This change SHALL NOT add, modify, or delete files under `backend/` or `frontend/` with extensions `.js` or `.jsx`, and SHALL NOT modify existing project files outside the new infrastructure paths and root `docker-compose.yml`.

#### Scenario: Scope boundary

- **WHEN** the change is merged
- **THEN** only new infrastructure files and root `docker-compose.yml` are introduced
- **AND** application authentication behavior remains unchanged until a follow-up change
