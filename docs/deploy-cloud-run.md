# Despliegue en Google Cloud Run (Pre-Prod)

Guía de containerización del backend (Node/Express) y frontend (React/Vite + nginx) para Cloud Run. No incluye IaC ni creación de servicios; solo build de imágenes y variables de entorno.

## Arquitectura

| Servicio | Imagen | Puerto | Descripción |
|----------|--------|--------|-------------|
| Backend | `backend/Dockerfile` | `8080` (inyectado por Cloud Run vía `PORT`) | API REST Node/Express |
| Frontend | `frontend/Dockerfile` | `8080` | SPA estática servida por nginx |

## Variables — Frontend (build-time)

Se pasan como `--build-arg` en `docker build` o en Cloud Build. Vite las hornea en el bundle en tiempo de compilación.

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL pública del backend en Cloud Run | `https://incrementa-api-xxxxx.run.app` |
| `VITE_AZURE_CLIENT_ID` | Client ID de la app SPA en Entra ID | `<AZURE_CLIENT_ID>` |
| `VITE_AZURE_AUTHORITY` | Authority de Entra ID | `https://login.microsoftonline.com/<TENANT_ID>` |
| `VITE_AZURE_API_SCOPE` | Scope de la API propia | `api://<CLIENT_ID>/access_as_user` |
| `ENVIRONMENT` | Ambiente lógico (`dev` o `prod`) | `dev` |

**Importante:** No pasar secretos de servidor como build args. Solo valores públicos (URLs, client IDs de SPA).

## Variables — Backend (runtime)

Se configuran como variables de entorno del servicio Cloud Run o referencias a Secret Manager.

| Variable | Descripción | Secreto |
|----------|-------------|---------|
| `ENVIRONMENT` | `dev` o `prod` | No |
| `PORT` | Puerto HTTP (Cloud Run lo inyecta, típicamente `8080`) | No |
| `DATABASE_URL` | Connection string PostgreSQL | **Sí** |
| `CORS_ORIGIN` | URL exacta del frontend (origen permitido) | No |
| `OIDC_ISSUER_URL` | Issuer de Entra ID | No |
| `OIDC_AUDIENCE` | Audiencia esperada del JWT | No |
| `GRAPH_TENANT_ID` | Tenant de Microsoft Graph | No |
| `GRAPH_CLIENT_ID` | Client ID para Graph API | No |
| `GRAPH_CLIENT_SECRET` | Secret del cliente Graph | **Sí** |
| `GCS_BUCKET` | Bucket de contratos en GCS | No |
| `RESEND_API_KEY` | API key de Resend | **Sí** |
| `RESEND_FROM_EMAIL` | Remitente de correos | No |

### Google Cloud Storage (ADC)

**No** configurar `GOOGLE_APPLICATION_CREDENTIALS` en Cloud Run.

El backend usa Application Default Credentials: la identidad del service account asociado al servicio Cloud Run. Ese service account debe tener permisos de lectura/escritura sobre `GCS_BUCKET` (por ejemplo `roles/storage.objectAdmin` en el bucket).

En desarrollo local, `GOOGLE_APPLICATION_CREDENTIALS` puede apuntar a un JSON en `backend/secrets/` (excluido de la imagen Docker).

## Build local

### Backend

```bash
docker build -t incrementa-backend ./backend
```

### Frontend

```bash
docker build -t incrementa-frontend ./frontend \
  --build-arg ENVIRONMENT=dev \
  --build-arg VITE_API_BASE_URL=https://<BACKEND_CLOUD_RUN_URL> \
  --build-arg VITE_AZURE_CLIENT_ID=<AZURE_CLIENT_ID> \
  --build-arg VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/<TENANT_ID> \
  --build-arg VITE_AZURE_API_SCOPE=api://<CLIENT_ID>/access_as_user
```

## Verificación local

### Backend — health check

```bash
docker run --rm -p 8080:8080 \
  -e ENVIRONMENT=dev \
  -e PORT=8080 \
  -e DATABASE_URL=<DATABASE_URL> \
  -e CORS_ORIGIN=http://localhost:8080 \
  incrementa-backend
```

En otra terminal:

```bash
curl -f http://localhost:8080/health
```

Respuesta esperada: HTTP `200`.

### Frontend — SPA y routing

```bash
docker run --rm -p 8080:8080 incrementa-frontend
```

Verificar:

```bash
curl -f http://localhost:8080/
curl -f http://localhost:8080/contracts
```

Ambas rutas deben devolver `index.html` (HTTP `200`) para el fallback SPA.

## Tests del proyecto

```bash
cd backend && npm test
cd frontend && npm run build && npm test
```

## Checklist Pre-Prod

- [ ] `CORS_ORIGIN` del backend coincide con la URL del frontend Cloud Run
- [ ] `VITE_API_BASE_URL` apunta al backend Cloud Run (rebuild del frontend si cambia)
- [ ] Redirect URI de Entra ID registrada para la URL del frontend
- [ ] Secretos (`DATABASE_URL`, `GRAPH_CLIENT_SECRET`, `RESEND_API_KEY`) en Secret Manager, no en la imagen
- [ ] Service account de Cloud Run con acceso a `GCS_BUCKET` (sin archivo de llave en el contenedor)
