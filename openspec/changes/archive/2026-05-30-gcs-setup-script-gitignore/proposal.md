## Why

El backend necesita almacenar contratos y artefactos en Google Cloud Storage (GCS), pero hoy no existe un script reproducible para aprovisionar el bucket, la service account y las credenciales locales. Sin ignorar `backend/secrets/` en git, existe riesgo de commitear claves JSON de GCP.

## What Changes

- Agregar `infra/gcp/setup-gcs.ps1`: script PowerShell que configura proyecto GCP, crea bucket con uniform bucket-level access, crea service account, asigna `roles/storage.objectAdmin` sobre el bucket y genera `backend/secrets/gcs-service-account.json`.
- Variables parametrizables al inicio del script (`$PROJECT`, `$BUCKET`, `$REGION`) para migrar a otros entornos sin editar el cuerpo del script.
- Actualizar `.gitignore` raíz: después de `backend/SET_VARS_AMBIENTE_LOCAL.cmd`, ignorar `backend/secrets/` con comentario explícito de credenciales GCP.

## Capabilities

### New Capabilities

- `gcs-local-setup-infra`: Script de aprovisionamiento GCS para desarrollo (bucket, SA, IAM, clave JSON local) y política de no-commit de secretos en el repositorio.

### Modified Capabilities

- _(Ninguno: no altera requisitos de aplicación ya publicados en `openspec/specs/`.)_

## Impact

- **Nuevos archivos**: `infra/gcp/setup-gcs.ps1` (carpeta `infra/gcp/` nueva).
- **Modificado**: `.gitignore` (entrada `backend/secrets/`).
- **Generado localmente (no en repo)**: `backend/secrets/gcs-service-account.json` tras ejecutar el script.
- **Prerrequisitos**: `gcloud` CLI autenticado con permisos para crear buckets, service accounts e IAM en el proyecto indicado.
- **Sin cambios** en backend Node, frontend, migraciones ni despliegue automatizado existente (CloudFormation en `infra/cloudformation/`).

## Consideraciones de seguridad

- Las credenciales JSON de la service account son secretos de alto impacto; deben vivir solo en `backend/secrets/` y nunca en el repositorio.
- El script crea una clave de cuenta de servicio; rotar o revocar claves comprometidas en GCP Console.
- Valores por defecto (`incrementa-gestion-dev`, `incrementa-contratos-dev`) son para desarrollo; producción debe usar variables distintas y secretos gestionados fuera del repo (Secret Manager, etc.).
- Ejecutar el script solo desde máquinas de confianza; el archivo generado otorga acceso de escritura/lectura a objetos del bucket configurado.
