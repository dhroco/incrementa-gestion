## 1. Backend — Dockerfile y dockerignore

- [x] 1.1 Reescribir `backend/Dockerfile`: base `node:22-slim`, copiar `package*.json`, `RUN npm ci --omit=dev`, copiar fuente, usuario no-root (`USER node`), `CMD ["node","index.js"]`
- [x] 1.2 Ampliar `backend/.dockerignore`: añadir `secrets/` y `*.cmd` (mantener exclusiones existentes: `node_modules`, `.git`, `test/`, `*.md`)

## 2. Backend — Parametrización config.js

- [x] 2.1 En `backend/config.js`, actualizar `dev`: `PORT: process.env.PORT || 3000`, `HOST: '0.0.0.0'`, `CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://dev.dlrt4e5spibmy.amplifyapp.com'`
- [x] 2.2 En `backend/config.js`, actualizar `prod`: confirmar `PORT: process.env.PORT || 3000`, `HOST: '0.0.0.0'`, `CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://gestion-contratos.com'`
- [x] 2.3 Verificar que `GCS_KEY_FILE` sigue siendo `process.env.GOOGLE_APPLICATION_CREDENTIALS || null` y que `gcsService.js` no requiere cambios (ADC cuando es `null`)

## 3. Frontend — Dockerfile, nginx y dockerignore

- [x] 3.1 Crear `frontend/nginx.conf`: `listen 8080`, `root /usr/share/nginx/html`, `try_files $uri $uri/ /index.html;`
- [x] 3.2 Crear `frontend/Dockerfile` multi-stage: stage `build` (`node:22-slim`, `npm ci`, `npm run build` con ARGs/ENV `VITE_*`); stage `runtime` (`nginx:alpine`, copiar `dist/` y `nginx.conf`)
- [x] 3.3 Crear `frontend/.dockerignore`: `node_modules`, `dist`, `.git`, `test/`, `*.md`, coverage

## 4. Frontend — Parametrización config.js

- [x] 4.1 Refactorizar `frontend/config.js`: `API_BASE_URL` desde `import.meta.env.VITE_API_BASE_URL` en `dev`/`prod` con fallbacks apropiados; `local` mantiene `http://localhost:3000`
- [x] 4.2 Confirmar que `msalConfig.js` y flujo MSAL no se modifican (solo build args en Dockerfile)

## 5. Documentación de despliegue

- [x] 5.1 Crear `docs/deploy-cloud-run.md` con inventario de variables build-time (frontend) y runtime (backend)
- [x] 5.2 Documentar que `GOOGLE_APPLICATION_CREDENTIALS` no se setea en Cloud Run (ADC del service account)
- [x] 5.3 Incluir ejemplos `docker build` / `docker run` con placeholders (sin secretos reales)

## 6. Verificación

- [x] 6.1 `docker build -t incrementa-backend ./backend` sin errores — **Deferred:** se valida en CI (no hay Docker en el host de desarrollo)
- [x] 6.2 `docker run` backend con env mínimas → `curl http://localhost:8080/health` responde 200 — **Deferred:** se valida en CI (no hay Docker en el host de desarrollo)
- [x] 6.3 `docker build` frontend con `--build-arg VITE_API_BASE_URL=...` (y `VITE_AZURE_*`) sin errores — **Deferred:** se valida en CI (no hay Docker en el host de desarrollo)
- [x] 6.4 `docker run` frontend en puerto 8080 → SPA carga y ruta profunda devuelve `index.html` — **Deferred:** se valida en CI (no hay Docker en el host de desarrollo)
- [x] 6.5 `npm test` en `backend/` en verde
- [x] 6.6 `npm run build && npm test` en `frontend/` en verde
