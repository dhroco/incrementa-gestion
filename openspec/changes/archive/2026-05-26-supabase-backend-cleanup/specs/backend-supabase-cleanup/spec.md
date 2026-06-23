## ADDED Requirements

### Requirement: Backend has no Supabase npm dependency

The backend MUST NOT declare `@supabase/supabase-js` in `package.json` dependencies after this change is applied.

#### Scenario: Package manifest is clean

- **WHEN** reading `backend/package.json`
- **THEN** the string `@supabase/supabase-js` MUST NOT appear under `dependencies`

### Requirement: Supabase admin client file removed

The file `backend/lib/supabaseAdminClient.js` MUST NOT exist after this change is applied.

#### Scenario: Admin client file absent

- **WHEN** listing `backend/lib/`
- **THEN** `supabaseAdminClient.js` MUST NOT be present

### Requirement: Supabase auth middleware removed

The file `backend/middleware/requireSupabaseAuth.js` MUST NOT exist after this change is applied. No route or module MUST import `requireSupabaseAuth`.

#### Scenario: Middleware file absent

- **WHEN** listing `backend/middleware/`
- **THEN** `requireSupabaseAuth.js` MUST NOT be present

#### Scenario: No imports of dead middleware

- **WHEN** searching the backend codebase for `requireSupabaseAuth`
- **THEN** there MUST be zero matches outside `node_modules`

### Requirement: Config exposes no Supabase environment keys

`backend/config.js` MUST NOT export or define `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY` for any environment (`local`, `dev`, `prod`).

#### Scenario: Local config has no Supabase keys

- **WHEN** `ENVIRONMENT` is `local` and config is loaded
- **THEN** the resolved config object MUST NOT contain properties `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY`

#### Scenario: Dev and prod config have no Supabase keys

- **WHEN** `ENVIRONMENT` is `dev` or `prod` and config is loaded
- **THEN** the resolved config object MUST NOT contain properties `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY`

### Requirement: Local DATABASE_URL default points to GCP Postgres

In `backend/config.js`, the `local` environment `DATABASE_URL` default (when `process.env.DATABASE_URL` is unset) MUST be `postgresql://postgres:Incrementa2026!@35.199.66.217:5432/incrementa` and MUST NOT reference `supabase.com`.

#### Scenario: Default local database URL

- **WHEN** running the backend with `ENVIRONMENT=local` and without `DATABASE_URL` in the environment
- **THEN** `config.DATABASE_URL` MUST equal `postgresql://postgres:Incrementa2026!@35.199.66.217:5432/incrementa`

### Requirement: Local environment script has no Supabase variables

`backend/SET_VARS_AMBIENTE_LOCAL.cmd` MUST NOT set or echo `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, or `SUPABASE_SERVICE_ROLE_KEY`, and MUST NOT propagate those variables in its `endlocal` blocks.

#### Scenario: Local setup script omits Supabase

- **WHEN** reviewing `backend/SET_VARS_AMBIENTE_LOCAL.cmd`
- **THEN** the file MUST NOT contain `set "SUPABASE_` assignments or verification echoes for Supabase variables

### Requirement: Backend starts and OIDC login still works

After cleanup, the backend MUST start with `node index.js` and `POST /api/auth/login` MUST continue to accept valid Keycloak credentials and return session tokens as before this change.

#### Scenario: Server boots

- **WHEN** starting the backend from `backend/` with required OIDC/Keycloak env vars set
- **THEN** the process MUST listen without throwing errors related to missing Supabase configuration

#### Scenario: Login smoke test

- **WHEN** sending `POST /api/auth/login` with valid username and password for a Keycloak user
- **THEN** the response status MUST be success (2xx) and the body MUST include access/refresh token fields as defined by the existing auth session API

### Requirement: No active Supabase references in backend source

A repository search for `supabase` (case-insensitive) under `backend/` in `*.js`, `*.json`, and `*.cmd` files, excluding `node_modules`, MUST return no matches in executable application code or configuration files touched by this change. Matches in comment-only lines inside `backend/migrations/` or `backend/seeds/`, or in `package-lock.json` during lockfile refresh, are acceptable.

#### Scenario: Grep verification on scoped files

- **WHEN** running grep for `supabase` on `backend/config.js`, `backend/package.json`, `backend/middleware/`, and `backend/lib/`
- **THEN** there MUST be zero matches

#### Scenario: Migration and seed comments allowed

- **WHEN** running grep for `supabase` under `backend/migrations/` or `backend/seeds/`
- **THEN** matches MAY exist only inside comments and MUST NOT affect runtime behavior
