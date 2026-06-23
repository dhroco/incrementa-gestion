## 1. Backend — Keycloak admin y endpoint de contraseña



- [x] 1.1 Agregar `resetUserPassword(userId, newPassword)` en `backend/lib/keycloakAdminClient.js` (`PUT .../users/{id}/reset-password`, `temporary: false`)

- [x] 1.2 Crear handler `PUT /api/me/password` (validar `newPassword` ≥ 8, `requireAuth`, llamar `resetUserPassword`, 200 con mensaje es-CL, 422 `AUTH_UPDATE_FAILED`)

- [x] 1.3 Registrar ruta en `backend/app.js` junto a otras `/api/me/*`

- [x] 1.4 Agregar test(s) de API para `PUT /api/me/password` (éxito, 400 validación, 401 sin token)



## 2. Frontend — utilidades de token y authSlice



- [x] 2.1 Implementar helpers localStorage (`incrementa.access_token`, `incrementa.refresh_token`, `incrementa.expires_at`)

- [x] 2.2 Reescribir `authSlice.js`: thunks `initAuthThunk`, `signInWithPasswordThunk`, `signOutThunk`, `refreshSessionThunk`; mapear respuesta login/refresh del backend a `{ accessToken, refreshToken, expiresAt }` y `user`

- [x] 2.3 Actualizar `fetchEnrichedSessionThunk` para usar `session.accessToken` (no `access_token`)

- [x] 2.4 Reemplazar `invalidateSessionThunk` por delegación a `signOutThunk` (mantener export si hay imports)

- [x] 2.5 Migrar todos los consumidores de `session?.access_token` a `session?.accessToken` en `frontend/src`



## 3. Frontend — HTTP client y bootstrap



- [x] 3.1 Actualizar `apiClient.js`: token desde `store.getState().auth.session?.accessToken`; 401 → `refreshSessionThunk` luego `signOutThunk` si falla; sin reintento del request

- [x] 3.2 Reescribir `AuthInitializer.jsx` (solo `dispatch(initAuthThunk())`)

- [x] 3.3 Eliminar `frontend/src/auth/supabaseClient.js` y limpiar imports

- [x] 3.4 Quitar `supabaseUrl` / `supabaseAnonKey` de `frontend/config.js` (u omitir valores)



## 4. Frontend — páginas de auth



- [x] 4.1 Simplificar `ForgotPasswordPage.jsx` y `ResetPasswordPage.jsx` (mensaje estático de contacto al administrador)

- [x] 4.2 Actualizar `MandatoryPasswordChangePage.jsx`: `apiPut('/api/me/password', { newPassword })` en lugar de Supabase; mantener flujo rotation-complete + `fetchEnrichedSessionThunk({ force: true })`

- [x] 4.3 Eliminar o vaciar `mapAuthErrorToSpanish.js` y actualizar imports



## 5. Tests y limpieza



- [x] 5.1 Actualizar `authSlice.test.js`, `apiClient.test.js`, `invalidateSessionThunk.test.js` y tests que mockean `session.access_token`

- [x] 5.2 Verificar con grep que no queden imports de `@supabase/supabase-js` en auth del frontend; remover de `package.json` si no hay otros usos

- [x] 5.3 Ejecutar suite de tests frontend/backend afectados



## 6. Verificación manual (Change 5)



- [x] 6.1 Login `admin@incrementa.la` / `Admin1234!` → redirige a `/app/dashboard` sin errores en consola

- [x] 6.2 Refresh de página → sesión persiste (tokens en localStorage)

- [x] 6.3 Network: `GET /api/me/session` con Bearer válido tras login

- [x] 6.4 Logout → tokens eliminados de localStorage, redirige a `/login`

- [x] 6.5 Usuario con `mustChangePassword: true` → `MandatoryPasswordChangePage` → cambio exitoso vía `PUT /api/me/password`

