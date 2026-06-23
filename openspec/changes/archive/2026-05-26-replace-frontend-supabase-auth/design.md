## Context

El backend ya expone `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` (Change 3) y valida JWTs con `requireOidcAuth` en rutas como `GET /api/me/session`. El frontend sigue usando `@supabase/supabase-js` vía `supabaseClient.js` para login, persistencia de sesión, refresh implícito y cambio de contraseña. Eso duplica la fuente de verdad de identidad y bloquea eliminar Supabase Auth del cliente.

Estado actual relevante:

- `authSlice.js`: thunks `signInWithPasswordThunk`, `signOutThunk`, `invalidateSessionThunk`, `fetchEnrichedSessionThunk`; sesión Supabase con `access_token` en snake_case.
- `apiClient.js`: obtiene token vía `supabase.auth.getSession()`; 401 → `invalidateSessionThunk`.
- `AuthInitializer.jsx`: `getSession()` + `onAuthStateChange`.
- Decenas de componentes leen `session?.access_token`.
- `MandatoryPasswordChangePage`: `supabase.auth.updateUser({ password })`.

## Goals / Non-Goals

**Goals:**

- Una sola fuente de tokens: backend Keycloak proxy + `localStorage`.
- Mantener contrato Redux de alto nivel (`initialized`, `session`, `user`, enriched fields, selectores existentes).
- Sesión en Redux: `{ accessToken, refreshToken, expiresAt }` + `user: { id, email }` derivado del JWT o del login.
- Refresh ante 401 en `apiClient` (sin reintento del request original).
- `PUT /api/me/password` para cambio obligatorio de contraseña.
- Páginas forgot/reset con mensaje estático en español.
- Eliminar `supabaseClient.js` y referencias en auth.

**Non-Goals:**

- Cambiar UI del formulario de login.
- Nuevos paquetes npm.
- Modificar `requireOidcAuth.js` u otros middlewares.
- Tocar `supabaseAdminClient.js` del backend.
- Recuperación de contraseña por email (Keycloak local).
- Authorization Code / PKCE.
- Reintento automático del request HTTP tras refresh exitoso.

## Decisions

### 1. Forma de sesión en Redux (camelCase)

Reemplazar el objeto sesión de Supabase por:

```js
session: {
  accessToken: string,
  refreshToken: string,
  expiresAt: number  // Date.now() + expires_in * 1000 al guardar
}
user: { id: string, email: string }  // id = sub del JWT; email del login o enriched session
```

**Rationale:** Alineado con respuesta OAuth del backend (`access_token` → mapear a `accessToken` al persistir). Separar `user` evita acoplar a claims de Supabase.

**Migración:** Actualizar todos los consumidores de `session?.access_token` a `session?.accessToken` (grep en `frontend/src`). Los thunks y `fetchEnrichedSession` usan `accessToken` internamente.

### 2. Persistencia localStorage

| Clave | Valor |
|-------|--------|
| `incrementa.access_token` | access token JWT |
| `incrementa.refresh_token` | refresh token |
| `incrementa.expires_at` | timestamp ms (string numérica) |

Helpers pequeños en `authSlice.js` o `auth/tokenStorage.js` (sin nuevo paquete): `loadStoredTokens()`, `saveTokens()`, `clearStoredTokens()`.

`initAuthThunk`: si hay tokens → `sessionUpdated` + `fetchEnrichedSessionThunk`; si `/api/me/session` → 401 → `clearStoredTokens` + `sessionUpdated(null)` + `initialized: true`.

### 3. Thunks de auth

| Thunk | Comportamiento |
|-------|----------------|
| `initAuthThunk` | Restaurar desde localStorage; enriched session; marcar `initialized` |
| `signInWithPasswordThunk` | `POST /api/auth/login` con email normalizado; guardar tokens; enriched |
| `signOutThunk` | `POST /api/auth/logout` best-effort (Bearer + body `refresh_token`); limpiar storage y Redux |
| `refreshSessionThunk` | `POST /api/auth/refresh`; actualizar storage; si 401/400 → `signOutThunk` |
| `fetchEnrichedSessionThunk` | Sin cambio de lógica de negocio; usar `session.accessToken` |
| `invalidateSessionThunk` | Deprecar: reexportar o delegar a `signOutThunk` para no romper imports en tests |

