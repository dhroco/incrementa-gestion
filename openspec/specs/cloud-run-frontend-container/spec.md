# cloud-run-frontend-container Specification

## Purpose
TBD - created by archiving change cloud-run-containerization-preprod. Update Purpose after archive.
## Requirements
### Requirement: Frontend multi-stage Dockerfile with nginx runtime

The repository SHALL provide `frontend/Dockerfile` with a build stage on `node:22-slim` that runs `npm ci` and `npm run build` to produce `dist/`, and a runtime stage on `nginx:alpine` that copies `dist/` and serves static files.

#### Scenario: Build stage produces Vite output

- **WHEN** `docker build` runs for the frontend with required build arguments
- **THEN** the build stage completes `npm run build` without error
- **AND** `dist/index.html` exists in the runtime image

#### Scenario: Runtime uses nginx alpine

- **WHEN** a developer inspects `frontend/Dockerfile`
- **THEN** the final stage uses `nginx:alpine` as base image

### Requirement: nginx serves SPA with fallback on port 8080

`frontend/nginx.conf` SHALL configure nginx to listen on port `8080`, serve files from the static root, and use `try_files $uri $uri/ /index.html;` for client-side routing.

#### Scenario: Deep link to React route

- **WHEN** a client requests a path that does not map to a static file (e.g. `/contracts`)
- **THEN** nginx returns `index.html` with HTTP 200

#### Scenario: Cloud Run port alignment

- **WHEN** the frontend container runs on Cloud Run
- **THEN** nginx listens on port `8080`

### Requirement: Frontend API base URL from Vite environment variable

`frontend/config.js` SHALL resolve `API_BASE_URL` from `import.meta.env.VITE_API_BASE_URL` for deployed environments (`dev` and `prod`), with fallback `http://localhost:3000` for `local` or when the variable is unset in local development. Hardcoded AWS or legacy deployment URLs SHALL NOT be the only source for deployed environments.

#### Scenario: Build with VITE_API_BASE_URL

- **WHEN** the frontend is built with `VITE_API_BASE_URL=https://api.example.run.app`
- **THEN** the bundled application uses that URL for API requests

#### Scenario: Local development without Vite env

- **WHEN** `ENVIRONMENT=local` and `VITE_API_BASE_URL` is not set
- **THEN** `API_BASE_URL` is `http://localhost:3000`

### Requirement: Frontend dockerignore excludes dev artifacts

`frontend/.dockerignore` SHALL exclude at minimum: `node_modules`, `dist`, `.git`, `test/`, and `*.md`.

#### Scenario: node_modules not copied to build context

- **WHEN** `docker build` runs for the frontend
- **THEN** local `node_modules` is not sent as part of the build context

### Requirement: Vite Azure variables remain build-time configurable

The frontend Docker build SHALL support passing `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_AUTHORITY`, and `VITE_AZURE_API_SCOPE` as build arguments, consistent with `frontend/src/config/msalConfig.js`. This change SHALL NOT alter MSAL redirect flow or auth logic.

#### Scenario: MSAL config from build args

- **WHEN** the frontend image is built with `VITE_AZURE_CLIENT_ID` and related args
- **THEN** the production bundle contains those values for MSAL initialization
- **AND** login redirect still uses `window.location.origin` for `redirectUri`

### Requirement: Existing frontend tests and build pass after containerization changes

After implementation, `npm run build` and `npm test` in `frontend/` SHALL complete successfully without modifying auth or business test expectations.

#### Scenario: CI-equivalent frontend verification

- **WHEN** a developer runs `npm run build` then `npm test` in `frontend/`
- **THEN** both commands exit with code 0

