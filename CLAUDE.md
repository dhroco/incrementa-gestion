# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**incrementa-gestion** — ERP para gestión de contratos (proveedores, clientes, plantillas, documentos) de una empresa chilena. Monorepo:

- `frontend/` — React 19 + Vite + Redux Toolkit + React Router 7. UI con CSS propio (`src/styles/`); MUI se usa exclusivamente como librería de íconos (`@mui/icons-material`, variante Outlined), nunca como componentes. Auth con MSAL (`@azure/msal-*`).
- `backend/` — Node + Express + Knex.js + PostgreSQL. Valida JWT OIDC. Genera PDFs (`@react-pdf/renderer`), envía email (Resend), expone un **MCP Server** (`backend/mcp.mjs`).
- `infra/` — IaC (Bicep) y scripts de Azure. `docs/` — documentación (arquitectura, manuales de producción).
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

El backend **no usa dotenv**; lee `process.env` directo vía `config.js`. Las variables (incluidos secretos) se cargan con `backend/set-env-local.sh` (gitignored). Además, la BD local es la de pre-prod en Azure (PostgreSQL Flexible Server), alcanzada directo por su nombre de servidor: el firewall tiene que admitir tu IP y Blob Storage y Microsoft Graph usan tu sesión de `az login`:

```bash
./infra/azure/scripts/firewall-mi-ip.sh          # cada vez que cambie tu IP pública
az login
cd backend && source ./set-env-local.sh && npm run dev
```
`DATABASE_URL` usa siempre el nombre del servidor (`<servidor>.postgres.database.azure.com`), nunca una IP, y **`PGSSLMODE` va sin setear** (Azure exige TLS y `knexfile.js` lo valida; `PGSSLMODE=disable` solo sirve para una base local sin TLS).

## Configuración por ambiente (no .env)

`config.js` en back y front exporta configuración según `ENVIRONMENT` (única variable de selección), válido solo en `{local, dev, prod}`. **Pre-producción usa `ENVIRONMENT=dev`** (no existe un valor "preprod"). Los defaults son solo respaldo; en la nube las variables las inyecta la Container App (los secretos, desde Key Vault).

- Backend usa: `DATABASE_URL`, `OIDC_ISSUER_URL`, `OIDC_AUDIENCE`, `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_CONTAINER_DOCUMENTOS/FIRMADOS`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `FIRME_API_URL/TOKEN`, `FIRME_LEGAL_ENTITY_ID`, `CORS_ORIGIN`, `PORT`. Blob Storage y Microsoft Graph no usan secretos: autentican con `DefaultAzureCredential` (managed identity en Azure, `az login` en local).
- Frontend hornea en build-time (Vite): `VITE_API_BASE_URL`, `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_AUTHORITY`, `VITE_AZURE_API_SCOPE`, y `ENVIRONMENT` (vía `vite.config.js` define). Cambiar la URL del API en la nube requiere **rebuild** del frontend.

## Arquitectura

### Backend (Express + Knex)

- **App como factory con inyección de dependencias:** `backend/app.js` exporta `createApp({ ...servicesInjectables })`. `index.js` la arranca; los tests inyectan servicios/mocks. Servicios en `services/`, controladores en `controllers/`, respuestas HTTP en `http/responses.js` y `sessionResponses.js`.
- **Cadena de auth (todas las rutas protegidas por defecto):** `requireOidcAuth` (valida firma/issuer/audience por OIDC discovery) → `resolveInternalIdentity` → `attachAbility` (CASL) → `authorize`/`authorizeAny`. Las rutas públicas (`/`, `/health`) se declaran antes de aplicar `requireAuth`.
- **Identidad interna por EMAIL, no por `sub`:** `middleware/resolveInternalIdentity.js` mapea el email del token a la fila `user_profile` (índice único parcial sobre `LOWER(email)`). Esto desacopla del IdP. El alta de usuarios valida existencia en el tenant vía **Microsoft Graph app-only** (`lib/graphClient.js`, permiso `User.Read.All` tipo Aplicación).
- **Autorización:** permisos por perfil "empaquetados" (packed rules CASL) construidos en `services/abilityService.js`; el frontend recibe esas reglas en la sesión.
- **BD:** una sola instancia knex en `db/knex.js` desde `knexfile.js`. Migraciones en `migrations/`, seeds en `seeds/`.
- **Almacenamiento:** `services/storageService.js` usa Azure Blob Storage y firma SAS con clave de delegación. Las columnas se siguen llamando `gcs_path` (y `avatar_gcs_path`) por herencia: guardan la misma ruta (`contratos/…`, `contratos-firmados/…`, `avatars/…`). Los PDF firmados viven en un contenedor aparte con inmutabilidad (WORM), elegido por el prefijo de la ruta.
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