Login: mapear errores 401/400 del backend a mensajes es-CL en el thunk (sin `mapAuthErrorToSpanish` de Supabase).

### 4. apiClient.js — token y 401

- Leer `store.getState().auth.session?.accessToken` en cada request (patrón actual ya importa `store`).
- En `kind === 'unauthorized'`: `await store.dispatch(refreshSessionThunk())`; si el thunk rechaza o la sesión queda null, `dispatch(signOutThunk())`.
- **No** re-dispatch del request original (KISS).

`apiPost`/`apiPut` deben enviar Bearer igual que `apiGet`.

### 5. AuthInitializer

Solo:

```jsx
useEffect(() => { dispatch(initAuthThunk()) }, [dispatch])
```

Sin suscripción Supabase. Expiración proactiva no se implementa; 401 + refresh cubre el caso operativo.

### 6. PUT /api/me/password (backend)

- Ruta: `PUT /api/me/password` junto a otras `/api/me/*` en `app.js`.
- Middleware: `requireAuth` (alias de `requireOidcAuth`).
- Body: `{ newPassword }` — requerido, mínimo 8 caracteres → 400 `AUTH_VALIDATION_ERROR`.
- Handler: `keycloakAdminClient.resetUserPassword(req.auth.userId, newPassword)`.
- Éxito: 200 `{ message: "Contraseña actualizada correctamente." }` (o `sendOk` si el proyecto envuelve; preferir mensaje plano consistente con login).
- Error Keycloak: 422 `AUTH_UPDATE_FAILED`, mensaje es-CL.

`resetUserPassword`: `PUT .../users/{userId}/reset-password` body `{ type: "password", value, temporary: false }`.

Flujo MandatoryPasswordChangePage sin cambio de orden: `PUT /api/me/password` → `POST /api/me/password-rotation-complete` → `fetchEnrichedSessionThunk({ force: true })`.

### 7. Forgot / Reset password pages

Componente compartido o copy idéntico:

> Para recuperar tu contraseña, contacta al administrador de la plataforma.

Sin links a Supabase ni llamadas API. Rutas existentes se mantienen.

### 8. Config frontend

Eliminar `supabaseUrl` y `supabaseAnonKey` de `frontend/config.js` (o dejar `null`/omitidos). Verificar que ningún import las use tras borrar `supabaseClient.js`.

### 9. mapAuthErrorToSpanish.js

Eliminar archivo o dejar export vacío si hay imports residuales; preferir eliminar y actualizar imports.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Muchos archivos usan `access_token` | Tarea explícita de grep/replace a `accessToken` en el mismo change |
| Refresh en 401 no reintenta request | UX: usuario puede repetir acción; documentado como KISS |
| ROPC + tokens en localStorage (XSS) | Mismo modelo que Supabase client; migración futura a httpOnly cookies / PKCE |
| Logout falla en red pero cliente limpia estado | Comportamiento deseado (best-effort server + always clear local) |
| Sin recovery por email | Mensaje claro en páginas placeholder |
| JWT `sub` vs email en `user` | Extraer `sub` decodificando payload base64 del access token (sin validar firma en cliente) o usar respuesta de enriched session tras login |

## Migration Plan

1. Implementar backend `resetUserPassword` + `PUT /api/me/password`.
2. Reescribir `authSlice` + token storage + actualizar consumidores `access_token`.
3. Actualizar `apiClient`, `AuthInitializer`, páginas auth.
4. Eliminar `supabaseClient.js` y config Supabase.
5. Actualizar tests (`authSlice.test.js`, `apiClient.test.js`, `invalidateSessionThunk.test.js`, tests de páginas que mockean sesión).
6. Verificación manual según criterios del change (login admin, refresh F5, logout, mustChangePassword).

**Rollback:** Revertir branch; tokens en localStorage son compatibles solo con este change (no mezclar con Supabase session keys).

## Open Questions

- ¿Eliminar dependencia `@supabase/supabase-js` de `package.json` si ningún otro módulo la importa? (Recomendado en apply si grep confirma cero imports.)
- ¿Decodificar `sub` del JWT en cliente para `user.id` o confiar solo en enriched session? (Recomendación: decodificar payload sin verificar firma solo para `sub`/`email` inmediatamente tras login.)
