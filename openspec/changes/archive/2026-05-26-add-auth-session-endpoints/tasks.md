## 1. Configuración

- [x] 1.1 Agregar `OIDC_CLIENT_ID` (default `incrementa-backend`) y `OIDC_CLIENT_SECRET` en `backend/config.js` para `local`, `dev` y `prod`
- [x] 1.2 Actualizar `backend/SET_VARS_AMBIENTE_LOCAL.cmd` con `OIDC_CLIENT_ID` y `OIDC_CLIENT_SECRET=dev-incrementa-backend-secret` (echo de verificación)

## 2. Servicio OIDC (Keycloak proxy)

- [x] 2.1 Crear `backend/services/oidcAuthService.js` con helpers de URL (`token`, `logout`) desde `OIDC_ISSUER_URL`
- [x] 2.2 Implementar `loginWithPassword(email, password)` — ROPC vía `fetch` + `application/x-www-form-urlencoded`
- [x] 2.3 Implementar `refreshTokens(refreshToken)` y `logoutSession(refreshToken)`
- [x] 2.4 Mapear respuestas Keycloak a `{ access_token, refresh_token, expires_in, token_type }`; distinguir error 401 vs fallo de red (503)

## 3. Controller y rutas

- [x] 3.1 Crear `backend/controllers/authController.js` (`createAuthController`) con validación de body y handlers login/refresh/logout
- [x] 3.2 Registrar en `backend/app.js` (tras health/root, antes de `/api/me/*`): `POST /api/auth/login`, `/refresh` sin auth; `POST /api/auth/logout` con `requireAuth`
- [x] 3.3 Respuestas 200 planas OAuth en login/refresh; `{ ok: true }` en logout; errores con `sendError` en español (400/401/503)

## 4. Verificación manual

- [x] 4.1 `POST /api/auth/login` credenciales válidas → 200 con `access_token`
- [x] 4.2 `POST /api/auth/login` credenciales inválidas → 401
- [x] 4.3 `POST /api/auth/login` sin body → 400
- [x] 4.4 `POST /api/auth/refresh` con refresh válido → 200 con nuevo `access_token`
- [x] 4.5 `POST /api/auth/logout` con Bearer + `refresh_token` → 200 `{ ok: true }`
