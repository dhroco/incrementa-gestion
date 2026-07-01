## Context

Incrementa-gestion tiene backend Node/Express (`backend/`) y frontend React/Vite SPA (`frontend/`). Hoy:

- Existe un `backend/Dockerfile` basado en `node:22-alpine` con `npm ci --only=production`, sin usuario no-root, sin alineación con requisitos Cloud Run (`node:22-slim`, `--omit=dev`).
- `backend/config.js` hardcodea `CORS_ORIGIN` a URLs AWS Amplify en `dev`/`prod`; solo `prod` usa `process.env.PORT`.
- `frontend/config.js` hardcodea `API_BASE_URL` por ambiente (incl. URLs AWS/GCP legacy); no usa `import.meta.env.VITE_API_BASE_URL`.
- MSAL ya lee `VITE_AZURE_*` en `frontend/src/config/msalConfig.js` con defaults locales.
- `gcsService.js` ya instancia `Storage` sin `keyFilename` cuando `GCS_KEY_FILE` es `null` → ADC compatible con Cloud Run.
- No hay `frontend/Dockerfile` ni `nginx.conf`.

El objetivo es Pre-Prod en Cloud Run (GCP): dos servicios (backend + frontend), configuración por variables de entorno, sin secretos en imágenes.

## Goals / Non-Goals

**Goals:**

- Imágenes Docker reproducibles para backend y frontend listas para `gcloud run deploy`.
- Backend escucha `0.0.0.0:$PORT` (Cloud Run → `8080`).
- Frontend servido por nginx con fallback SPA en puerto `8080`.
- Parametrización de `CORS_ORIGIN` (backend) y `API_BASE_URL` (frontend) sin URLs AWS hardcodeadas en despliegue.
- Documentación de variables build-time y runtime.
- Verificación local con `docker build` / `docker run` y tests existentes en verde.

**Non-Goals:**

- Crear servicios Cloud Run, IAM, VPC, Secret Manager bindings o pipelines CI/CD.
- Cambiar lógica de auth (Entra/MSAL/Graph/OIDC middleware).
- Modificar contratos de API o esquema de BD.
- Migrar datos o apagar infra AWS.
- Soporte multi-región o autoscaling avanzado.

## Decisions

### 1. Base image backend: `node:22-slim` (no alpine)

**Rationale:** Requisito explícito del ticket; `slim` ofrece glibc compatible con dependencias nativas de npm si las hubiera. Imagen más pequeña que `node:22` full.

**Alternativa descartada:** Mantener `node:22-alpine` — no cumple spec y musl puede causar fricción con binarios nativos.

### 2. Usuario no-root en backend

Crear usuario `node` (UID 1000) o usar el usuario `node` de la imagen oficial, `chown` de `/app`, `USER node` antes de `CMD`.

**Rationale:** Buena práctica Cloud Run y requisito del ticket.

### 3. `npm ci --omit=dev` en backend

Reemplaza `--only=production` (deprecated). Copiar solo `package.json` + `package-lock.json` antes del `RUN npm ci` para cache de capas.

### 4. CORS_ORIGIN y PORT en `backend/config.js`

Para `dev` y `prod`:

```js
PORT: process.env.PORT || 3000,
HOST: '0.0.0.0',
CORS_ORIGIN: process.env.CORS_ORIGIN || '<fallback actual>'
```

`local` mantiene `HOST: 'localhost'` y `PORT: 3000` sin cambios.

**Rationale:** Cloud Run inyecta `PORT`; CORS debe apuntar a la URL del frontend Cloud Run vía env var. Fallback preserva compatibilidad con despliegues actuales hasta migración completa.

### 5. GCS: ADC sin cambio de código en `gcsService.js`

No setear `GOOGLE_APPLICATION_CREDENTIALS` en Cloud Run. El service account del servicio Cloud Run debe tener `roles/storage.objectAdmin` (o equivalente) sobre `GCS_BUCKET`.

