## 0. Lectura previa (obligatoria)

- [x] 0.1 Leer completos: `requireOidcAuth.js`, `requireNavigationGrant.js`, `authorizationService.js`, `profileService.js`, `userSessionMetaService.js`, `meNavigationController.js`, `app.js`, `authSlice.js`, `AppRouter.jsx`, `RequireNavigationGrant.jsx`, `ProfileNavGuard.jsx`, `authorizationSelectors.js`, `proveedoresAuth.js`
- [x] 0.2 Grep de usos de `enrichedNavigation`, `grantedCodes`, `RequireNavigationGrant`, `grantMiddleware` en backend y frontend

## 1. Dependencias

- [x] 1.1 Backend: `npm install @casl/ability@^6` — verificar en `package.json` versión ^6.x
- [x] 1.2 Frontend: `npm install @casl/ability@^6 @casl/react@6` — verificar en `package.json` versión ^6.x

## 2. Base de datos y seeds

- [x] 2.1 Crear migración `202605290014_create_role_permissions.js` (tabla `role_permissions` según diseño)
- [x] 2.2 Crear seed `014_casl_permissions_seed.js`: idempotente `manage/all` para `ADMINISTRADOR_PLATAFORMA`
- [x] 2.3 Vaciar o no-op `002_navigation_authorization_seed.js` (mantener archivo exportando seed vacío)
- [x] 2.4 Ejecutar `migrate:latest` + seeds en local; verificar fila en `role_permissions`
- [x] 2.5 Crear migración `202605290015_drop_navigation_authorization_tables.js` (drop `profile_navigation_grant`, `navigation_node`); ejecutar tras verificar 2.4

## 3. Backend — servicios y middleware CASL

- [x] 3.1 Crear `backend/services/abilityService.js` (`buildAbilityForUser`, `buildPackedRulesForUser` con `packRules`)
- [x] 3.2 Crear `backend/middleware/attachAbility.js`
- [x] 3.3 Crear `backend/middleware/authorize.js` (403 en español vía `ForbiddenError`)
- [x] 3.4 Crear helper opcional `authorizeAny(actions, subject)` para PUT proveedores (create OR update)

## 4. Backend — app.js y sesión

- [x] 4.1 Editar `app.js`: importar `attachAbility` y `authorize`; registrar rutas públicas antes de `app.use(requireAuth)` + `app.use(attachAbility())`
- [x] 4.2 Reemplazar todos los `grantMiddleware({ navigationCode / anyOfNavigationCodes })` por `authorize(action, subject)` según tabla de mapeo (Company, PlatformUser, Supplier, Template, DocumentBuilder, Dashboard, RolePermission, All)
- [x] 4.3 Eliminar `requireAuth` redundante en rutas individuales (auth global)
- [x] 4.4 Modificar `enrichedSessionPayload` / `respondEnrichedSession`: retornar `permissions: packedRules` en lugar de `navigation`; usar `buildPackedRulesForUser`
- [x] 4.5 Eliminar ruta `GET /api/me/navigation` y wiring de `meNavigationController`
- [x] 4.6 Actualizar `sessionResponses.js` / `buildEnrichedSessionSuccessBody` si el shape de respuesta cambia allí

## 5. Backend — limpieza

- [x] 5.1 Eliminar `requireNavigationGrant.js`, `authorizationService.js`, `meNavigationController.js`
- [x] 5.2 Conservar `profileService.js` (solo `getCurrentUserProfile`, `getUserProfileIdByUserId`)
- [x] 5.3 Eliminar o reescribir `backend/test/requireNavigationGrant.test.js`; actualizar `meSessionApi.test.js` y tests de navegación

## 6. Frontend — ability y menú

- [x] 6.1 Crear `frontend/src/lib/ability.js` (singleton, `AbilityContext`, `Can`)
- [x] 6.2 Crear `frontend/src/navigation/menuConfig.js` con `MENU_CONFIG` completo y helper `getModuleTitleFromMenuConfig(pathname)`
- [x] 6.3 Envolver app en `AbilityContext.Provider` (`main.jsx` o raíz equivalente)

## 7. Frontend — authSlice y sesión

- [x] 7.1 Editar `authSlice.js`: importar `ability` + `unpackRules`; en `fetchEnrichedSessionThunk` llamar `ability.update(unpackRules(data.permissions))`
- [x] 7.2 Eliminar estado/selectors `enrichedNavigation`; conservar profile, email, name, isActive, enrichment status
- [x] 7.3 En `signOutThunk` / logout: `ability.update([])`
- [x] 7.4 Actualizar `authSlice.test.js` y mocks de sesión en tests de páginas

## 8. Frontend — guards y router

- [x] 8.1 Crear `RequireCan.jsx` (o inline en router) con `useAbility(AbilityContext)`
- [x] 8.2 Editar `AppRouter.jsx`: reemplazar cada `RequireNavigationGrant` por `RequireCan` con mapeo action/subject
- [x] 8.3 Simplificar `ProfileNavGuard.jsx`: solo `enrichmentStatus === 'succeeded'` e `enrichedIsActive === true`
- [x] 8.4 Eliminar `RequireNavigationGrant.jsx`, `proveedoresAuth.js`

## 9. Frontend — sidebar, layout y páginas

- [x] 9.1 Editar `AppSidebar.jsx`: filtrar `MENU_CONFIG` con `useAbility` en lugar de `mapApiNavTreeToSidebarItems(navigation.tree)`
- [x] 9.2 Editar `AppSubHeader.jsx` y `PageShell.jsx`: títulos desde `menuConfig` en lugar de `getModuleTitleFromAuthorizationRoutes`
- [x] 9.3 Migrar páginas que usan `grantedCodes` a `useAbility().can(...)`: Companies*, PlatformUsers*, Supplier*, StandardTemplates*, DocumentBuilder*, CompanyEditLayout
- [x] 9.4 Actualizar `GuestOnlyRoute.jsx`, `AccessDeniedPage.jsx`, `AppRouter` redirect logic si dependen de `navigation.routes`
- [x] 9.5 Podar `authorizationSelectors.js`: eliminar funciones obsoletas (`buildGrantedCodeSetFromSession`, `mapApiNavTreeToSidebarItems`, etc.); actualizar tests

## 10. Tests y verificación

- [x] 10.1 Backend: tests de ability/authorize y sesión con `permissions`; `npm test` pasa
- [x] 10.2 Frontend: `AppSidebar.test.jsx`, tests de router/guards; `npm test` / `npm run build` sin errores
- [x] 10.3 Smoke manual: login admin → menú correcto → navegar rutas protegidas → CRUD con permisos → request sin token → 401 → request sin permiso → 403
