## Why

Microsoft Entra ID es ya el único IdP: login vía MSAL/OIDC, identidad interna por email y validación de usuarios de plataforma vía Microsoft Graph. El código legacy de Keycloak (cliente admin, infra local) y del flujo ROPC (login/refresh/logout con contraseña) quedó inactivo pero sigue en el repositorio, generando confusión en onboarding, variables de entorno obsoletas y riesgo de reactivar rutas no soportadas. Esta limpieza retira ese vestigio sin alterar el comportamiento visible para usuarios autenticados con Microsoft.

## What Changes

### Backend — eliminar

- `services/oidcAuthService.js` (ROPC: `loginWithPassword`, `refreshTokens`, `logoutSession`).
- `controllers/authController.js` y rutas en `app.js`: `POST /api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`.
- `lib/keycloakAdminClient.js` y su test.
- `scripts/delete-app-user.js`: simplificar a solo borrado en DB (`user_profile`) o eliminar si ya no aporta (Graph es solo lectura).
- `config.js`: eliminar `KEYCLOAK_ADMIN_*`, `KEYCLOAK_REALM`, `OIDC_CLIENT_ID` y `OIDC_CLIENT_SECRET`. Conservar `OIDC_ISSUER_URL`, `OIDC_AUDIENCE` y todas las `GRAPH_*`.

### Frontend — eliminar / limpiar

- Páginas `ForgotPasswordPage.jsx` y `ResetPasswordPage.jsx` y sus rutas.
- `auth/tokenStorage.js` y `auth/jwtUtils.js` solo si grep confirma cero referencias.
- Restos muertos en `store/authSlice.js` del flujo ROPC (`signInWithPasswordThunk`, `refreshSessionThunk`, `initAuthThunk`, helpers y selectores asociados).
- `PlatformUserEditPage.jsx`: email de solo lectura (identidad Entra, no editable).

### Infra

- Eliminar directorio `infra/keycloak/`.

### Specs y textos

- Actualizar referencias "Keycloak" → "Microsoft Entra" / "Graph" donde corresponda.
- Retirar specs de capacidades eliminadas (`backend-keycloak-admin-client`, `backend-auth-session-endpoints`).

**BREAKING (solo integraciones legacy):** desaparecen los endpoints ROPC y cualquier cliente que aún los invoque dejará de funcionar. El flujo MSAL/OIDC no cambia.

**Fuera de alcance (no tocar):**

- `middleware/requireOidcAuth.js`, `middleware/resolveInternalIdentity.js`, `lib/graphClient.js`, MSAL frontend, `AuthInitializer`, `platformUsersAdminService` salvo imports muertos.
- `SET_VARS_AMBIENTE_LOCAL.cmd` (gitignored; limpieza de vars `KEYCLOAK_*` la hace el usuario).

## Capabilities

### New Capabilities

- `remove-keycloak-ropc-cleanup`: El repositorio no contiene cliente Keycloak admin, servicio ROPC, endpoints `/api/auth/login|refresh|logout`, infra `infra/keycloak/`, ni páginas forgot/reset password; config backend sin variables `KEYCLOAK_*` ni `OIDC_CLIENT_*` de ROPC; verificación por grep, tests y build.

### Modified Capabilities

- `platform-users-admin`: Corregir redacción residual "from Keycloak" → Entra/Graph; formulario de edición con email solo lectura.
- `platform-users-idp-register-only`: Título del requisito de creación sin referencia a Keycloak (Entra/Graph únicamente).
- `frontend-backend-auth-session`: Eliminar requisitos o escenarios que mencionen thunks ROPC, `tokenStorage`, forgot/reset password o `POST /api/auth/logout`.
- `backend-me-password`: Referencias a gestión de contraseña en Keycloak → Microsoft Entra (portal/administración del tenant).
- `backend-keycloak-admin-client`: **Retirar** — capacidad eliminada del sistema.
- `backend-auth-session-endpoints`: **Retirar** — capacidad eliminada del sistema.

## Impact

- **Backend**: borrado de archivos listados, `app.js`, `config.js`, tests (`oidcAuthService`, `keycloakAdminClient`, auth session), posible simplificación de `delete-app-user.js`.
- **Frontend**: router, `authSlice`, `PlatformUserEditPage`, tests que referencien ROPC/forgot/reset.
- **API**: desaparecen `POST /api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`; el resto de la API protegida sigue igual con Bearer MSAL.
- **Infra / ops**: se elimina `infra/keycloak/`; despliegues ya no dependen de contenedor Keycloak local.
- **Prerequisitos**: changes de Entra login (MSAL), identidad por email y validación Graph completados y operativos.

## Consideraciones de seguridad

- Eliminar `OIDC_CLIENT_SECRET` y credenciales `KEYCLOAK_ADMIN_*` del código reduce superficie de secretos legacy en config versionada.
- Al retirar ROPC se evita que un flujo de contraseña en backend compita con el único camino soportado (Microsoft Entra).
- La limpieza no debe debilitar `requireOidcAuth` ni la validación JWT contra `OIDC_ISSUER_URL` / `OIDC_AUDIENCE`.
- Mensajes de error en español (es-CL) que mencionen Keycloak deben actualizarse para no inducir acciones incorrectas (p. ej. "crear en Keycloak" → "crear en Microsoft Entra").
- Verificación post-limpieza: `npm test` backend, `npm run build` + `npm test` frontend; smoke manual de login Microsoft y alta de usuario de plataforma (422/409).
