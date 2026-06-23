## Context

El backend ya valida JWTs OIDC con `requireOidcAuth` y expone `OIDC_ISSUER_URL` / `OIDC_AUDIENCE`. Keycloak local (realm `incrementa`) emite tokens vía cliente confidential `incrementa-backend` con Direct Access Grants. El frontend aún no integra login real; este cambio añade la **API de sesión** en el backend como proxy hacia Keycloak, sin que el navegador hable con el IdP ni vea el `client_secret`.

## Goals / Non-Goals

**Goals:**

- `POST /api/auth/login`, `/refresh`, `/logout` con contratos HTTP definidos.
- Servicio `oidcAuthService` + `authController` + rutas en `app.js`.
- Config `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` y URLs derivadas de `OIDC_ISSUER_URL`.
- `fetch` nativo, `application/x-www-form-urlencoded`, sin nuevas dependencias.
- Errores: 400 validación, 401 credenciales/token inválido, 503 fallo de red/IdP.

**Non-Goals:**

- Cambios en `frontend/`, `requireOidcAuth.js`, `/api/me/session`.
- Persistir tokens o sesiones en PostgreSQL.
- Exponer `client_secret` al cliente.
- Authorization Code / PKCE (cambio futuro para prod).

## Decisions

### 1. Capas

| Capa | Responsabilidad |
|------|-----------------|
| `oidcAuthService.js` | `loginWithPassword`, `refreshTokens`, `logoutSession` — POST a Keycloak, parseo JSON, errores tipados |
| `authController.js` | Validar body, mapear HTTP status, mensajes es-CL |
| `app.js` | Registrar rutas tras `express.json()` y antes de `/api/me/*` |

Factory `createAuthController({ oidcAuthService })` para tests, alineado a otros controllers.

### 2. URLs Keycloak

Desde `OIDC_ISSUER_URL` (sin barra final):

```
tokenUrl  = {issuer}/protocol/openid-connect/token
logoutUrl = {issuer}/protocol/openid-connect/logout
```

Helper `buildOidcUrls(issuerUrl)` en el servicio o util compartida.

### 3. Form bodies hacia Keycloak

| Operación | grant_type | Campos |
|-----------|------------|--------|
| Login | `password` | `client_id`, `client_secret`, `username` (= email del body), `password` |
| Refresh | `refresh_token` | `client_id`, `client_secret`, `refresh_token` |
| Logout | — | `client_id`, `client_secret`, `refresh_token` (POST logout endpoint) |

### 4. Respuestas al cliente

Éxito login/refresh: JSON plano en raíz (convención OAuth), **sin** envolver en `sendOk().data`:

```json
{ "access_token", "refresh_token", "expires_in", "token_type" }
```

Solo los cuatro campos anteriores (ignorar campos extra de Keycloak como `scope` en la respuesta al cliente).

Logout éxito: `{ "ok": true }`.

Errores: `sendError` existente (`error.code`, `error.message` en español).

### 5. Mapeo de errores

| Condición | HTTP | Código sugerido |
|-----------|------|-----------------|
| Body incompleto | 400 | `AUTH_VALIDATION_ERROR` |
| Keycloak 401 (login/refresh) | 401 | `AUTH_INVALID_CREDENTIALS` / `AUTH_INVALID_REFRESH_TOKEN` |
| Keycloak 4xx otro | 401 o 400 según caso | genérico |
| `fetch` falla (red, timeout) | 503 | `AUTH_IDP_UNAVAILABLE` |
| Falta `OIDC_ISSUER_URL` o secret en servidor | 500 | `AUTH_SERVER_MISCONFIG` |

Login 401: mensaje genérico (“Credenciales inválidas”), sin cuerpo de error de Keycloak.

### 6. Rutas y auth middleware

En `app.js`, inmediatamente después de `/health` y `/`:

```javascript
app.post('/api/auth/login', authController.postLogin)
app.post('/api/auth/refresh', authController.postRefresh)
app.post('/api/auth/logout', requireAuth, authController.postLogout)
```

`login` y `refresh` **sin** `requireAuth`. `logout` **con** `requireAuth` (Bearer access token) más `refresh_token` en body para revocación en Keycloak.

### 7. Configuración

| Variable | Default local | Uso |
|----------|---------------|-----|
| `OIDC_CLIENT_ID` | `incrementa-backend` | ROPC / refresh / logout |
| `OIDC_CLIENT_SECRET` | _(env, sin default en prod)_ | solo servidor |

`SET_VARS_AMBIENTE_LOCAL.cmd`: `OIDC_CLIENT_SECRET=dev-incrementa-backend-secret`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| ROPC inseguro en producción | Solo dev/local documentado; Entra usará otro flujo después |
| Respuesta plana vs `sendOk` en resto de API | Limitado a `/api/auth/*`; documentar en OpenAPI/README interno |
| Keycloak down | 503 claro al frontend |
| Email vs username en Keycloak | Usar campo `username` de ROPC con valor del `email` del body |

## Migration Plan

1. Añadir config y servicio.
2. Controller + rutas.
3. Probar con Keycloak local y usuarios de prueba.
4. Frontend en cambio posterior consumirá estos endpoints.

**Rollback**: quitar rutas y archivos nuevos; sin migración de BD.

## Open Questions

- ¿Incluir `id_token` en respuesta login? **No** en este change (solo los cuatro campos solicitados).
- Rate limiting en login: fuera de alcance.