**Verificación:** Test existente o smoke test manual con `GCS_KEY_FILE: null`.

### 6. Frontend: multi-stage Dockerfile

| Stage | Base | Acción |
|-------|------|--------|
| `build` | `node:22-slim` | `npm ci` → `npm run build` con ARGs `VITE_*` |
| `runtime` | `nginx:alpine` | Copiar `dist/` + `nginx.conf` |

Build args en stage build:

```dockerfile
ARG VITE_API_BASE_URL
ARG VITE_AZURE_CLIENT_ID
ARG VITE_AZURE_AUTHORITY
ARG VITE_AZURE_API_SCOPE
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
...
```

**Rationale:** Vite reemplaza `import.meta.env.VITE_*` en compile time; deben pasarse como build args en Cloud Build / `docker build --build-arg`.

### 7. `frontend/config.js`: patrón Vite env

Para `dev` y `prod` (y opcionalmente unificar):

```js
API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? '<fallback por ambiente o localhost>'
```

`local` mantiene `http://localhost:3000` como default explícito.

**Alternativa descartada:** Runtime config via `window.__ENV__` inyectado por nginx — más flexible pero fuera de alcance; Vite build args son el patrón ya usado por MSAL.

### 8. nginx: puerto fijo 8080

`listen 8080;` en `nginx.conf` (Cloud Run default). No usar plantilla `$PORT` salvo que se añada `envsubst` en entrypoint — complejidad innecesaria si Cloud Run siempre usa 8080.

```nginx
server {
  listen 8080;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### 9. `.dockerignore`

**Backend** (ampliar existente): añadir `secrets/`, `*.cmd`.

**Frontend** (nuevo): `node_modules`, `dist`, `.git`, `test/`, `*.md`, coverage, etc.

### 10. Documentación: `docs/deploy-cloud-run.md`

Tablas separadas build-time (frontend) vs runtime (backend). Indicar cuáles van a Secret Manager. Ejemplos de `docker build` y `docker run` sin valores reales de secretos.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| `VITE_*` horneadas en build — cambiar URL API requiere rebuild frontend | Documentar en README; aceptado para SPA estática |
| CORS mismatch si `CORS_ORIGIN` no coincide con URL frontend | Checklist en deploy doc; validar en smoke test |
| GCS falla en Cloud Run sin IAM correcto | Documentar rol requerido del service account; no es bug de app |
| Tests frontend asumen `config.js` estático sin Vite | Usar `import.meta.env` con fallbacks; tests con `ENVIRONMENT=local` sin cambios |
| Imagen backend incluye código fuente completo | `.dockerignore` excluye tests y secretos; sin `.env` en imagen |

## Migration Plan

1. Implementar Dockerfiles, nginx, config y docs en repo.
2. Verificar localmente: `docker build` + `docker run` ambos servicios.
3. Ejecutar `npm test` backend y `npm run build && npm test` frontend.
4. (Fuera de este change) Operaciones despliega a Cloud Run con env vars y build args documentados.
5. Actualizar `CORS_ORIGIN` y `VITE_API_BASE_URL` a URLs Cloud Run definitivas.
6. Registrar redirect URI de Entra para URL frontend Cloud Run.

**Rollback:** Mantener despliegue AWS hasta validar Cloud Run; imágenes Docker no afectan runtime local (`npm run dev`).

## Open Questions

- Ruta exacta del README de deploy (`docs/deploy-cloud-run.md` vs `infra/cloud-run/README.md`) — proponer `docs/deploy-cloud-run.md` por claridad.
- ¿Pre-Prod usa `ENVIRONMENT=dev` o un valor nuevo? — Mantener `dev`/`prod` existentes; Cloud Run setea `ENVIRONMENT` según servicio.
- Nombre de imagen en Artifact Registry — decisión de operaciones, no bloqueante para este change.
