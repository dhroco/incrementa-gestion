# =============================================================
# Setup GCS: Bucket + Service Account para incrementa-gestion
# Uso: Ejecutar desde PowerShell en la carpeta infra/gcp/
# Para migrar a otro entorno, cambiar las 3 variables de abajo.
# =============================================================

$PROJECT = "incrementa-gestion-dev"
$BUCKET  = "incrementa-contratos-dev"
$REGION  = "us-central1"

$SA_NAME  = "incrementa-gcs-sa"
$SA_EMAIL = "$SA_NAME@$PROJECT.iam.gserviceaccount.com"
$KEY_PATH = "..\..\backend\secrets\gcs-service-account.json"

Write-Host "-> Configurando proyecto GCP: $PROJECT"
gcloud config set project $PROJECT

Write-Host "-> Creando bucket: gs://$BUCKET"
gcloud storage buckets create "gs://$BUCKET" `
  --project=$PROJECT `
  --location=$REGION `
  --uniform-bucket-level-access

Write-Host "-> Creando service account: $SA_NAME"
gcloud iam service-accounts create $SA_NAME `
  --display-name="Incrementa GCS Service Account" `
  --project=$PROJECT

Write-Host "-> Asignando rol Storage Object Admin sobre el bucket"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" `
  --member="serviceAccount:$SA_EMAIL" `
  --role="roles/storage.objectAdmin"

Write-Host "-> Descargando credenciales JSON"
New-Item -ItemType Directory -Force -Path "..\..\backend\secrets" | Out-Null
gcloud iam service-accounts keys create $KEY_PATH `
  --iam-account=$SA_EMAIL

Write-Host "OK - Listo. Credenciales guardadas en: $KEY_PATH"
