## 1. Base de datos

- [x] 1.1 Crear `backend/migrations/20260526XXXX_drop_contador_empresa_profiles.js` con `up` en orden: drop `accountant_company`, `accountant`, `company_internal_user`; delete `user_profile` y `profile` para códigos `CONTADOR` y `USUARIO_EMPRESA_ADMINISTRADOR`; `down` irreversible
- [x] 1.2 Ejecutar `knex migrate:latest` en entorno local/GCP y confirmar tablas y perfiles eliminados

## 2. Seeds

- [x] 2.1 Actualizar `001_profiles_seed.js`: solo `ADMINISTRADOR_PLATAFORMA`
- [x] 2.2 Actualizar `002_navigation_authorization_seed.js`: quitar grants de `CONTADOR` y `USUARIO_EMPRESA_ADMINISTRADOR`; ajustar mensaje de prerequisito
- [x] 2.3 Actualizar `010_gfa_user_profile_and_inheritance_seed.js`: quitar `contador@` y `empresa@` y entradas Keycloak asociadas

## 3. Backend — eliminar archivos

- [x] 3.1 Eliminar controllers: `accountantPlatformController.js`, `internalCompanyUsersController.js`
- [x] 3.2 Eliminar services: `accountantAdminService.js`, `internalCompanyUsersService.js`, `accountantAssignedCompaniesService.js`
- [x] 3.3 Eliminar `scripts/delete-accountant-user.js` y `test/accountantPlatformApi.test.js`

## 4. Backend — app.js y sesión

- [x] 4.1 Limpiar imports y rutas de contadores, company-internal-users y asignación contador en empresas
- [x] 4.2 Quitar `accountantAssignedCompaniesLoader`, `defaultCompanyContextResolver` empresa-admin, ramas `CONTADOR` en sesión enriquecida y `buildAccountantInactiveBody`
- [x] 4.3 Mover `POST /api/me/password-rotation-complete` a `meController` con lógica solo para `ADMINISTRADOR_PLATAFORMA`
- [x] 4.4 Simplificar `userSessionMetaService.js` (sin join `accountant` ni `accountantIsActive`)

## 5. Backend — libs, servicios y scripts colaterales

- [x] 5.1 Eliminar o limpiar `resolveReadableCompanyId.js` y `resolveEmployeeCompanyScope.js` si quedan sin uso
- [x] 5.2 Limpiar `companyService` / `companyController` (métodos accountants), `sessionResponses.js`, `companyScopeService`, `platformUsersAdminService`, `delete-app-user.js`
- [x] 5.3 Actualizar tests backend (`meSessionApi`, `clauseApi`, `companyTemplatesApi`, `sessionResponses`, etc.) para admin únicamente

## 6. Frontend — eliminar archivos

- [x] 6.1 Eliminar 9 páginas de contadores y usuarios internos empresa
- [x] 6.2 Eliminar `accountantsPlatformApi.js` y `useEmployeeCompanyScope.js` si huérfano

## 7. Frontend — router, auth y navegación

- [x] 7.1 Limpiar `AppRouter.jsx`: imports y rutas `/admin-global/contadores/*`, `/admin-global/usuarios-internos-empresa/*`
- [x] 7.2 Limpiar `authSlice.js`: quitar `accountant_inactive`, `enrichedAccountantIsActive`, `assignedCompanies`; actualizar tests
- [x] 7.3 Actualizar `MandatoryPasswordChangePage` para usar API en cliente genérico (p. ej. `enrichedSessionApi`)
- [x] 7.4 Limpiar `platformPaths.js`, `sidebarIconography.jsx`, `navigationConfig.test.js`, páginas que condicionan por perfil removido

## 8. Keycloak

- [x] 8.1 Actualizar `infra/keycloak/import/incrementa-realm.json`: quitar roles y usuarios de prueba `contador@` / `empresa@`

## 9. Limpieza y verificación

- [x] 9.1 Grep en `backend/` y `frontend/src/` (excl. migraciones históricas) por `CONTADOR`, `USUARIO_EMPRESA_ADMINISTRADOR`, `accountant`, `internalCompanyUser`, `company_internal_user`; limpiar residuos
- [x] 9.2 Verificar `GET /api/me/session` admin → solo `ADMINISTRADOR_PLATAFORMA`; `GET /api/platform/accountants` → 404
- [x] 9.3 `npm test` backend y frontend; `npm run build` frontend sin errores de import
