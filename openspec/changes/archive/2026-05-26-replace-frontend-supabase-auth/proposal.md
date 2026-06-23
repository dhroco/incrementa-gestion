## Why

El frontend aún depende de Supabase Auth (`supabaseClient.js`, `authSlice`, páginas de recuperación de contraseña) mientras el backend ya expone sesión OIDC vía Keycloak (`POST /api/auth/login`, `refresh`, `logout` y `GET /api/me/session`). Mantener dos proveedores de identidad impide completar la migración, expone configuración obsoleta y rompe la coherencia con el middleware OIDC del backend. Este cambio unifica la autenticación del cliente en llamadas directas al backend.

## What Changes

- **Frontend — auth state**: Reescribir `authSlice.js` para usar tokens del backend (localStorage + Redux) en lugar de Supabase; mantener la misma forma del state y selectores.
- **Frontend — HTTP client**: Actualizar `apiClient.js` para leer el token desde Redux; en 401 intentar `refreshSessionThunk` y, si falla, `signOutThunk` (sin reintento del request original).
- **Frontend — bootstrap**: Simplificar `AuthInitializer.jsx` a un único `dispatch(initAuthThunk())`.
- **Frontend — eliminación**: Quitar `src/auth/supabaseClient.js` y referencias; limpiar `supabaseUrl` / `supabaseAnonKey` en config.
- **Frontend — páginas**: `ForgotPasswordPage` y `ResetPasswordPage` muestran mensaje estático de contacto al administrador (sin Supabase ni endpoints externos).
- **Frontend — cambio obligatorio**: `MandatoryPasswordChangePage` usa `PUT /api/me/password` vía `apiPost`.
- **Backend — nuevo endpoint**: `PUT /api/me/password` con `requireOidcAuth`, validación de `newPassword` (mín. 8 caracteres) y `keycloakAdminClient.resetUserPassword`.
- **Backend — admin client**: Nuevo método `resetUserPassword(userId, newPassword)` en `keycloakAdminClient.js`.
- **Tests**: Actualizar tests de `authSlice`, `apiClient` e `invalidateSessionThunk` según el nuevo flujo.
- **BREAKING**: Recuperación de contraseña por email deja de estar disponible en el frontend hasta que Keycloak/IdP lo soporte en producción.

## Capabilities

### New Capabilities

- `frontend-backend-auth-session`: Sesión del cliente basada en tokens del backend (login, refresh, logout, persistencia en localStorage, enriched session).
- `backend-me-password`: Endpoint autenticado para que el usuario cambie su propia contraseña en Keycloak.

### Modified Capabilities

- `backend-keycloak-admin-client`: Agregar operación `resetUserPassword` para el flujo de cambio obligatorio de contraseña.

## Impact

- **Frontend**: `store/authSlice.js`, `api/apiClient.js`, `auth/AuthInitializer.jsx`, `pages/ForgotPasswordPage.jsx`, `pages/ResetPasswordPage.jsx`, `pages/MandatoryPasswordChangePage.jsx`, `config.js`; eliminar `auth/supabaseClient.js`, `auth/mapAuthErrorToSpanish.js` (o vaciar).
- **Backend**: `app.js` (ruta), controlador/handler de `/api/me/password`, `lib/keycloakAdminClient.js`.
- **Dependencias npm**: ninguna nueva; se deja de usar el cliente Supabase en el frontend (el paquete puede permanecer si otros módulos lo usan — verificar imports).
- **Fuera de alcance**: formulario/UI de login, `requireOidcAuth.js`, `supabaseAdminClient.js` del backend, middlewares existentes.
- **Prerequisito**: Change 3 (`backend-auth-session-endpoints`) implementado y operativo.

## Consideraciones de seguridad

- Tokens (`access_token`, `refresh_token`) solo en localStorage del navegador y Redux; nunca loguear tokens en consola.
- `PUT /api/me/password` solo permite cambiar la contraseña del usuario autenticado (`req.auth.userId`); validación mínima 8 caracteres en backend.
- Errores de Keycloak al resetear contraseña → **422** con código `AUTH_UPDATE_FAILED` y mensaje en español (es-CL), sin filtrar detalles internos.
- Logout best-effort: limpiar estado local aunque falle la revocación en Keycloak.
- Recuperación por email deshabilitada temporalmente para evitar flujos inseguros o rotos con Supabase.
