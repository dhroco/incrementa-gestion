## 1. Script GCS

- [x] 1.1 Crear directorio `infra/gcp/` si no existe
- [x] 1.2 Agregar `infra/gcp/setup-gcs.ps1` con cabecera, variables `$PROJECT`/`$BUCKET`/`$REGION`, `$SA_NAME`/`$SA_EMAIL`/`$KEY_PATH`, y flujo único: `gcloud config set project` → crear bucket (uniform bucket-level access) → crear service account → IAM `roles/storage.objectAdmin` en el bucket → `New-Item` en `backend/secrets` → `gcloud iam service-accounts keys create`
- [x] 1.3 Verificar que el script no contiene pasos duplicados (una sola invocación por recurso)

## 2. Protección de secretos en git

- [x] 2.1 En `.gitignore` raíz, insertar después de `backend/SET_VARS_AMBIENTE_LOCAL.cmd` el bloque `# GCP credentials (never commit)` y la línea `backend/secrets/`

## 3. Verificación manual

- [x] 3.1 Confirmar que `git check-ignore -v backend/secrets/gcs-service-account.json` ignora la ruta (tras simular o generar el archivo localmente, sin commitear)
- [ ] 3.2 (Opcional, con credenciales GCP) Ejecutar `.\setup-gcs.ps1` desde `infra/gcp/` y validar que se crea `backend/secrets/gcs-service-account.json`
