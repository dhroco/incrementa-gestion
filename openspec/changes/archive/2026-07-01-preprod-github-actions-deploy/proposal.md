## Why

Las imágenes Docker de backend y frontend ya están listas para Cloud Run (Etapa A), y la infraestructura GCP de pre-prod ya existe (Etapa B: Artifact Registry, Secret Manager, WIF, service accounts). Sin un pipeline automatizado en push a `preprod`, el despliegue sigue siendo manual, propenso a errores de configuración (CORS, build-args Vite, secretos) y no aprovecha autenticación keyless con Workload Identity Federation.

## What Changes

- **Nuevo workflow** `.github/workflows/deploy-preprod.yml`: se dispara en `push` a la rama `preprod`, autentica a GCP vía WIF (sin JSON de service account), construye y publica imágenes en Artifact Registry, despliega backend y frontend a Cloud Run en orden dependiente de URLs.
- **Flujo de 5 pasos** para resolver chicken-and-egg entre URL del backend (build-time Vite) y `CORS_ORIGIN` del backend (runtime): build+push backend → deploy backend → build+push frontend con `VITE_API_BASE_URL` → deploy frontend → update backend con `CORS_ORIGIN`.
- **Tags de imagen**: `${{ github.sha }}` (inmutable) y tag móvil `preprod` (opcional).
- **Configuración Cloud Run backend**: runtime SA, conector Cloud SQL, secretos por nombre desde Secret Manager, env vars de Entra/GCS/Resend, `ENVIRONMENT=dev` (no `preprod`).
- **Configuración Cloud Run frontend**: nginx en 8080, build-args Vite con URL real del backend y credenciales Azure públicas, sin secretos ni Cloud SQL.

**Sin cambios en esta etapa:**

- Dockerfiles, `nginx.conf`, `config.js` de backend/frontend (Etapa A ya completada).
- Creación de recursos GCP (WIF pool/provider, SAs, AR, SM) — el workflow solo los consume.
- Registro de redirect URI de Entra para la URL del frontend (Etapa D, manual).
- Primer disparo del pipeline y smoke test (Etapa D, manual).

## Capabilities

### New Capabilities

- `preprod-deploy-workflow`: GitHub Actions workflow keyless (WIF) que en push a `preprod` construye, publica y despliega backend y frontend a Cloud Run pre-prod, incluyendo el orden de deploy por dependencia de URLs y la actualización final de `CORS_ORIGIN`.

### Modified Capabilities

- _(Ninguno: no altera requisitos de contenedores ni de aplicación ya publicados en `openspec/specs/`; solo añade automatización CI/CD.)_

## Impact

- **CI/CD**: nuevo `.github/workflows/deploy-preprod.yml`.
- **Operaciones**: consume recursos GCP existentes en proyecto `incrementa-gestion-dev`, región `us-central1`.
- **Secretos**: referenciados por nombre (`DATABASE_URL`, `GRAPH_CLIENT_SECRET`, `RESEND_API_KEY`); nunca valores en repo ni logs.
- **Sin cambios**: código de aplicación, Dockerfiles, IaC, auth MSAL/OIDC, migraciones, tests de negocio.

## Consideraciones de seguridad

- **Autenticación keyless (WIF)**: el workflow usa `google-github-actions/auth@v2` con `workload_identity_provider` y `service_account` (deployer SA). No se almacenan ni transmiten claves JSON de service account en GitHub Secrets ni en el repositorio.
- **Least privilege**: permisos del job limitados a `id-token: write` y `contents: read`. La deployer SA tiene solo los roles necesarios para push a AR y deploy a Cloud Run; la runtime SA corre los servicios con permisos mínimos (Cloud SQL, GCS, Secret Manager accessor).
- **Secretos en Secret Manager**: `DATABASE_URL`, `GRAPH_CLIENT_SECRET` y `RESEND_API_KEY` se montan en Cloud Run vía `--set-secrets` referenciando nombres y versiones (`:latest`), nunca como env vars planas en el workflow.
- **Build args públicos only**: variables `VITE_*` horneadas en el frontend son URLs e identificadores públicos de Azure; ningún secreto de servidor se pasa como build-arg.
- **CORS**: `CORS_ORIGIN` se setea exactamente a la URL del frontend Cloud Run tras conocerla, evitando wildcard o orígenes incorrectos.
- **WIF attribute condition**: el provider WIF ya restringe repo (`dhroco/incrementa-gestion`) y rama (`preprod`); el trigger del workflow refuerza la misma condición.
