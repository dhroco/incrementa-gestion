## Why

El backend y el frontend de incrementa-gestion se despliegan hoy en AWS (Amplify + URLs hardcodeadas en `config.js`), mientras el destino de Pre-Prod/Prod es Google Cloud Run. Sin imágenes Docker reproducibles y configuración parametrizada por entorno, no es posible desplegar de forma segura en Cloud Run ni eliminar URLs y secretos embebidos en el código.

## What Changes

- **Backend** (`backend/Dockerfile`, `backend/.dockerignore`): imagen de producción basada en `node:22-slim`, `npm ci --omit=dev`, usuario no-root, `CMD ["node","index.js"]`. Escucha en `process.env.PORT` (Cloud Run inyecta `8080`) y host `0.0.0.0`.
- **Backend** (`backend/config.js`): `CORS_ORIGIN` leído de `process.env.CORS_ORIGIN` en entornos `dev`/`prod` desplegados, con fallback a valores actuales. Confirmar `PORT: process.env.PORT || 3000` y `HOST: '0.0.0.0'` en despliegue. Sin copiar secretos a la imagen; GCS usa ADC cuando `GOOGLE_APPLICATION_CREDENTIALS` no está seteada.
- **Frontend** (`frontend/Dockerfile` multi-stage + `frontend/nginx.conf`): stage build con Node LTS (`npm ci` + `npm run build`); stage runtime `nginx:alpine` sirviendo `dist/` en puerto 8080 con fallback SPA (`try_files $uri /index.html;`).
- **Frontend** (`frontend/config.js`): `API_BASE_URL` desde `import.meta.env.VITE_API_BASE_URL` con fallback `http://localhost:3000`, alineado con el patrón de `msalConfig.js` (`VITE_AZURE_*`). Eliminar dependencia de URLs AWS hardcodeadas para entornos desplegados.
- **Documentación** (`docs/deploy-cloud-run.md` o ruta equivalente): inventario de variables de build (frontend) y runtime (backend) para Cloud Run / Secret Manager.
- **Verificación**: `docker build` de ambas imágenes; backend responde `GET /health` en `$PORT`; frontend sirve SPA con routing; `npm test` (backend) y `npm run build` + `npm test` (frontend) siguen en verde.

**Sin cambios en esta etapa:**

- Lógica de autenticación (Entra/MSAL/Graph), middleware OIDC, rutas de negocio ni contratos de API.
- Flujo MSAL existente (`msalConfig.js`, redirect URIs dinámicos).
- IaC de Cloud Run (creación de servicios, IAM, Secret Manager) — solo empaquetado y parametrización.

## Capabilities

### New Capabilities

- `cloud-run-backend-container`: Dockerfile de producción del backend, `.dockerignore`, parametrización de `config.js` para Cloud Run (PORT, HOST, CORS_ORIGIN, ADC para GCS) y verificación de health check en contenedor.
- `cloud-run-frontend-container`: Dockerfile multi-stage del frontend, `nginx.conf` con SPA fallback en puerto 8080, parametrización de `API_BASE_URL` vía `VITE_API_BASE_URL` y verificación de build/serve en contenedor.
- `cloud-run-deploy-documentation`: README de despliegue con inventario de variables de entorno (build-time Vite y runtime backend), sin secretos en repo ni en imágenes.

### Modified Capabilities

- _(Ninguno: no altera requisitos funcionales de aplicación ya publicados en `openspec/specs/`; solo empaquetado, nginx y parametrización de configuración por entorno.)_

## Impact

- **Backend**: `backend/Dockerfile` (reescritura), `backend/.dockerignore` (ampliación: `secrets/`, `*.cmd`), `backend/config.js` (CORS_ORIGIN y PORT en `dev`/`prod`).
- **Frontend**: nuevo `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`, `frontend/config.js` (VITE_API_BASE_URL).
- **Documentación**: nuevo README de deploy con variables para Pre-Prod Cloud Run.
- **Sin cambios**: `app.js`, auth/MSAL, `gcsService.js` (ya soporta ADC), Graph, migraciones, tests de negocio (deben seguir pasando).
- **Operaciones**: build args Vite (`VITE_API_BASE_URL`, `VITE_AZURE_*`); env vars runtime backend (`ENVIRONMENT`, `DATABASE_URL`, `CORS_ORIGIN`, `OIDC_*`, `GRAPH_*`, `GCS_BUCKET`, `RESEND_*`); `PORT` inyectado por Cloud Run; **no** setear `GOOGLE_APPLICATION_CREDENTIALS` en Cloud Run.

## Consideraciones de seguridad

- Ningún secreto (claves GCS, `GRAPH_CLIENT_SECRET`, `RESEND_API_KEY`, `DATABASE_URL`) debe copiarse a la imagen Docker ni commitearse al repositorio.
- Variables sensibles en Cloud Run deben provenir de Secret Manager o env vars del servicio, no de build args del frontend.
- `CORS_ORIGIN` debe coincidir exactamente con la URL del frontend desplegado para evitar exposición cross-origin indebida.
- En Cloud Run, GCS debe usar la identidad del servicio (ADC); no montar archivos JSON de service account en el contenedor.
- Las variables `VITE_*` se hornean en el bundle del frontend en build time — solo valores públicos (URLs, client IDs de SPA); nunca secretos de servidor.
