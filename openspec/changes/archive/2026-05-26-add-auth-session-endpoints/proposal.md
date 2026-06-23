## Why

El frontend debe autenticarse contra Keycloak sin exponer el `client_secret` ni llamar directamente al IdP. Con el middleware OIDC ya validando JWTs en rutas protegidas, hace falta una capa de **sesión en el backend** que ejecute login (ROPC), refresh y logout en nombre del cliente y devuelva los tokens de forma controlada.

## What Changes

- Tres endpoints públicos/protegidos en el backend:
  - `POST /api/auth/login` — ROPC con `{ email, password }`
  - `POST /api/auth/refresh` — refresh grant con `{ refresh_token }`
  - `POST /api/auth/logout` — invalidación de refresh (requiere Bearer + `refresh_token` en body)
- Nuevo `backend/services/oidcAuthService.js` (comunicación con Keycloak vía `fetch`, `application/x-www-form-urlencoded`).
- Nuevo `backend/controllers/authController.js` (handlers HTTP, validación de body, códigos de estado).
- Registro de rutas en `backend/app.js` **antes** de rutas que exijan auth global; `login` y `refresh` sin `requireAuth`; `logout` con `requireAuth`.
- `backend/config.js` y `backend/SET_VARS_AMBIENTE_LOCAL.cmd`: `OIDC_CLIENT_ID` (default `incrementa-backend`) y `OIDC_CLIENT_SECRET`.
- URLs de Keycloak derivadas de `OIDC_ISSUER_URL` (`.../protocol/openid-connect/token` y `.../logout`).
- **Sin cambios** en frontend, `requireOidcAuth.js` ni `/api/me/session`.

## Capabilities

### New Capabilities

- `backend-auth-session-endpoints`: Proxy backend de login, refresh y logout OIDC (Keycloak ROPC/refresh/revoke), configuración de cliente confidencial, respuestas HTTP y errores (400/401/503) sin persistir tokens en servidor.

### Modified Capabilities

- _(Ninguno; `backend-oidc-auth-middleware` no cambia requisitos, solo consume los mismos tokens emitidos por Keycloak.)_

## Impact

- **Backend**: `services/oidcAuthService.js`, `controllers/authController.js`, `app.js`, `config.js`, `SET_VARS_AMBIENTE_LOCAL.cmd`.
- **API**: nueva superficie `/api/auth/*` para el futuro login del frontend.
- **Seguridad**: `client_secret` solo en servidor; tokens devueltos al cliente, no almacenados en backend.
- **Dependencias**: ninguna nueva (Node `fetch` nativo).
- **Fuera de alcance**: frontend, almacenamiento de sesión en BD, cambios en autorización por perfiles.

## Consideraciones de seguridad

- El `OIDC_CLIENT_SECRET` nunca se expone al frontend ni en respuestas de error.
- Mensajes 401 genéricos en login (sin filtrar detalles de Keycloak).
- ROPC solo aceptable en desarrollo/local; documentar que producción migrará a flujos más seguros.
- Errores de red hacia Keycloak → **503** (distinto de credenciales inválidas → **401**).
- Validación de body en backend (email/password, refresh_token) con **400** y mensajes en español (es-CL).
