## Context

El frontend almacena tokens OIDC en Redux (`session.accessToken`, `session.refreshToken`, `session.expiresAt`) y localStorage. `refreshSessionThunk` renueva tokens vía `POST /api/auth/refresh`. Hoy solo se invoca cuando `apiClient.handleUnauthorized` recibe **401** — no hay refresh antes de la expiración.

La app monta `AuthInitializer` (bootstrap desde localStorage) y enruta con `RequireAuth` → rutas privadas → `PrivateAppGate` → shell. `expiresAt` ya se actualiza en cada login/refresh exitoso.

## Goals / Non-Goals

**Goals:**

- Renovar el access token automáticamente ~60 segundos antes de `expiresAt`.
- Reprogramar el timer tras cada refresh exitoso (nuevo `expiresAt`).
- Mantener el componente activo mientras el usuario esté autenticado.
- Preservar `handleUnauthorized` en `apiClient` como fallback reactivo.

**Non-Goals:**

- Modificar `apiClient.js`, `authSlice.js` o `refreshSessionThunk`.
- Reintentar automáticamente requests fallidas por token expirado.
- Cambiar configuración de Keycloak vía código o IaC.
- Convertir `SessionKeepAlive` en un hook personalizado.

## Decisions

### 1. Componente React puro con `useEffect` + `setTimeout`

**Decisión:** Implementar `SessionKeepAlive` como componente que retorna `null`, con un `useEffect` que calcula `delay = expiresAt - Date.now() - 60_000` y programa `refreshSessionThunk`.

**Rationale:** El cleanup de React (`clearTimeout`) cancela timers obsoletos cuando `expiresAt` cambia. Un hook exportado requeriría que cada consumidor lo invoque; un componente montado una vez es más simple y explícito.

**Alternativa descartada:** Interval periódico (ej. cada 30 s) — innecesario y genera más llamadas al backend.

### 2. Punto de montaje: `RequireAuth.jsx`

**Decisión:** Montar `<SessionKeepAlive />` junto al `<Outlet />` en `RequireAuth`, después de confirmar `isAuthenticated`.

**Rationale:**

| Ubicación | Pros | Contras |
|-----------|------|---------|
| `AuthInitializer` | Siempre montado | Corre también sin sesión (aunque el componente no-op si `expiresAt` es null) |
| `RequireAuth` | Cubre todas las rutas autenticadas (`/sin-perfil`, `/app/*`) | No corre en login (correcto) |
| `PrivateAppGate` | Solo app enriquecida | Excluye `/sin-perfil` y otras rutas autenticadas fuera de `/app` |

`RequireAuth` es el gate más externo que garantiza sesión activa en Redux.

**Alternativa descartada:** Montar en `App.jsx` global — activo también en rutas guest durante la carga inicial.

### 3. Refresh inmediato si `delay <= 0`

**Decisión:** Si el token ya expiró o faltan menos de 60 s, disparar `refreshSessionThunk()` de inmediato sin `setTimeout`.

**Rationale:** Cubre sesiones restauradas desde localStorage cerca de la expiración y evita dejar pasar el deadline.

### 4. Constante `REFRESH_BEFORE_EXPIRY_MS = 60_000`

**Decisión:** 60 segundos de margen fijo, no configurable por ambiente.

**Rationale:** Suficiente para completar el round-trip de refresh antes de que las API calls usen un token inválido. No requiere cambios de config.

### 5. Sin cambios al flujo reactivo

**Decisión:** No tocar `handleUnauthorized` ni agregar retry de requests.

**Rationale:** Scope mínimo; el proactivo reduce la frecuencia de **401** pero el reactivo sigue protegiendo edge cases (reloj desincronizado, refresh fallido silencioso, tab en background).

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Access Token Lifespan muy corto en Keycloak (< 2 min) puede causar loop de refresh | Verificar manualmente ≥ 5 min en Realm Settings; documentar en tasks |
| Tab inactiva: timers pueden retrasarse en background | `handleUnauthorized` sigue como fallback al volver a la pestaña |
| Refresh proactivo falla (red caída) | Usuario verá **401** en la siguiente acción; mismo comportamiento actual + sign-out en refresh fallido |
| Múltiples tabs | Cada tab programa su propio timer; refresh en una tab actualiza localStorage; otras tabs reciben nuevo `expiresAt` vía Redux solo en esa tab — aceptable, no peor que hoy |

## Migration Plan

1. Implementar `SessionKeepAlive.jsx` y montarlo en `RequireAuth.jsx`.
2. Desplegar frontend (sin migración de BD ni backend).
3. Verificar Access Token Lifespan en Keycloak por ambiente.
4. **Rollback:** eliminar montaje y archivo; comportamiento vuelve al refresh reactivo exclusivo.

## Open Questions

- Ninguna bloqueante. El valor actual de Access Token Lifespan en Keycloak local/dev/prod se reportará durante la verificación manual en implementación.
