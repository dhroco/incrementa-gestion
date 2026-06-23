## Context

Hoy la autorización cruza tres capas acopladas:

1. **BD**: `navigation_node` (árbol de menú + códigos `NAV_*`) y `profile_navigation_grant` (qué perfil ve qué nodo).
2. **Backend**: `authorizationService` resuelve filas alcanzables por perfil; `requireNavigationGrant` valida códigos en cada ruta; `/api/me/session` devuelve `{ navigation: { tree, routes, grantedCodes } }`.
3. **Frontend**: Redux guarda `enrichedNavigation`; sidebar, guards (`RequireNavigationGrant`), botones de acción y títulos de módulo leen `grantedCodes` o `routes`.

El producto opera principalmente con `ADMINISTRADOR_PLATAFORMA`, pero el modelo de nodos escala mal: cada acción CRUD requiere un código `NAV_ACTION_*` en BD, seed, `app.js` y frontend. CASL (@casl/ability v6) separa **permisos** (action + subject) de **presentación** (menú estático en frontend).

Estado actual relevante (pre-cambio):
- Auth OIDC vía `requireOidcAuth` — **no se modifica**.
- `profileService.getCurrentUserProfile` / `getUserProfileIdByUserId` — **se conservan** (usados fuera de autorización).
- `userSessionMetaService` (`mustChangePassword`, `isActive`) — **se conserva** sin cambios de lógica.
- ~15 páginas frontend usan `buildGrantedCodeSetFromSession(navigation)` para botones Crear/Editar.

## Goals / Non-Goals

**Goals:**

