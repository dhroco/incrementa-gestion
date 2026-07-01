## 1. Scaffold del workflow

- [x] 1.1 Crear `.github/workflows/deploy-preprod.yml` con trigger `on.push.branches: [preprod]`, `permissions: id-token: write` y `contents: read`, y bloque `env` con `GCP_PROJECT`, `GCP_REGION`, `AR_HOST`, `BACKEND_SERVICE`, `FRONTEND_SERVICE`
- [x] 1.2 Añadir step de checkout y autenticación WIF con `google-github-actions/auth@v2` (provider + deployer SA); verificar que no hay referencias a JSON keys

## 2. Build y push — backend (paso a)

- [x] 2.1 Instalar/setup `gcloud` CLI y ejecutar `gcloud auth configure-docker us-central1-docker.pkg.dev --quiet`
- [x] 2.2 Step `docker build` del backend desde `./backend`, tag `.../backend:${{ github.sha }}` (y opcional `preprod`), `docker push` a Artifact Registry
- [x] 2.3 Mensajes de error en es-CL si falla build o push del backend

## 3. Deploy backend inicial (paso b)

- [x] 3.1 Step `gcloud run deploy` del backend con imagen SHA, runtime SA, Cloud SQL connector, `--set-secrets` (DATABASE_URL, GRAPH_CLIENT_SECRET, RESEND_API_KEY por nombre), env vars OIDC/Graph/GCS/Resend, `ENVIRONMENT=dev`, `--allow-unauthenticated`, `--region us-central1`
- [x] 3.2 Capturar URL del backend: `gcloud run services describe $BACKEND_SERVICE --region us-central1 --format='value(status.url)'` → output `$BACKEND_URL`
- [x] 3.3 Confirmar que NO se setean PORT, GOOGLE_APPLICATION_CREDENTIALS, PGSSLMODE ni CORS_ORIGIN en este paso

## 4. Build y push — frontend (paso c)

- [x] 4.1 Step `docker build` del frontend con `--build-arg VITE_API_BASE_URL=$BACKEND_URL`, `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_AUTHORITY`, `VITE_AZURE_API_SCOPE`, `ENVIRONMENT=dev`
- [x] 4.2 Tag y push `.../frontend:${{ github.sha }}` (y opcional `preprod`) a Artifact Registry
- [x] 4.3 Mensajes de error en es-CL si falla build o push del frontend

## 5. Deploy frontend (paso d)

- [x] 5.1 Step `gcloud run deploy` del frontend con imagen SHA, `--allow-unauthenticated`, `--region us-central1`, sin Cloud SQL ni secretos
- [x] 5.2 Capturar URL del frontend: `gcloud run services describe $FRONTEND_SERVICE --region us-central1 --format='value(status.url)'` → output `$FRONTEND_URL`

## 6. Update CORS en backend (paso e)

- [x] 6.1 Step `gcloud run services update $BACKEND_SERVICE --region us-central1 --update-env-vars CORS_ORIGIN=$FRONTEND_URL`
- [x] 6.2 Mensaje de éxito en es-CL con URLs desplegadas (backend y frontend)

## 7. Verificación

- [x] 7.1 Validar sintaxis YAML del workflow (actionlint, `yamllint`, o revisión manual de estructura)
- [x] 7.2 Revisar que ningún valor de secreto aparece en el archivo del workflow ni en echo/log steps
- [x] 7.3 Confirmar orden secuencial a→b→c→d→e y dependencias de outputs entre steps

## 8. Hardening

- [x] 8.1 Añadir `concurrency` a nivel workflow (`group: deploy-preprod-${{ github.ref }}`, `cancel-in-progress: true`) para evitar despliegues solapados en la misma rama
- [x] 8.2 Añadir `--platform=managed` explícito a los tres comandos Cloud Run (deploy backend, deploy frontend, update CORS backend)
