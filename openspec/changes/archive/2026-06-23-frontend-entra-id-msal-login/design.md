## Context

El frontend autentica hoy con ROPC: `LoginPage` envía email/contraseña a `POST /api/auth/login`, `authSlice` persiste `accessToken`, `refreshToken` y `expiresAt` en Redux y localStorage (`incrementa.*`), y `apiClient` lee el token desde Redux. `initAuthThunk` restaura tokens al arranque; `refreshSessionThunk` renueva vía `/api/auth/refresh`; `SessionKeepAlive` programa refresh proactivo 60 s antes de `expiresAt`.

El backend (etapa 5.2) ya valida JWT de Microsoft Entra ID, resuelve identidad interna por email y expone `GET /api/me/session` sin cambios de contrato. El frontend debe obtener tokens Entra con audiencia de la API propia y dejar de usar ROPC.

Estado actual relevante:

- `App.jsx`: `Provider` + `RouterProvider`; sin MSAL.
- `AuthInitializer.jsx`: despacha `initAuthThunk()` en `useEffect`.
- `RequireAuth` / `GuestOnlyRoute`: usan `selectIsAuthenticated` (basado en `state.auth.session`).
- `PrivateAppGate`: gatea por `selectSession` y `enrichmentStatus`.
- `fetchEnrichedSessionThunk`: requiere `session.accessToken` en Redux; hidrata CASL y perfil.
- Tests: `authSlice.test.js`, `apiClient.test.js` mockean ROPC y tokens manuales.

## Goals / Non-Goals

**Goals:**

- Login con Microsoft Entra ID vía MSAL (Authorization Code + PKCE, flujo redirect).
- Singleton `PublicClientApplication` accesible fuera del árbol React (`apiClient.js`).
- Access token de API (`api://<clientId>/access_as_user`) en header `Authorization: Bearer`.
- Conservar `fetchEnrichedSessionThunk` y contrato de `/api/me/session` para perfil, permisos CASL y datos de usuario.
- Guards y logout alineados con cuenta MSAL activa.
- UI de login con botón único "Continuar con Microsoft", manteniendo branding actual.

**Non-Goals:**

- Cambios en backend, rutas `/api/auth/*`, ni contrato de `/api/me/session`.
- Eliminar `ForgotPasswordPage`, `ResetPasswordPage`, `tokenStorage.js`, `oidcAuthService` (etapa 5.5).
- Popup login (solo redirect).
- Scopes de Microsoft Graph.
- Configuración Entra en Azure para `dev`/`prod` (solo variables Vite en esos entornos).

## Decisions

### 1. Librerías y estructura de módulos

- **Elección**: `@azure/msal-browser` + `@azure/msal-react`.
- **Archivos nuevos**:
  - `frontend/src/config/msalConfig.js` — configuración MSAL.
  - `frontend/src/auth/msalInstance.js` — singleton `PublicClientApplication`.
  - `frontend/src/auth/msalToken.js` — helper `acquireApiAccessToken()` reutilizable por `apiClient` y `fetchEnrichedSessionThunk`.
- **Rationale**: `apiClient` vive fuera de React; el singleton evita depender de hooks MSAL en cada request.

### 2. Configuración MSAL (`msalConfig.js`)

```javascript
const clientId = import.meta.env.VITE_AZURE_CLIENT_ID ?? 'dc734f4a-5f25-4e88-b728-aab4715f2122'
const authority = import.meta.env.VITE_AZURE_AUTHORITY ?? 'https://login.microsoftonline.com/60322b4a-13bf-4f19-89ae-efe4a54ffed6'
export const API_SCOPE = import.meta.env.VITE_AZURE_API_SCOPE ?? `api://${clientId}/access_as_user`

export const msalConfig = {
  auth: {
    clientId,
    authority,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin
  },
  cache: { cacheLocation: 'localStorage' }
}
```

- **Rationale**: Defaults documentados para dev local; `redirectUri` dinámico por origen coincide con `http://localhost:5173` en Vite.
- **Alternativa descartada**: Hardcodear `http://localhost:5173` — rompe preview/build en otros hosts.

### 3. Flujo redirect (no popup)

```
App mount → MsalProvider
AuthInitializer (blocking):
  1. await msalInstance.handleRedirectPromise()
  2. if response?.account → setActiveAccount(account)
  3. else if accounts.length → setActiveAccount(accounts[0])
  4. if active account → dispatch fetchEnrichedSessionThunk
  5. set initialized = true

LoginPage → loginRedirect({ scopes: [API_SCOPE] })

apiClient / fetchEnrichedSession:
  acquireTokenSilent({ scopes: [API_SCOPE], account })
  catch InteractionRequiredAuthError → acquireTokenRedirect({ scopes: [API_SCOPE], account })

signOut → logoutRedirect({ postLogoutRedirectUri }) + clear Redux/CASL
```

- **Rationale**: Redirect es más robusto que popup (bloqueadores, SSO corporativo).
- **Crítico**: `handleRedirectPromise()` debe completarse antes de evaluar rutas autenticadas.

### 4. Obtención de token compartida (`msalToken.js`)

```javascript
export async function acquireApiAccessToken() {
  const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0]
  if (!account) return null
  try {
    const result = await msalInstance.acquireTokenSilent({ scopes: [API_SCOPE], account })
    return result.accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect({ scopes: [API_SCOPE], account })
      return null // redirect in progress
    }
    throw err
  }
}
```

