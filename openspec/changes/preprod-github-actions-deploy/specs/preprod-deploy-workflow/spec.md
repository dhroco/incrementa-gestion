## ADDED Requirements

### Requirement: Pre-prod deploy workflow triggers on push to preprod branch

The repository SHALL provide `.github/workflows/deploy-preprod.yml` that runs exclusively on `push` to the `preprod` branch. The workflow SHALL NOT trigger on other branches or pull request events unless explicitly added in a future change.

#### Scenario: Push to preprod triggers deploy

- **WHEN** a commit is pushed to the `preprod` branch of `dhroco/incrementa-gestion`
- **THEN** the `deploy-preprod` workflow starts execution

#### Scenario: Push to main does not trigger deploy

- **WHEN** a commit is pushed to a branch other than `preprod`
- **THEN** the `deploy-preprod` workflow does not run

### Requirement: Workflow authenticates to GCP using Workload Identity Federation without JSON keys

The deploy job SHALL declare `permissions: id-token: write` and `contents: read`. It SHALL authenticate to GCP using `google-github-actions/auth@v2` with `workload_identity_provider` set to `projects/1058943943576/locations/global/workloadIdentityPools/github-pool/providers/github-provider` and `service_account` set to `incrementa-deploy-sa@incrementa-gestion-dev.iam.gserviceaccount.com`. The workflow SHALL NOT use a GitHub secret containing a GCP service account JSON key.

#### Scenario: Keyless auth step present

- **WHEN** a developer inspects `.github/workflows/deploy-preprod.yml`
- **THEN** the workflow uses `google-github-actions/auth@v2` with WIF provider and deployer service account
- **AND** no step references `credentials_json` or a JSON key secret

#### Scenario: OIDC token permission granted

- **WHEN** the deploy job runs
- **THEN** the job has `id-token: write` permission to obtain a GitHub OIDC token for WIF exchange

### Requirement: Workflow builds and pushes immutable-tagged Docker images to Artifact Registry

After GCP authentication, the workflow SHALL configure Docker for Artifact Registry (`gcloud auth configure-docker us-central1-docker.pkg.dev`), build backend and frontend images from existing Dockerfiles, tag each image with `${{ github.sha }}`, and push to `us-central1-docker.pkg.dev/incrementa-gestion-dev/incrementa/<service>:${{ github.sha }}`. The workflow MAY additionally tag images with a movable `preprod` tag.

#### Scenario: Backend image pushed with commit SHA tag

- **WHEN** the workflow completes the backend build and push step
- **THEN** an image exists at `us-central1-docker.pkg.dev/incrementa-gestion-dev/incrementa/backend:${{ github.sha }}`

#### Scenario: Frontend image pushed after backend URL is known

- **WHEN** the workflow builds the frontend image
- **THEN** the build occurs only after the backend Cloud Run URL has been captured
- **AND** the frontend image is pushed with tag `${{ github.sha }}`

### Requirement: Workflow deploys backend to Cloud Run with required runtime configuration

The workflow SHALL deploy the backend image to Cloud Run in `us-central1` with: `--service-account=incrementa-run-sa@incrementa-gestion-dev.iam.gserviceaccount.com`, `--add-cloudsql-instances=incrementa-gestion-dev:us-central1:incrementa-db`, `--set-secrets=DATABASE_URL=DATABASE_URL:latest,GRAPH_CLIENT_SECRET=GRAPH_CLIENT_SECRET:latest,RESEND_API_KEY=RESEND_API_KEY:latest`, `--allow-unauthenticated`, and `--set-env-vars` including at minimum `ENVIRONMENT=dev`, `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GCS_BUCKET=incrementa-contratos-dev`, and `RESEND_FROM_EMAIL=onboarding@resend.dev`. The workflow SHALL NOT set `PORT`, `GOOGLE_APPLICATION_CREDENTIALS`, or `PGSSLMODE`. Secret values SHALL NOT appear in the workflow file or job logs.

#### Scenario: Backend deploy references secrets by name only

- **WHEN** a developer inspects the backend deploy step
- **THEN** secrets are referenced as Secret Manager names with `:latest` version suffix
- **AND** no plaintext secret values are committed to the repository

