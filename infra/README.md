# Infraestructura

Infraestructura de **incrementa-gestion** en **Google Cloud Platform (GCP)**.

> La infraestructura AWS anterior (CloudFormation/ECS/ECR) fue retirada. El despliegue actual
> es **Cloud Run + Cloud SQL + Cloud Storage + Artifact Registry + Secret Manager**, con CI/CD
> keyless (Workload Identity Federation) desde GitHub Actions.

## Estructura

- `gcp/`
  - `setup-gcs.ps1` — script de apoyo para crear bucket + service account de GCS (PowerShell).

## Despliegue

El despliegue **no** es manual: lo hace el pipeline de GitHub Actions.

- **Pre-Prod:** push a la rama `preprod` → `.github/workflows/deploy-preprod.yml` construye las imágenes,
  las publica en Artifact Registry y despliega backend y frontend a Cloud Run.
- **Producción (nube del cliente):** se arma con los manuales de `docs/` (ver abajo) y su propio
  workflow (`deploy-prod.yml`, análogo al de pre-prod, disparado en la rama `prod`).

## Documentación

- **Arquitectura de entornos (local / pre-prod / CI-CD):** [`../docs/arquitectura-entornos.html`](../docs/arquitectura-entornos.html)
- **Manual de producción — Microsoft Entra ID:** [`../docs/manual-prod-azure-entra-id.html`](../docs/manual-prod-azure-entra-id.html)
- **Manual de producción — GCP:** [`../docs/manual-prod-gcp.html`](../docs/manual-prod-gcp.html)

## Recursos GCP (pre-prod, proyecto `incrementa-gestion-dev`, región `us-central1`)

| Recurso | Detalle |
|---|---|
| Cloud Run | `incrementa-backend`, `incrementa-frontend` |
| Cloud SQL | `incrementa-db` (PostgreSQL 16) |
| Cloud Storage | bucket `incrementa-contratos-dev` |
| Artifact Registry | repo Docker `incrementa` |
| Secret Manager | `DATABASE_URL`, `GRAPH_CLIENT_SECRET`, `RESEND_API_KEY` |
| Service Accounts | `incrementa-run-sa` (runtime), `incrementa-deploy-sa` (CI/CD) |
| CI/CD | Workload Identity Federation (pool `github-pool`) — sin llaves JSON |