- **Rationale**: Un solo punto para scope correcto y manejo de `InteractionRequiredAuthError`.
- **`apiClient` en 401**: reintentar `acquireApiAccessToken()` una vez; si sigue fallando o requiere interacción → `signOutThunk` o redirect según contexto.

### 5. Redux / authSlice

- **Eliminar**: `signInWithPasswordThunk`, `refreshSessionThunk`, `initAuthThunk`, uso de `tokenStorage`, campos `session.accessToken/refreshToken/expiresAt` como fuente de verdad.
- **Conservar**: estado enriquecido, selectores de perfil, `fetchEnrichedSessionThunk`, `updateProfileData`, `invalidateSessionThunk` (wrapper de sign-out).
- **Cambiar `fetchEnrichedSessionThunk`**: obtener token vía `acquireApiAccessToken()` en lugar de `getState().auth.session.accessToken`.
- **Cambiar `signOutThunk`**: `msalInstance.logoutRedirect()` + `ability.update([])` + limpiar Redux enriquecido; no llamar `/api/auth/logout`.
- **`selectIsAuthenticated`**: dejar de basarse en Redux; los guards usan `useIsAuthenticated()` de `@azure/msal-react` o un hook `useMsalAuth()` que combine MSAL + `initialized`.
- **Alternativa descartada**: Mantener `session` en Redux solo para el token — duplica MSAL cache y reintroduce desincronización.

### 6. App bootstrap y providers

```jsx
// App.jsx
<Provider store={store}>
  <MsalProvider instance={msalInstance}>
    <AbilityContext.Provider value={ability}>
      <RouterProvider router={router} />
    </AbilityContext.Provider>
  </MsalProvider>
</Provider>
```

- **`AuthInitializer`**: componente que bloquea con `AuthLoadingScreen` hasta `handleRedirectPromise` + `initialized`; reemplaza `initAuthThunk`.
- **`MsalInitializer` opcional**: si MSAL requiere `await msalInstance.initialize()` antes de redirect handling, llamarlo en el mismo bootstrap.

### 7. Routing y guards

| Componente | Cambio |
|---|---|
| `RequireAuth` | `useIsAuthenticated()` + `initialized`; quitar `SessionKeepAlive` (MSAL renueva tokens on-demand) |
| `GuestOnlyRoute` | Redirigir si MSAL autenticado (misma lógica enrichment post-login) |
| `PrivateAppGate` | Gate por MSAL autenticado + enrichment; quitar check `selectSession` |
| `LoginPage` | Botón `.btn` "Continuar con Microsoft" → `loginRedirect`; sin campos password ni links forgot/reset |

### 8. SessionKeepAlive

- **Elección**: Eliminar montaje de `SessionKeepAlive` en `RequireAuth`; el componente puede quedar como no-op o eliminarse en implementación si no tiene otros usos.
- **Rationale**: MSAL renueva access tokens vía `acquireTokenSilent` en cada request o ante 401; no hay `expiresAt` en Redux que programar.

### 9. Login UI

- Mantener `login-page` shell (logo, fondo, card).
- Botón primario con clase `.btn` existente: "Continuar con Microsoft".
- Sin selector de perfil/rol (regla corporativa).
- Mensajes de error en español (es-CL) para fallos de redirect o sesión enriquecida.

### 10. Tests

- Mockear `@azure/msal-browser` / instancia singleton en `apiClient.test.js` y `authSlice.test.js`.
- Eliminar tests de ROPC (`signInWithPassword`, `refreshSession`, `initAuth` con localStorage).
- Añadir tests de `acquireApiAccessToken` (silent ok, interaction required → redirect).
- Actualizar tests de guards si mockean `selectIsAuthenticated`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| Scope Graph en lugar de API → 401 en backend | Constante `API_SCOPE` centralizada; code review; documentar en spec |
| `redirectUri` no coincide con Azure | Usar `window.location.origin`; verificar registro en portal Azure |
| `handleRedirectPromise` tardío pierde login | Bloquear render de rutas hasta resolver en `AuthInitializer` |
| Sin cuenta activa tras redirect | `setActiveAccount` explícito tras login y al restaurar cache |
| `acquireTokenRedirect` interrumpe flujo API | No reintentar request original; usuario vuelve tras redirect |
| Tokens en localStorage (XSS) | Mismo trade-off que hoy; CSP y sanitización fuera de alcance |
| Tests frágiles con MSAL | Mock de singleton; no llamar red real en unit tests |

## Migration Plan

1. Instalar dependencias MSAL.
2. Añadir `msalConfig`, `msalInstance`, `msalToken`.
3. Envolver app con `MsalProvider`; reescribir `AuthInitializer`.
4. Actualizar `LoginPage`, guards, `PrivateAppGate`.
5. Refactorizar `apiClient` y `authSlice` (eliminar ROPC thunks).
6. Actualizar tests; ejecutar `npm test` en frontend.
7. Verificación manual: login con `dvd.roco@gmail.com` → sesión enriquecida → navegación por rol.

**Rollback**: Revertir commit frontend; backend no cambia. Usuarios volverían a ROPC si se restaura código anterior.

## Open Questions

- ¿Eliminar archivo `SessionKeepAlive.jsx` en esta etapa o dejarlo sin montar hasta 5.5? **Recomendación**: dejar de montarlo; eliminar en limpieza 5.5.
- ¿`fetchEnrichedSessionThunk` debe aceptar token opcional por parámetro para tests? **Recomendación**: inyectar/mock `acquireApiAccessToken` en tests.
