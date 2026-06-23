## Why

El sistema actual acopla autorización, menú y rutas a tablas `navigation_node` + `profile_navigation_grant`, lo que obliga a mantener cientos de códigos `NAV_*` sincronizados entre BD, API y frontend. CASL (@casl/ability v6) permite modelar permisos como pares `(action, subject)` evaluables de forma uniforme en backend y frontend, con menú estático en el cliente y reglas persistidas en una tabla dedicada `role_permissions`.

## What Changes

- **BREAKING**: Nueva tabla `role_permissions` y eliminación de `profile_navigation_grant` y `navigation_node` (migraciones `202605290014` y `202605290015`).
- **BREAKING**: `GET /api/me/session` deja de retornar `navigation: { tree, routes, grantedCodes }` y retorna `permissions` (reglas empaquetadas CASL) más `profile`.
- **BREAKING**: Eliminación del endpoint `GET /api/me/navigation` y del alias de autorización basado en árbol de navegación.
- **Backend**: Nuevos `abilityService`, middleware `attachAbility` (global tras auth) y `authorize(action, subject)` reemplazando `requireNavigationGrant` / `grantMiddleware` en todas las rutas protegidas.
- **Backend**: `requireAuth` pasa a middleware global; rutas públicas (`/health`, `/`, `/api/auth/login`, `/api/auth/refresh`) quedan registradas antes.
- **Frontend**: Singleton `ability` + `AbilityContext`; menú estático en `menuConfig.js`; `RequireCan` reemplaza `RequireNavigationGrant`; sidebar filtra por CASL; Redux deja de almacenar `enrichedNavigation`.
- **Dependencias**: `@casl/ability` ^6.x en backend; `@casl/ability` + `@casl/react` ^6.x en frontend.
- **Seeds**: Nuevo `003_casl_permissions_seed.js` con `{ action: 'manage', subject: 'all' }` para `ADMINISTRADOR_PLATAFORMA`; seed `002_navigation_authorization_seed.js` vaciado o retirado.
- **Eliminación**: `authorizationService.js`, `requireNavigationGrant.js`, `meNavigationController.js`, `RequireNavigationGrant.jsx`, `proveedoresAuth.js` y funciones de `authorizationSelectors.js` ligadas a `grantedCodes` / árbol API.

## Capabilities

### New Capabilities

- `casl-authorization`: Permisos basados en CASL — tabla `role_permissions`, construcción de Ability en backend (`abilityService`, `attachAbility`, `authorize`), empaquetado en sesión, singleton y contexto en frontend, menú estático filtrado por `ability.can`, guards de ruta `RequireCan`, y mapeo completo de acciones/subjects para recursos existentes (Company, Supplier, Template, PlatformUser, DocumentBuilder, Dashboard, RolePermission).

### Modified Capabilities

- `backend-auth-session-endpoints`: La respuesta enriquecida de sesión expone `permissions` (packed CASL rules) en lugar de `navigation`; se elimina `/api/me/navigation`.
- `frontend-backend-auth-session`: `fetchEnrichedSessionThunk` hidrata el singleton `ability` vía `unpackRules`; se elimina `enrichedNavigation` del estado Redux; logout limpia reglas; guards y páginas usan `useAbility` / `<Can>` en lugar de `grantedCodes`.

## Impact

- **Base de datos**: Nueva `role_permissions`; drop de tablas de navegación; seed idempotente para admin plataforma.
- **API**: Todas las rutas con `grantMiddleware({ navigationCode })` migran a `authorize('action', 'Subject')`; contrato de sesión cambia (breaking para clientes que lean `navigation`).
- **Frontend**: ~15 páginas que leen `grantedCodes` deben migrar a CASL; `PageShell` / `AppSubHeader` que resuelven `moduleTitle` desde `navigation.routes` deben usar `menuConfig` u otra fuente estática; tests de sidebar, auth slice y navegación requieren actualización.
- **Archivos obsoletos**: Ver lista en diseño; tests `requireNavigationGrant.test.js`, `meNavigationApi.test.js` (si existe) y similares.
- **No se modifica**: `requireOidcAuth.js`, lógica de `mustChangePassword` / `isActive` en `userSessionMetaService.js`, ni controllers de negocio (company, supplier, etc.) salvo middleware de rutas.

## Consideraciones de seguridad

- Las reglas CASL se cargan server-side desde BD por perfil activo; el cliente recibe solo reglas empaquetadas ya resueltas para su rol (no la matriz completa de permisos de todos los roles).
- `authorize` debe ejecutarse después de `attachAbility`; rutas sin token siguen devolviendo **401** vía `requireAuth` global.
- Mensajes de **403** en español (es-CL): "No tienes permiso para realizar esta acción."
- Migración destructiva de tablas de navegación: ejecutar en entornos no productivos primero; respaldar BD antes de `migrate:latest` en GCP.
- Validación de permisos en backend (fuente de verdad); el frontend filtra menú y rutas solo como UX — no sustituye la autorización API.
