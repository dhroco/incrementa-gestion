## ADDED Requirements

### Requirement: Backend production Dockerfile for Cloud Run

The repository SHALL provide `backend/Dockerfile` that builds a production image using base image `node:22-slim`, runs `npm ci --omit=dev` after copying `package.json` and `package-lock.json`, copies application source, runs as a non-root user, exposes the application port, and starts with `CMD ["node", "index.js"]`.

#### Scenario: Dockerfile uses slim Node LTS and production install

- **WHEN** a developer inspects `backend/Dockerfile`
- **THEN** the `FROM` instruction references `node:22-slim`
- **AND** dependencies are installed with `npm ci --omit=dev`
- **AND** the container command is `node index.js`

#### Scenario: Container runs as non-root

- **WHEN** the backend image is built and run
- **THEN** the process inside the container does not run as UID 0 (root)

### Requirement: Backend dockerignore excludes secrets and dev artifacts

`backend/.dockerignore` SHALL exclude at minimum: `node_modules`, `secrets/`, `*.cmd`, `.git`, `test/`, and `*.md`. No secret files or local environment scripts SHALL be copied into the image build context output.

#### Scenario: Secrets directory excluded from image

- **WHEN** `docker build` runs for the backend with files present under `backend/secrets/`
- **THEN** those files are not included in the built image layers

### Requirement: Backend listens on Cloud Run PORT and all interfaces in deployed environments

For `dev` and `prod` environment objects in `backend/config.js`, `PORT` SHALL resolve from `process.env.PORT` with fallback `3000`, and `HOST` SHALL be `'0.0.0.0'`. The server SHALL bind via `app.listen(config.PORT, config.HOST, ...)`.

#### Scenario: Cloud Run injects PORT 8080

- **WHEN** the backend container runs with `ENVIRONMENT=dev` or `ENVIRONMENT=prod` and `PORT=8080`
- **THEN** the HTTP server listens on `0.0.0.0:8080`

#### Scenario: Local environment unchanged

- **WHEN** `ENVIRONMENT=local` without `PORT` override
- **THEN** the server listens on `localhost:3000`

### Requirement: CORS origin is configurable via environment variable in deployed environments

For `dev` and `prod` in `backend/config.js`, `CORS_ORIGIN` SHALL resolve from `process.env.CORS_ORIGIN` with a documented fallback to the previous hardcoded URL for that environment. `local` SHALL keep `http://localhost:5173` as default.

#### Scenario: Cloud Run sets CORS_ORIGIN to frontend URL

- **WHEN** the backend runs with `ENVIRONMENT=dev`, `CORS_ORIGIN=https://frontend.example.run.app`, and a browser sends a request with `Origin: https://frontend.example.run.app`
- **THEN** CORS middleware allows the request

#### Scenario: Fallback when CORS_ORIGIN unset in dev

- **WHEN** `ENVIRONMENT=dev` and `CORS_ORIGIN` is not set
- **THEN** the backend uses the existing dev fallback origin (legacy AWS URL)

### Requirement: GCS client uses Application Default Credentials when no key file is set

When `GOOGLE_APPLICATION_CREDENTIALS` is unset, `GCS_KEY_FILE` in config SHALL be `null`, and `gcsService.js` SHALL instantiate `@google-cloud/storage` without `keyFilename`, relying on Application Default Credentials (service account identity on Cloud Run).

#### Scenario: Cloud Run without key file

- **WHEN** the backend runs on Cloud Run without `GOOGLE_APPLICATION_CREDENTIALS` and the service account has storage access to `GCS_BUCKET`
- **THEN** GCS upload and download operations succeed using ADC

### Requirement: Backend container health check responds on configured port

The backend image SHALL serve `GET /health` on the configured `PORT`. Operators SHALL be able to verify with `curl http://localhost:<PORT>/health` when running the container locally.

#### Scenario: Health endpoint after container start

- **WHEN** the backend container is running with valid configuration
- **THEN** `GET /health` returns HTTP 200