Azure (Brazil South): Container Apps (backend `ca-incrementa-backend` y MCP `ca-incrementa-mcp`), Static Web Apps (frontend), PostgreSQL Flexible Server 16, Blob Storage, Key Vault y ACR, definidos en `infra/azure/` (Bicep). CI/CD con GitHub Actions y OIDC federado (sin claves guardadas). Google Cloud se dio de baja el 20-oct-2026.

- Rama **`main`** = integración (sin deploy). Rama **`preprod`** → despliega a Pre-Prod (`.github/workflows/deploy-azure-preprod.yml`, grupo `rg-incrementa-preprod`): imagen del backend al ACR → MCP → backend → frontend a Static Web Apps. Rama **`prod`** → Producción en una suscripción de Azure de Incrementa (por crear; workflow análogo por crear).
- La infraestructura la cambia `.github/workflows/infra.yml`, solo a mano y con aprobación de David (what-if y luego aplicar). El workflow de deploy solo actualiza imágenes y contenido.
- Ver `docs/plan-migracion-azure.html`, `docs/arquitectura-entornos.html` y el manual de producción en `docs/`.

### Gotchas conocidos (ya resueltos, no re-romper)

- **Conexión a PostgreSQL:** `knexfile.js` pasa siempre un objeto `{ connectionString, ssl }` a knex (el parser interno de knex no se usa) y quita `sslmode` de la URL para que la validación del certificado no dependa de cómo venga escrita. Hay que usar el nombre del servidor y no una IP, porque el certificado tiene que calzar.
- **PGSSLMODE:** sin setear, tanto en local como en Azure. `disable` apaga TLS y solo vale para una base local sin TLS.
- **Firma de URLs de Blob:** usa clave de delegación (válida al menos 3 días y como máximo 7, límite de Azure), así que la identidad necesita permiso de delegación sobre la cuenta de almacenamiento; no hay claves ni SAS de cuenta.

## Flujo de trabajo del proyecto

- **Desarrollo con AOD** (desde el 28-sep-2026): Claude (Ignacio) diseña y prepara lo que entra; el orquestador AOD (agente Pedro) ejecuta las corridas con Cursor; las compuertas las aprueba David. Reemplaza el `propose`→`apply` manual de OpenSpec; las corridas siguen dejando sus artefactos en `openspec/changes/<cambio>/`.
- **Diseño y recortes:** `docs/disenos/<dominio>.md` (diseño), `<dominio>.recortes.yaml` (plan) y, por recorte, `prompts/<recorte>.md` (se usa tal cual en el `propose`) y `prompts/<recorte>.ablaciones.yaml`. Se entregan commiteados en la rama `planes`; a AOD se le pasa solo el hash.
- **Pruebas protegidas:** una corrida falla si cambia una prueba que existía al empezar. Las que deban cambiar se modifican antes, en un commit aparte y con autorización del dueño; las pruebas nuevas van siempre en archivos nuevos.
- **Ablaciones:** el campo `prueba` corre la suite completa (`cd backend && env -u DATABASE_URL npm test` / `cd frontend && npm test`) o un archivo nuevo, nunca uno existente. Un `buscar` de varias líneas usa `|2` o comillas dobles con `\n`.
- **Migraciones:** ninguna corrida las ejecuta (`knex`/`migrate` prohibidos; `knexfile.js`, `db/knex.js` y `config.js` son de solo lectura para las corridas). Las aplica el arquitecto contra pre-prod en Azure (procedimiento en `docs/incrementa-azure-migraciones-bd-con-container-apps-job.html`), antes del deploy del código que las usa. Las de plantillas reescriben `content_json` con una función pura, verifican el texto exacto antes de modificar y respaldan en `template_content_backup`.
- **Recortes encadenados:** si un recorte deja pruebas en rojo que implementa otro, el siguiente no se lanza desde `preprod` hasta que el primero esté fusionado, o se lanza sobre su rama; al entregar un hash se indica siempre la base.
- **`.jsx`:** antes de borrar una variable «sin uso», buscar que no aparezca en JSX (el lint no tiene `react/jsx-uses-vars`).
- **PRs:** cada corrida termina en una rama `david/<recorte>`; el arquitecto abre el PR a `preprod` y lo fusiona David.
- El contexto, las reglas por artefacto y el **sistema de diseño completo** (paleta, tipografía Nunito Sans, componentes, prohibiciones, `locale.rut_format`) están en **`openspec/config.yaml`** — esa es la fuente oficial para implementar el frontend; no reinterpretar estilos.
- Cursor lee `.cursor/rules/*.mdc` (contexto de proyecto, sistema de diseño frontend, convenciones de backend y gotchas). No lee `CLAUDE.md`.
