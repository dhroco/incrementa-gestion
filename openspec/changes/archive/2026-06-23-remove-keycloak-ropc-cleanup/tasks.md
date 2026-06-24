## 1. Backend — rutas y servicios ROPC

- [x] 1.1 Grep en `backend/` referencias a `oidcAuthService`, `authController`, `/api/auth/login|refresh|logout`
- [x] 1.2 Quitar registro de rutas y `createAuthController` en `backend/app.js`
- [x] 1.3 Eliminar `backend/controllers/authController.js` y `backend/services/oidcAuthService.js`
- [x] 1.4 Eliminar o actualizar tests que cubran ROPC / auth session endpoints (`backend/test/`)

## 2. Backend — Keycloak admin y script ops

- [x] 2.1 Grep referencias a `keycloakAdminClient` y `KEYCLOAK_` en código ejecutable
- [x] 2.2 Eliminar `backend/lib/keycloakAdminClient.js` y `backend/test/keycloakAdminClient.test.js`
- [x] 2.3 Simplificar `backend/scripts/delete-app-user.js`: solo borrado de `user_profile` en DB; resolver por email vía `user_profile.email` (sin lookup Keycloak); actualizar mensajes a Entra
- [x] 2.4 Quitar imports muertos de Keycloak en cualquier otro módulo (p. ej. `platformUsersAdminService` si quedaran)

## 3. Backend — configuración

- [x] 3.1 En `backend/config.js`, eliminar `KEYCLOAK_ADMIN_URL`, `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_REALM`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` de todos los ambientes
- [x] 3.2 Verificar que `OIDC_ISSUER_URL`, `OIDC_AUDIENCE` y `GRAPH_*` permanecen intactos
- [x] 3.3 Grep mensajes de error en backend que mencionen "Keycloak" y actualizarlos a "Microsoft Entra" donde aplique

## 4. Frontend — páginas y rutas legacy

- [x] 4.1 Eliminar rutas `/forgot-password` y `/reset-password` de `frontend/src/routes/AppRouter.jsx`
- [x] 4.2 Eliminar `frontend/src/pages/ForgotPasswordPage.jsx` y `ResetPasswordPage.jsx`
- [x] 4.3 Eliminar `frontend/src/auth/SessionKeepAlive.jsx` (ROPC muerto; no montado)
- [x] 4.4 Grep y eliminar `frontend/src/auth/tokenStorage.js` y `jwtUtils.js` si cero referencias
- [x] 4.5 Actualizar comentario en `StandardTemplateEditor.jsx` que mencione SessionKeepAlive si queda obsoleto

## 5. Frontend — auth slice y UI plataforma

- [x] 5.1 Grep en `frontend/src/store/authSlice.js` y tests restos ROPC (`signInWithPasswordThunk`, `refreshSessionThunk`, `initAuthThunk`, `selectSession`, `tokenStorage`)
- [x] 5.2 Limpiar exports/selectors muertos y actualizar `authSlice.test.js` / `invalidateSessionThunk.test.js` si referencian ROPC
- [ ] 5.3 ~~En `PlatformUserEditPage.jsx`, mostrar email como solo lectura~~ — **Diferido** (change 5.5); backend ya ignora email en PATCH

## 6. Infraestructura

- [x] 6.1 Eliminar directorio `infra/keycloak/` completo (README, import, scripts, `.env.example`)
- [x] 6.2 Grep en repo (excl. `openspec/changes/archive`) referencias a `infra/keycloak` y limpiar enlaces rotos en docs activos si existen

## 7. Verificación

- [x] 7.1 `npm test` en `backend/` — todos en verde
- [x] 7.2 `npm run build` en `frontend/` — sin errores
- [x] 7.3 `npm test` en `frontend/` — todos en verde
- [x] 7.4 Grep final: sin `keycloakAdminClient`, `oidcAuthService`, `/api/auth/login` en código activo; sin `KEYCLOAK_` en `config.js`
- [ ] 7.5 Smoke manual (usuario): (a) login con Microsoft funciona, (b) alta usuario plataforma valida Graph (422/409)
