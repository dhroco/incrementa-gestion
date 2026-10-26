# Infraestructura

Infraestructura de **incrementa-gestion** en **Microsoft Azure**, definida con Bicep.

> La infraestructura anterior en Google Cloud (Cloud Run, Cloud SQL, Cloud Storage) se dio de baja
> el 20-oct-2026, y la de AWS (CloudFormation/ECS/ECR) se había retirado antes.

## Estructura

- `azure/`
  - `main.bicep` — plantilla principal; `preprod.bicepparam` — parámetros de pre-prod.
  - `modulos/` — `red`, `logs`, `identidades`, `registro`, `keyvault`, `storage`, `postgres`,
    `staticwebapp` y `containerapps`.
  - `scripts/` — apoyo operativo: `firewall-mi-ip.sh`, `identidades-github.sh`,
    `permiso-graph-backend.sh`, `agregar-redireccion-login.sh`, `restaurar-bd-azure.sh`,
    `verificar-rutas-azure.sh` y, de la migración desde GCP, `respaldo-bd-gcp.sh` y
    `copiar-archivos-gcs-azure.sh` (ya sin uso).

## Despliegue

- **Código** (imágenes y contenido): push a la rama `preprod` →
  `.github/workflows/deploy-azure-preprod.yml` sube la imagen del backend al ACR, actualiza el MCP y
  el backend en Container Apps y publica el frontend en Static Web Apps. Entra a Azure con OIDC
  federado, sin claves guardadas.
- **Infraestructura:** `.github/workflows/infra.yml`, solo a mano. Pide la aprobación de David dos
  veces: para ver los cambios (what-if) y para aplicarlos.
- **Producción:** `.github/workflows/deploy-azure-prod.yml`, disparado por un push a la rama `prod` (que solo
  avanza en fast-forward desde `preprod`). Corre en el environment `produccion` de GitHub: espera la
  aprobación de David, solo acepta la rama `prod` y entra a Azure con OIDC, sin claves. Vive en
  `rg-incrementa-gestion-prod` (suscripción de Incrementa) y su MCP está en marcha blanca (ruta secreta y restricción de IP). Los parámetros están en
  `azure/prod.bicepparam`.

## Documentación

- **Plan de la migración a Azure:** [`../docs/plan-migracion-azure.html`](../docs/plan-migracion-azure.html)
- **Arquitectura de entornos:** [`../docs/arquitectura-entornos.html`](../docs/arquitectura-entornos.html)
- **Manual de producción — Microsoft Entra ID:** [`../docs/manual-prod-azure-entra-id.html`](../docs/manual-prod-azure-entra-id.html)
- **Migraciones de BD con Container Apps Job:** [`../docs/incrementa-azure-migraciones-bd-con-container-apps-job.html`](../docs/incrementa-azure-migraciones-bd-con-container-apps-job.html)

## Recursos Azure (pre-prod, grupo `rg-incrementa-preprod`, Brazil South)

| Recurso | Detalle |
|---|---|
| Container Apps | `ca-incrementa-backend`, `ca-incrementa-mcp` |
| Static Web Apps | `swa-incrementa-preprod` (frontend) |
| PostgreSQL Flexible Server | `psql-incrementa-preprod` (PostgreSQL 16) |
| Blob Storage | cuenta `stincrementapreprod`, contenedores `documentos` y `firmados` (WORM) |
| Container Registry | `acrincrementapreprod` |
| Key Vault | secretos de runtime (`DATABASE-URL`, `RESEND-API-KEY`) |
| Identidades | `id-incrementa-backend-preprod` (runtime), `id-incrementa-github-deploy-preprod` y `id-incrementa-github-infra-preprod` (CI/CD, OIDC) |
