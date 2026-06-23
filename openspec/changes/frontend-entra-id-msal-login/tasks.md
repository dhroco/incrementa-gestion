## 1. Dependencias y configuración MSAL

- [x] 1.1 Instalar `@azure/msal-browser` y `@azure/msal-react` en `frontend/package.json`
- [x] 1.2 Crear `frontend/src/config/msalConfig.js` con `msalConfig`, `API_SCOPE` y defaults Entra para dev local (`VITE_AZURE_CLIENT_ID`, `VITE_AZURE_AUTHORITY`, `VITE_AZURE_API_SCOPE`)
- [x] 1.3 Crear `frontend/src/auth/msalInstance.js` exportando singleton `PublicClientApplication`
- [x] 1.4 Crear `frontend/src/auth/msalToken.js` con `acquireApiAccessToken()` (silent + fallback redirect en `InteractionRequiredAuthError`)

## 2. Bootstrap de aplicación y providers

- [x] 2.1 Envolver la app en `<MsalProvider instance={msalInstance}>` en `App.jsx` (dentro de Redux `Provider`)
- [x] 2.2 Reescribir `AuthInitializer.jsx`: await `handleRedirectPromise()`, `setActiveAccount`, dispatch `fetchEnrichedSessionThunk` si hay cuenta, marcar `initialized`
- [x] 2.3 Mostrar `AuthLoadingScreen` mientras MSAL bootstrap no haya completado (antes de evaluar rutas)

## 3. Login UI

- [x] 3.1 Reescribir `LoginPage.jsx`: quitar campos email/contraseña y enlaces forgot/reset; botón "Continuar con Microsoft" con clase `.btn` que llama `loginRedirect({ scopes: [API_SCOPE] })`
- [x] 3.2 Mantener shell visual existente (logo, fondo, card); mensajes de error en español (es-CL) si aplica

## 4. Redux authSlice

- [x] 4.1 Eliminar `signInWithPasswordThunk`, `refreshSessionThunk`, `initAuthThunk` y uso de `tokenStorage` / `buildSessionFromTokenResponse` para login
- [x] 4.2 Refactorizar `fetchEnrichedSessionThunk` para obtener token vía `acquireApiAccessToken()` en lugar de `session.accessToken`
- [x] 4.3 Reescribir `signOutThunk`: `logoutRedirect` + `ability.update([])` + limpiar estado enriquecido; sin llamada a `/api/auth/logout`
- [x] 4.4 Ajustar reducers/estado: Redux conserva solo datos enriquecidos; quitar dependencia de `session` como fuente de autenticación
- [x] 4.5 Actualizar o eliminar selectores/thunks obsoletos (`selectSignInSubmitting`, `signInWithPassword` reducers, etc.) según uso restante

## 5. apiClient y token en requests

- [x] 5.1 Reemplazar `resolveAccessToken` en `apiClient.js` por llamada a `acquireApiAccessToken()`
- [x] 5.2 Reemplazar `handleUnauthorized`: en **401**, reintentar `acquireApiAccessToken()`; si `InteractionRequiredAuthError`, `acquireTokenRedirect`; si falla, `signOutThunk`
- [x] 5.3 Verificar que todos los helpers HTTP (`apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`) usen el nuevo flujo

## 6. Routing y guards

- [x] 6.1 Actualizar `RequireAuth.jsx`: autenticación vía MSAL (`useIsAuthenticated` o hook equivalente) + `initialized`; quitar `<SessionKeepAlive />`
- [x] 6.2 Actualizar `GuestOnlyRoute.jsx`: redirigir si MSAL autenticado (conservar lógica enrichment)
- [x] 6.3 Actualizar `PrivateAppGate.jsx`: gate por cuenta MSAL + enrichment; quitar check de `selectSession`
- [x] 6.4 Revisar otros consumidores de `selectIsAuthenticated` / `selectSession` y alinearlos con MSAL

## 7. Tests

- [x] 7.1 Actualizar `frontend/src/api/apiClient.test.js`: mock de `acquireApiAccessToken` y flujo 401/redirect
- [x] 7.2 Actualizar `frontend/src/store/authSlice.test.js`: eliminar tests ROPC/refresh/init; cubrir `fetchEnrichedSessionThunk` con token MSAL mockeado y `signOutThunk`
- [x] 7.3 Añadir tests unitarios para `msalToken.js` (silent ok, interaction required)
- [x] 7.4 Ejecutar `npm test` en frontend y corregir fallos relacionados

## 8. Verificación manual

- [ ] 8.1 Abrir `http://localhost:5173` → botón "Continuar con Microsoft" → login Microsoft (`dvd.roco@gmail.com`)
- [ ] 8.2 Confirmar retorno autenticado, `GET /api/me/session` con Bearer válido, perfil y permisos CASL cargados
- [ ] 8.3 Confirmar navegación visible según rol y logout redirige a Microsoft + vuelve a login
- [ ] 8.4 Confirmar que no se solicitan scopes de Graph (revisar Network/token `aud` si hay dudas)
