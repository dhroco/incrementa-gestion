# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**incrementa-gestion** — ERP para gestión de contratos (proveedores, clientes, plantillas, documentos) de una empresa chilena. Monorepo:

- `frontend/` — React 19 + Vite + Redux Toolkit + React Router 7 + MUI. Auth con MSAL (`@azure/msal-*`).
- `backend/` — Node + Express + Knex.js + PostgreSQL. Valida JWT OIDC. Genera PDFs (`@react-pdf/renderer`), envía email (Resend), expone un **MCP Server** (`backend/mcp.mjs`).
- `infra/` — IaC/scripts GCP. `docs/` — documentación (arquitectura, manuales de producción).
- `openspec/` — gestión de cambios spec-driven (ver más abajo).

Locale: Chile (`es-CL`, timezone `America/Santiago`, RUT `XX.XXX.XXX-X`). Mensajes de error al usuario en español.

## Comandos

Desde la raíz (usa `concurrently`):
```bash
npm run dev            # backend (:3000) + frontend (:5173) juntos
npm run dev:backend    # solo backend (nodemon)
npm run dev:frontend   # solo frontend (vite)
```

Backend (`cd backend`):
```bash
npm test                                   # node --test (todos los *.test.js)
node --test test/companyApi.test.js        # un archivo de test
node --test --test-name-pattern="<nombre>" # tests que matcheen por nombre
npm run migrate:latest                     # knex migrate:latest
npm run migrate:rollback
npm run seed:run
npm run mcp                                 # levantar el MCP server (stdio)
```

Frontend (`cd frontend`):
```bash
npm test                       # vitest run
npx vitest run src/x.test.jsx  # un archivo
npx vitest                     # modo watch
npm run lint                   # eslint
npm run build
```

### Correr el backend localmente (importante)

El backend **no usa dotenv**; lee `process.env` directo vía `config.js`. Las variables (incluidos secretos) se cargan con `backend/set-env-local.sh` (gitignored). Además, la BD local es la misma de la nube, alcanzada por el **Cloud SQL Auth Proxy**:

```bash
cloud-sql-proxy <connection-name> --port 5432    # en su propia terminal
cd backend && source ./set-env-local.sh && npm run dev
```
`DATABASE_URL` local apunta a `127.0.0.1:5432` (proxy) y **`PGSSLMODE` va sin setear** (el túnel ya es cifrado; setearlo rompe la conexión a localhost).

## Configuración por ambiente (no .env)

`config.js` en back y front exporta configuración según `ENVIRONMENT` (única variable de selección), válido solo en `{local, dev, prod}`. **Pre-producción usa `ENVIRONMENT=dev`** (no existe un valor "preprod"). Los defaults son solo respaldo; en la nube las variables las inyecta Cloud Run.

- Backend usa: `DATABASE_URL`, `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, `GRAPH_TENANT_ID/CLIENT_ID/CLIENT_SECRET`, `GCS_BUCKET`, `GOOGLE_APPLICATION_CREDENTIALS` (solo local), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CORS_ORIGIN`, `PORT`.
- Frontend hornea en build-time (Vite): `VITE_API_BASE_URL`, `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_AUTHORITY`, `VITE_AZURE_API_SCOPE`, y `ENVIRONMENT` (vía `vite.config.js` define). Cambiar la URL del API en la nube requiere **rebuild** del frontend.

## Arquitectura

### Backend (Express + Knex)

- **App como factory con inyección de dependencias:** `backend/app.js` exporta `createApp({ ...servicesInjectables })`. `index.js` la arranca; los tests inyectan servicios/mocks. Servicios en `services/`, controladores en `controllers/`, respuestas HTTP en `http/responses.js` y `sessionResponses.js`.
- **Cadena de auth (todas las rutas protegidas por defecto):** `requireOidcAuth` (valida firma/issuer/audience por OIDC discovery) → `resolveInternalIdentity` → `attachAbility` (CASL) → `authorize`/`authorizeAny`. Las rutas públicas (`/`, `/health`) se declaran antes de aplicar `requireAuth`.
- **Identidad interna por EMAIL, no por `sub`:** `middleware/resolveInternalIdentity.js` mapea el email del token a la fila `user_profile` (índice único parcial sobre `LOWER(email)`). Esto desacopla del IdP. El alta de usuarios valida existencia en el tenant vía **Microsoft Graph app-only** (`lib/graphClient.js`, permiso `User.Read.All` tipo Aplicación).
- **Autorización:** permisos por perfil "empaquetados" (packed rules CASL) construidos en `services/abilityService.js`; el frontend recibe esas reglas en la sesión.
- **BD:** una sola instancia knex en `db/knex.js` desde `knexfile.js`. Migraciones en `migrations/`, seeds en `seeds/`.
- **GCS:** `services/gcsService.js` firma URLs V4. En local requiere una key de service account (`GOOGLE_APPLICATION_CREDENTIALS`); en Cloud Run firma vía IAM signBlob con la identidad del runtime.
- **MCP Server:** `mcp.mjs` registra tools de `mcpTools.mjs` (crear/listar/actualizar proveedores y clientes, generar/firmar/consultar contratos, plantillas). Reutiliza los mismos services que la API.