#### Scenario: Backend uses dev environment not preprod label

- **WHEN** the backend Cloud Run service is deployed
- **THEN** `ENVIRONMENT` is set to `dev`
- **AND** `ENVIRONMENT` is not set to `preprod`

#### Scenario: Cloud SQL connector attached

- **WHEN** the backend service is deployed
- **THEN** the Cloud Run revision includes the Cloud SQL instance `incrementa-gestion-dev:us-central1:incrementa-db`

### Requirement: Workflow builds frontend with Vite build-args using live backend URL

The frontend Docker build step SHALL pass build arguments: `VITE_API_BASE_URL` set to the backend Cloud Run URL obtained via `gcloud run services describe`, `VITE_AZURE_CLIENT_ID=dc734f4a-5f25-4e88-b728-aab4715f2122`, `VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/60322b4a-13bf-4f19-89ae-efe4a54ffed6`, `VITE_AZURE_API_SCOPE=api://dc734f4a-5f25-4e88-b728-aab4715f2122/access_as_user`, and `ENVIRONMENT=dev`.

#### Scenario: VITE_API_BASE_URL matches deployed backend

- **WHEN** the frontend image is built in the workflow
- **THEN** `VITE_API_BASE_URL` equals the URL returned by `gcloud run services describe` for the backend service in `us-central1`

#### Scenario: No server secrets in frontend build args

- **WHEN** the frontend build step runs
- **THEN** build arguments contain only public URLs and Azure client identifiers
- **AND** no Secret Manager values are passed as build arguments

### Requirement: Workflow deploys frontend to Cloud Run without secrets or Cloud SQL

The workflow SHALL deploy the frontend image to Cloud Run in `us-central1` with `--allow-unauthenticated`. The frontend deploy SHALL NOT attach Cloud SQL instances or mount Secret Manager secrets.

#### Scenario: Frontend service publicly accessible on port 8080

- **WHEN** the frontend Cloud Run service is deployed
- **THEN** the service allows unauthenticated access
- **AND** nginx in the container listens on port 8080 per existing frontend Dockerfile

### Requirement: Workflow updates backend CORS_ORIGIN after frontend URL is known

After deploying the frontend, the workflow SHALL capture the frontend Cloud Run URL and update the backend service with `CORS_ORIGIN` set to that URL. This update SHALL occur as the final deploy-related step in the ordered pipeline.

#### Scenario: CORS_ORIGIN set to frontend URL

- **WHEN** the workflow completes all deploy steps successfully
- **THEN** the backend Cloud Run service has `CORS_ORIGIN` equal to the frontend service URL
- **AND** `CORS_ORIGIN` was not set to a placeholder or wildcard during the initial backend deploy

#### Scenario: URL capture uses gcloud describe

- **WHEN** the workflow needs a service URL
- **THEN** it obtains the URL with `gcloud run services describe <service> --region us-central1 --format='value(status.url)'`

### Requirement: Deploy pipeline follows five-step URL dependency order

The workflow SHALL execute deploy-related steps in this order: (a) build and push backend image, (b) deploy backend and capture URL, (c) build and push frontend image with backend URL, (d) deploy frontend and capture URL, (e) update backend with frontend URL as `CORS_ORIGIN`.

#### Scenario: Frontend build does not precede backend deploy

- **WHEN** the workflow runs
- **THEN** the backend Cloud Run deploy step completes before the frontend Docker build step starts

#### Scenario: CORS update does not precede frontend deploy

- **WHEN** the workflow runs
- **THEN** the frontend Cloud Run deploy step completes before the backend `CORS_ORIGIN` update step starts

### Requirement: Workflow error handling uses Spanish locale where applicable

Steps that emit user-facing failure messages or echo operational status in the workflow SHALL use Spanish (es-CL) phrasing for error summaries and key status lines, consistent with project locale conventions.

#### Scenario: Failure message in Spanish

- **WHEN** a critical deploy step fails and the workflow emits a custom error message
- **THEN** the message is written in Spanish (es-CL)
