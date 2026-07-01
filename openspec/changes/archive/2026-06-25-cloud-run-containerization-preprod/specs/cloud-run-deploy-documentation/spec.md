## ADDED Requirements

### Requirement: Deploy documentation lists all Cloud Run variables

The repository SHALL include a deploy README (e.g. `docs/deploy-cloud-run.md`) documenting environment variables for Pre-Prod Cloud Run deployment, separated into frontend build-time variables and backend runtime variables, without embedding secret values.

#### Scenario: Frontend build variables documented

- **WHEN** an operator reads the deploy README
- **THEN** it lists `VITE_API_BASE_URL`, `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_AUTHORITY`, and `VITE_AZURE_API_SCOPE` as Docker build arguments for the frontend image

#### Scenario: Backend runtime variables documented

- **WHEN** an operator reads the deploy README
- **THEN** it lists `ENVIRONMENT`, `DATABASE_URL`, `CORS_ORIGIN`, `PORT` (Cloud Run-injected), `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GCS_BUCKET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`
- **AND** it states that `GRAPH_CLIENT_SECRET`, `RESEND_API_KEY`, and `DATABASE_URL` are secrets (Secret Manager recommended)

#### Scenario: GCS ADC documented

- **WHEN** an operator reads the deploy README
- **THEN** it explicitly states NOT to set `GOOGLE_APPLICATION_CREDENTIALS` on Cloud Run
- **AND** it describes using the Cloud Run service account identity for GCS access

### Requirement: Deploy documentation includes local Docker verification commands

The deploy README SHALL include example `docker build` and `docker run` commands for both backend and frontend images, using placeholder values for secrets and URLs.

#### Scenario: Backend local smoke test documented

- **WHEN** an operator follows the backend verification section
- **THEN** instructions show how to build the image, run the container with required env vars, and curl `GET /health`

#### Scenario: Frontend local smoke test documented

- **WHEN** an operator follows the frontend verification section
- **THEN** instructions show how to build with `--build-arg` for Vite variables and verify the SPA loads on port 8080

### Requirement: No secrets committed in deploy documentation

The deploy README SHALL use placeholders (e.g. `<DATABASE_URL>`, `<GRAPH_CLIENT_SECRET>`) for sensitive values and SHALL NOT contain production secret literals.

#### Scenario: Documentation review for secrets

- **WHEN** the deploy README is reviewed
- **THEN** no API keys, connection strings with passwords, or service account JSON content appear in the file