- Reemplazar grants `NAV_*` por reglas CASL `(action, subject)` en tabla `role_permissions`.
- Evaluar permisos uniformemente en backend (`req.ability` + `authorize`) y frontend (singleton `ability` + `useAbility`).
- Menú sidebar como configuración estática (`menuConfig.js`) filtrada por CASL.
- Sesión enriquecida entrega `permissions` empaquetadas (`packRules`) en lugar de árbol de navegación.
- Migración ordenada: crear `role_permissions` → seed admin → drop tablas de navegación.
- Mantener mensajes de error en español (es-CL) y **403**/**401** existentes.

**Non-Goals:**

- UI de administración de roles/permisos (ruta placeholder `RolePermission` puede existir como guard, sin CRUD en este change).
- Permisos condicionales por registro (campo `conditions` en BD queda disponible pero sin uso inicial).
- Migrar datos granulares de `profile_navigation_grant` a filas equivalentes por recurso — solo seed `manage/all` para admin plataforma.
- Cambiar controllers de negocio, Keycloak, ni flujo de login OIDC.
- CASL v7 — se fija en **v6.x** por compatibilidad con `@casl/react`.

## Decisions

### 1. Tabla `role_permissions` ligada a `profile.id`

Columnas: `action`, `subject`, `fields`, `conditions`, `inverted`, `reason`. FK `role_id → profile.id ON DELETE CASCADE`.

**Alternativa descartada**: tabla intermedia `role` separada de `profile` — duplicaría el concepto de perfil ya existente.

### 2. `createMongoAbility` + `packRules` / `unpackRules`

Backend construye Ability desde BD; sesión serializa reglas empaquetadas. Frontend reconstruye con `ability.update(unpackRules(...))`.

**Alternativa descartada**: enviar JSON crudo de permisos sin empaquetar — más verboso en cada sesión.

### 3. Middleware global: `requireAuth` → `attachAbility`

Rutas públicas (`/health`, `/`, `POST /api/auth/login`, `POST /api/auth/refresh`) registradas **antes** de `app.use(requireAuth)` y `app.use(attachAbility())`. Rutas protegidas ya no repiten `requireAuth` por ruta.

**Alternativa descartada**: attachAbility solo en rutas con `authorize` — repetición y riesgo de olvidar inyectar ability.

### 4. Factory `authorize(action, subjectName)`

Reemplaza `grantMiddleware({ navigationCode })` y `anyOfNavigationCodes`. Para proveedores PUT: middleware inline `req.ability.can('update','Supplier') || req.ability.can('create','Supplier')` o helper `authorizeAny([...])`.

**Alternativa descartada**: mantener códigos NAV como subjects — perpetúa el acoplamiento.

### 5. Mapeo action/subject (contrato estable)

| Recurso | read | create | update | use |
|---------|------|--------|--------|-----|
| Empresas | Company | Company | Company | — |
| Usuarios plataforma | PlatformUser | PlatformUser | PlatformUser | — |
| Proveedores | Supplier | Supplier | Supplier | — |
| Plantillas estándar | Template | Template | Template | — |
| Constructor documento | — | — | — | DocumentBuilder |
| Dashboard | Dashboard | — | — | — |
| Roles y permisos | RolePermission | — | — | — |

Placeholder modules (`NAV_CONTRATOS`, etc.) → `authorize('read', 'All')` o subject dedicado si se mantiene el endpoint.

Admin plataforma: una regla `{ action: 'manage', subject: 'all' }` cubre todo vía semántica CASL.

### 6. Frontend: singleton `ability` fuera de Redux

`ability.update()` en login/sesión/logout; `@casl/react` `useAbility(AbilityContext)` re-renderiza componentes. Redux conserva `enrichedProfile`, email, name, `enrichedIsActive`, `mustChangePassword` — **elimina** `enrichedNavigation`.

**Alternativa descartada**: guardar reglas CASL en Redux — duplica fuente de verdad y no aprovecha suscripción de `@casl/react`.

### 7. Menú estático `MENU_CONFIG`

Cada ítem: `id`, `label`, `path`, `navCode` (legacy para tests/telemetría opcional), `check: { action, subject } | null`. Sidebar filtra grupos con hijos visibles.

Títulos de módulo (`PageShell`, `AppSubHeader`): resolver desde `MENU_CONFIG` por `pathname` (nueva helper `getModuleTitleFromMenuConfig`) en lugar de `navigation.routes.moduleTitle`.

Botones Crear/Editar en páginas: migrar de `grantedCodes.has('NAV_ACTION_*')` a `useAbility().can('create'|'update', Subject)`.

### 8. `ProfileNavGuard` simplificado

Solo verifica `enrichmentStatus === 'succeeded'` e `enrichedIsActive === true`. Elimina `buildAllowedPathSet` / `decidePrivateNavigation` basados en `routes`.

**Alternativa descartada**: mantener lista blanca de rutas desde backend — redundante con `RequireCan` por ruta.

### 9. Eliminación de archivos obsoletos

Backend: `authorizationService.js`, `requireNavigationGrant.js`, `meNavigationController.js` (+ tests). Frontend: `RequireNavigationGrant.jsx`, `proveedoresAuth.js`; podar `authorizationSelectors.js` (conservar solo helpers de path/menu si aplica). Seed `002_navigation_authorization_seed.js` → no-op.

### 10. Dependencias npm

- Backend: `@casl/ability@^6`
- Frontend: `@casl/ability@^6`, `@casl/react@^6`

Verificar `package.json` antes de implementar lógica CASL.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Breaking change en `/api/me/session` | Actualizar frontend y tests en el mismo change; no hay clientes externos conocidos. |
| Páginas que aún lean `enrichedNavigation` | Grep exhaustivo; migrar a `useAbility` o `menuConfig`. |
| `moduleTitle` ya no viene del backend | Helper estática en `menuConfig.js`; fallback "Módulo". |
| Drop de tablas de navegación irreversible | Migración 015 solo después de 014 + seed; backup BD en GCP. |
| Rutas públicas bloqueadas por `requireAuth` global | Registrar auth routes y health **antes** del middleware global. |
| Perfiles futuros sin filas en `role_permissions` | Ability vacío → 403 en API y menú vacío; documentar seeding de nuevos perfiles. |
| Tests de navegación obsoletos | Actualizar `meNavigationApi`, `meSessionApi`, `AppSidebar.test`, `authSlice.test`. |

## Migration Plan

1. **Migración 014**: crear `role_permissions`.
2. **Seed 003**: insert idempotente `manage/all` para `ADMINISTRADOR_PLATAFORMA`.
3. **Código backend**: abilityService, middleware, app.js, session payload.
4. **Migración 015**: drop `profile_navigation_grant`, `navigation_node`.
5. **Seed 002**: vaciar (no-op).
6. **Frontend**: ability, menuConfig, authSlice, router, sidebar, páginas.
7. **Tests**: backend + frontend; `npm test` en ambos paquetes.
8. **Verificación manual**: login admin → menú completo → CRUD empresas/proveedores → token inválido → 401.

**Rollback**: revertir deploy de código; restaurar BD desde backup (drop de tablas de navegación no es reversible sin backup).

## Open Questions

- ¿Se mantienen endpoints placeholder `/api/modules/*` y `/api/placeholder/*` con subject `All`, o se eliminan en un change posterior?
- ¿La ruta `/app/admin-global/roles-permisos` queda como placeholder protegido por `read RolePermission` sin implementación UI?
