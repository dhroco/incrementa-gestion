## Why

El frontend autentica hoy con un formulario email/contraseña que usa el grant ROPC contra `/api/auth/login`, gestionando tokens manualmente en Redux y localStorage. El backend ya valida tokens de Microsoft Entra ID y vincula al usuario interno por email (etapa 5.2 completada). Se necesita alinear el login del frontend con Entra ID usando MSAL (Authorization Code + PKCE) para eliminar credenciales en la app, delegar la gestión de contraseñas a Microsoft y obtener access tokens con la audiencia correcta para la API.

## What Changes

- Instalar `@azure/msal-browser` y `@azure/msal-react`.
- Configuración MSAL (`msalConfig.js`) con client ID, authority, redirect URI y scope de API (`api://<clientId>/access_as_user`), leyendo de `import.meta.env` con defaults para desarrollo local.
- Instancia singleton `PublicClientApplication` exportada desde `src/auth/msalInstance.js`, envuelta con `<MsalProvider>`.
- Flujo de redirección: `loginRedirect`, `handleRedirectPromise()` al arranque, `acquireTokenSilent` con fallback a `acquireTokenRedirect` en `InteractionRequiredAuthError`.
- `LoginPage.jsx`: un único botón "Continuar con Microsoft"; se eliminan campos email/contraseña y enlaces de recuperación de contraseña del flujo de login.
- `apiClient.js`: obtener access token desde MSAL en lugar de Redux; en **401**, reintentar `acquireTokenSilent` o redirigir a interacción MSAL.
- `authSlice.js`: eliminar `signInWithPasswordThunk`, `refreshSessionThunk`, `initAuthThunk` y persistencia manual de tokens; conservar `fetchEnrichedSessionThunk` y datos enriquecidos; reescribir `signOutThunk` con `logoutRedirect`.
- Rutas y guards: autenticación basada en cuenta MSAL (`useIsAuthenticated` / cuenta activa); `AuthInitializer` procesa redirect y dispara sesión enriquecida.
- Actualizar o reemplazar tests del frontend que asumen login ROPC o tokens en Redux.

**BREAKING (comportamiento de login):** el formulario email/contraseña deja de funcionar; los usuarios deben autenticarse vía Microsoft Entra ID.

**Sin cambios en esta etapa:**

- Backend (validación OIDC, `/api/me/session`, rutas `/api/auth/*`).
- Archivos legacy (`ForgotPasswordPage`, `ResetPasswordPage`, `tokenStorage.js`, `oidcAuthService`) — limpieza en etapa 5.5.
- Contrato de `GET /api/me/session`.

## Capabilities

### New Capabilities

- `frontend-msal-entra-login`: Autenticación de usuario con Microsoft Entra ID vía MSAL (Auth Code + PKCE), singleton MSAL, configuración por entorno, login/logout por redirección y obtención de access token para la API.

### Modified Capabilities

- `frontend-backend-auth-session`: Reemplazar ROPC, persistencia manual de tokens y thunks de refresh/init por MSAL como fuente de access token; autenticación determinada por cuenta MSAL; sesión enriquecida sin cambios de contrato; ajuste de guards, `apiClient`, `SessionKeepAlive` y tests.

## Impact

- **Frontend**: `App.jsx`, `src/auth/` (nuevo `msalInstance.js`, `msalConfig.js`, reescritura de `AuthInitializer`), `LoginPage.jsx`, `apiClient.js`, `authSlice.js`, `RequireAuth.jsx`, `GuestOnlyRoute.jsx`, `PrivateAppGate.jsx`, `SessionKeepAlive.jsx`, tests en `authSlice.test.js`, `apiClient.test.js` y relacionados.
- **Dependencias**: `@azure/msal-browser`, `@azure/msal-react`.
- **Variables de entorno Vite**: `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_AUTHORITY`, `VITE_AZURE_API_SCOPE` (defaults para local documentados en design).
- **Azure AD**: `redirectUri` debe coincidir exactamente con el registrado (`http://localhost:5173` en dev).
- **Fuera de alcance**: backend, eliminación de rutas/páginas ROPC legacy, configuración Entra en `dev`/`prod` más allá de variables de entorno.

## Consideraciones de seguridad

- Pedir **siempre** el scope de la API propia (`api://<clientId>/access_as_user`), nunca scopes de Microsoft Graph; de lo contrario el `aud` del token no coincide con la API y el backend responde **401**.
- Tokens MSAL en `localStorage` (`cacheLocation: localStorage`) — coherente con persistencia actual; el access token no se almacena en Redux.
- PKCE en flujo de redirección (no popup) reduce riesgo de interceptación en ventanas emergentes.
- Logout debe invocar `logoutRedirect` de MSAL además de limpiar estado Redux/CASL para invalidar la sesión en Entra.
- Mensajes de error al usuario en español (es-CL); no exponer detalles técnicos de MSAL en la UI.
