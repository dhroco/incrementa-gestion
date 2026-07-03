## ADDED Requirements

### Requirement: MCP remote HTTP Cloud Run service in pre-prod

The pre-prod deploy workflow SHALL deploy a Cloud Run service named `incrementa-mcp` in project `incrementa-gestion-dev`, region `us-central1`, reusing the backend Docker image already built and pushed as `us-central1-docker.pkg.dev/incrementa-gestion-dev/incrementa/backend:${{ github.sha }}`, overriding the container command to `node mcp-http.mjs` via `--command node --args mcp-http.mjs`. The deploy SHALL use `--allow-unauthenticated`, `--service-account=incrementa-run-sa@incrementa-gestion-dev.iam.gserviceaccount.com`, `--add-cloudsql-instances=incrementa-gestion-dev:us-central1:incrementa-db`, `--set-secrets=DATABASE_URL=DATABASE_URL:latest,RESEND_API_KEY=RESEND_API_KEY:latest`, and `--set-env-vars` including at minimum `ENVIRONMENT=dev`, `GCS_BUCKET=incrementa-contratos-dev`, and `RESEND_FROM_EMAIL=onboarding@resend.dev`. The workflow SHALL NOT set `PORT`, `GOOGLE_APPLICATION_CREDENTIALS`, or `PGSSLMODE` on this service.

#### Scenario: MCP service uses backend image with alternate command

- **WHEN** the workflow deploys `incrementa-mcp`
- **THEN** the Cloud Run revision image tag equals the backend image tag for the same commit SHA
- **AND** the container entrypoint runs `node mcp-http.mjs`

#### Scenario: MCP deploy does not require frontend URL

- **WHEN** the workflow deploys `incrementa-mcp`
- **THEN** the step runs after the backend image push
- **AND** the step does not depend on backend or frontend Cloud Run URLs

#### Scenario: MCP service captures public URL

- **WHEN** the MCP deploy step completes successfully
- **THEN** the workflow obtains the service URL via `gcloud run services describe incrementa-mcp --region us-central1 --format='value(status.url)'`
- **AND** echoes the MCP URL in Spanish in job output

#### Scenario: MCP deploy summary included

- **WHEN** the workflow finishes all deploy steps
- **THEN** the final summary step includes the MCP service URL alongside backend and frontend URLs

### Requirement: MCP deploy step uses Spanish operational messages

Steps that deploy or describe the `incrementa-mcp` service SHALL use Spanish (es-CL) phrasing for step names, error summaries, and status echo lines, consistent with existing deploy-preprod workflow conventions.

#### Scenario: MCP step name in Spanish

- **WHEN** a developer inspects `.github/workflows/deploy-preprod.yml`
- **THEN** the MCP deploy step name is written in Spanish (es-CL)
