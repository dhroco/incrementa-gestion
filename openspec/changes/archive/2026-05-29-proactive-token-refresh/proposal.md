## Why

El frontend solo renueva el access token de forma reactiva cuando `apiClient` recibe un **401**. Si el token expira mientras el usuario trabaja, la primera petición falla con "Token no válido", no se reintenta automáticamente y la acción del usuario se pierde. Se necesita refresh proactivo antes de la expiración para mantener la sesión válida sin interrumpir el flujo de trabajo.

## What Changes

- Crear `frontend/src/auth/SessionKeepAlive.jsx`: componente React que programa `refreshSessionThunk` 60 segundos antes de `session.expiresAt`.
- Montar `SessionKeepAlive` dentro del gate de rutas autenticadas (`RequireAuth.jsx`) para que esté activo durante toda la sesión.
- Verificar (sin cambio de código) que Keycloak tenga Access Token Lifespan ≥ 5 minutos para evitar loops de refresh en desarrollo.
- **Sin cambios** en `apiClient.js`, `handleUnauthorized`, `authSlice.js` ni `refreshSessionThunk` — el refresh reactivo sigue como red de seguridad.

## Capabilities

### New Capabilities

_(ninguna — el comportamiento se extiende sobre la capacidad de sesión existente)_

### Modified Capabilities

- `frontend-backend-auth-session`: agregar refresh proactivo del access token mediante `SessionKeepAlive` antes de la expiración, complementando el refresh reactivo existente en `apiClient`.

## Impact

- **Frontend**: nuevo archivo `SessionKeepAlive.jsx`; modificación mínima en `RequireAuth.jsx` (o gate equivalente) para montar el componente.
- **Redux**: lectura de `selectSession` / `session.expiresAt` — sin cambios al slice.
- **Backend / API**: sin cambios.
- **Keycloak**: verificación manual de Access Token Lifespan en Realm Settings → Tokens.
- **Seguridad**: el refresh proactivo usa el mismo `refreshSessionThunk` y endpoint `/api/auth/refresh`; no expone credenciales adicionales. Si el refresh proactivo falla, `handleUnauthorized` en `apiClient` continúa manejando **401** como hoy.