### Frontend (React + MSAL)

- Auth: `src/config/msalConfig.js` (redirectUri = `window.location.origin`), `src/auth/` (msalInstance, obtención de token, `AuthInitializer`, `normalizeAuthEmail`). La sesión y permisos viven en `src/store/authSlice.js` (Redux Toolkit); el gate de rutas está en `src/routes/`.
- Flujo: login MSAL (Authorization Code + PKCE) → el frontend llama a la API con el JWT → backend valida y resuelve identidad por email → responde sesión enriquecida (perfil + permisos CASL + URL firmada de avatar).
- RUT: implementación canónica en `src/utils/rut.js`; input con `src/components/RutInput.jsx` (`formatRut`/`formatRutDisplay` para mostrar, `RutInput` para editar). La validación (módulo 11) es independiente del formateo.

### Convenciones de BD

Tablas en **inglés y singular**; columnas en inglés `snake_case`. Excepciones (plural) solo con razón documentada.

### Endpoints principales (API REST)

Todo bajo `/api` y protegido por JWT (salvo `/` y `/health`, públicos). Definidos en `backend/app.js`:

- **Sesión / perfil:** `GET /api/me/session` (sesión enriquecida: perfil + permisos + avatar), `GET /api/me/authorization/current`, `GET|PUT /api/me/profile`, `POST /api/me/avatar`.
- **Navegación / dashboard:** `GET /api/modules/*`, `GET /api/dashboard/stats`.
- **Empresas:** `GET|POST /api/companies`, `GET|PUT /api/companies/:id`.
- **Usuarios de plataforma:** `GET|POST /api/platform/users`, `GET|PUT /api/platform/users/:id`, `GET /api/platform/users/roles`.
- **Roles y permisos:** `GET|POST /api/roles`, `GET /api/roles/:id`, `PUT /api/roles/:id/label`, `PUT /api/roles/:id/permissions`, `DELETE /api/roles/:id`.
- **Proveedores:** `GET|POST /api/suppliers`, `GET /api/suppliers/:id`, `GET /api/suppliers/:id/documents`, `GET /api/social-networks/catalog`.
- **Clientes:** `GET|POST /api/clients`, `GET|PUT /api/clients/:id`.
- **Contratos:** `GET /api/contracts`, `POST /api/contracts/:id/sign` (firma electrónica), `GET /api/contracts/:id/pdf`.
- **Plantillas estándar:** `GET|POST /api/standard-templates`, `GET|PUT /api/standard-templates/:id`.

## Despliegue y CI/CD

GCP Cloud Run (backend Express + frontend nginx), Cloud SQL (PostgreSQL 16), GCS, Artifact Registry, Secret Manager. CI/CD con GitHub Actions + **Workload Identity Federation** (keyless, sin llaves JSON).

- Rama **`main`** = integración (sin deploy). Rama **`preprod`** → despliega a Pre-Prod (`.github/workflows/deploy-preprod.yml`, proyecto `incrementa-gestion-dev`). Rama **`prod`** → Producción en la nube del cliente (proyecto/tenant propios; workflow análogo por crear).
- El deploy sigue un orden de 5 pasos por dependencia de URLs: build+push backend → deploy backend → build+push frontend con `VITE_API_BASE_URL` = URL del backend → deploy frontend → update backend `CORS_ORIGIN` = URL del frontend.
- Ver `docs/arquitectura-entornos.html` y los manuales de producción en `docs/`.

### Gotchas conocidos (ya resueltos, no re-romper)

- **Conexión Cloud SQL por socket:** `knexfile.js` pasa `{ connectionString }` a knex (no el string crudo). El parser interno de knex NO entiende `?host=/cloudsql/INSTANCE` (lo trata como filename de sqlite → cae a localhost:5432). `pg` sí lo entiende cuando recibe `{ connectionString }`.
- **Cloud Run: el frontend también necesita `--service-account`** (si no, usa la SA de compute por defecto y el deploy falla por falta de `actAs`).
- **PGSSLMODE:** sin setear tanto en local (proxy) como en Cloud Run (socket).
- **Firma de URLs GCS:** el ADC de usuario no puede firmar; local usa key JSON, la runtime SA en Cloud Run necesita `roles/iam.serviceAccountTokenCreator` sobre sí misma.

## Flujo de trabajo del proyecto

- **Gestión de cambios con OpenSpec:** los cambios se proponen y aplican bajo `openspec/changes/` (`propose` → `apply`), con specs en `openspec/specs/`. El contexto, reglas por artefacto y el **sistema de diseño completo** (paleta, tipografía Nunito Sans, componentes, prohibiciones, `locale.rut_format`) están en **`openspec/config.yaml`** — esa es la fuente oficial para implementar el frontend; no reinterpretar estilos.
- Reglas de Cursor/skills OpenSpec en `.cursor/`.
- Roles de colaboración y estado histórico de la migración a GCP en `HANDOFF-CONTEXT.md` (Claude = arquitecto/PM y revisor; Cursor = implementa el código de producto vía OpenSpec).
