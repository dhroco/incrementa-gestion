## Context

El backend valida JWTs OIDC con `requireOidcAuth` y expone `req.auth = { userId, email }`, donde `userId` es el `sub` del token. Toda la cadena posterior — `attachAbility`, `buildPackedRulesForUser`, `loadSessionMetaForUser`, `getUserProfileIdByUserId` — resuelve al usuario interno por ese `userId`, que hoy debe coincidir con `user_profile.user_id` (UUID sembrado al crear el usuario en Keycloak).

La migración a Microsoft Entra ID cambia el emisor, el formato del `sub` y posiblemente el claim donde viene el correo (`email` vs `preferred_username`). Se necesita desacoplar la identidad interna del `sub` externo sin reescribir los resolvers existentes.

Estado actual relevante:

- `requireOidcAuth.js`: extrae email solo de `payload.email`; JWKS cacheado por proceso desde discovery de `OIDC_ISSUER_URL`.
- `config.js` local: defaults Keycloak (`incrementa-backend` audience); sin defaults Entra.
- `user_profile.email`: columna existente (migración `202605260001`); sin índice único case-insensitive.
- `normalizeAuthEmail` en `backend/lib/normalizeAuthEmail.js`: trim + lowercase, usado en alta de usuarios de plataforma.

## Goals / Non-Goals

**Goals:**

- Middleware `resolveInternalIdentity` que mapee email del token → `user_profile.user_id` y sobrescriba `req.auth.userId`.
- Extracción robusta de email en `requireOidcAuth` para tokens Entra.
- Defaults OIDC Entra en `config.js` para entorno `local`.
- Índice único parcial case-insensitive en `user_profile.email` con guard de duplicados en migración.
- Tests unitarios del middleware y ajustes en tests de auth afectados.

**Non-Goals:**

- Modificar `buildPackedRulesForUser`, `loadSessionMetaForUser`, `getUserProfileIdByUserId`.
- Cambios en frontend o flujos ROPC (`oidcAuthService`, `authController`, rutas `/api/auth/*`).
- Eliminar Keycloak, `requireSupabaseAuth` u otros artefactos legacy.
- Cambiar tipo de `user_profile.user_id`.
- Configurar Entra en `dev`/`prod` (solo `process.env` en esos entornos).
- Aceptar múltiples audiencias (`api://…` + GUID) salvo que falle en pruebas reales.

## Decisions

### 1. Middleware de resolución separado (no modificar resolvers)

- **Elección**: Nuevo `backend/middleware/resolveInternalIdentity.js` con fábrica inyectable `{ db }`, cableado entre `requireAuth` y `attachAbility` en `app.js`.
- **Rationale**: El usuario exige no tocar `buildPackedRulesForUser`, `loadSessionMetaForUser` ni `getUserProfileIdByUserId`. Sobrescribir `req.auth.userId` antes de `attachAbility` mantiene toda la cadena sin cambios.
- **Alternativa descartada**: Cambiar cada resolver para buscar por email — diff amplio y frágil.

### 2. Lógica de resolución

```
if req.auth.email (normalizado) →
  SELECT user_id FROM user_profile WHERE LOWER(email) = :normalizedEmail LIMIT 1
  if row → req.auth.userId = row.user_id
  else → no modificar req.auth.userId (404 PROFILE_NOT_ASSIGNED natural)
if email ausente/vacío → no modificar req.auth.userId
```

- Query con `LOWER(email)` en SQL para coincidir con emails almacenados sin normalizar en BD (defensa en profundidad).
- Email del token normalizado con `normalizeAuthEmail` antes del query.
- Sin error explícito en el middleware: ausencia de perfil se maneja aguas abajo.

### 3. Extracción de email en requireOidcAuth

- **Elección**: `const raw = payload.email ?? payload.preferred_username`; luego `normalizeAuthEmail(raw)`; si resultado vacío → `email: null`.
- **Rationale**: Entra ID puede emitir correo en `preferred_username` para ciertos tipos de cuenta.
- **`req.auth.userId`**: sigue siendo `sub` del token en este middleware; la sobrescritura ocurre en el siguiente middleware.

### 4. Configuración Entra local

| Variable | Default local (si `process.env` vacío) |
|----------|----------------------------------------|
| `OIDC_ISSUER_URL` | `https://login.microsoftonline.com/60322b4a-13bf-4f19-89ae-efe4a54ffed6/v2.0` |
| `OIDC_AUDIENCE` | `dc734f4a-5f25-4e88-b728-aab4715f2122` |
| `OIDC_CLIENT_ID` | `dc734f4a-5f25-4e88-b728-aab4715f2122` |

- `process.env` siempre gana sobre defaults en `config.js`.
- `dev`/`prod`: sin defaults Entra; solo `process.env`.
- **Audiencia**: con `requestedAccessTokenVersion: 2`, Entra emite `aud` = client ID GUID. Si falla validación, inspeccionar token real y considerar ampliar `audienceMatches`.

### 5. Migración de índice único

- **Elección**: Migración Knex `202606230001_user_profile_email_unique.js` (timestamp acorde al repo).
- **Up**:
  1. Query duplicados: `SELECT LOWER(email), array_agg(user_id) FROM user_profile WHERE email IS NOT NULL GROUP BY LOWER(email) HAVING COUNT(*) > 1`
  2. Si hay filas → `throw new Error('...')` con lista de duplicados
  3. `knex.raw('CREATE UNIQUE INDEX user_profile_email_lower_unique ON user_profile (LOWER(email)) WHERE email IS NOT NULL')`
- **Down**: `DROP INDEX IF EXISTS user_profile_email_lower_unique`
- **Alternativa descartada**: Borrar duplicados automáticamente — riesgo de pérdida de datos.

### 6. Integración en createApp

- Importar `resolveInternalIdentity` desde el nuevo módulo.
- Añadir parámetro inyectable `resolveInternalIdentityMiddleware = resolveInternalIdentity({ db })`.
- Insertar `app.use(resolveInternalIdentityMiddleware)` después de `app.use(requireAuth)` y antes de `app.use(attachAbilityMiddleware)`.
- La ruta `POST /api/auth/logout` usa `requireAuth` antes del stack global; no pasa por `resolveInternalIdentity` (aceptable: logout no necesita perfil interno).

### 7. JWKS cache

- Sin cambio de código: cache a nivel módulo en `requireOidcAuth`. Al cambiar issuer (Keycloak → Entra) reiniciar el proceso Node.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Duplicados de email en BD impiden migración | Migración falla con mensaje claro; resolver manualmente antes de reintentar |
| Email en token ≠ email en `user_profile` | Normalización consistente; operaciones de alta ya usan `normalizeAuthEmail` |
| `aud` distinto al GUID esperado | Documentado; ajustar `OIDC_AUDIENCE` o ampliar `audienceMatches` si hace falta |
| Usuario sin email en token Entra | No se sobrescribe `userId`; comportamiento igual al actual (404 si sub no existe) |
| JWKS stale tras cambio de issuer | Reinicio de proceso |
| Email compartido entre tenants distintos (futuro) | Fuera de alcance; unicidad global es decisión consciente para esta etapa |

## Migration Plan

1. Ejecutar query manual de duplicados en entornos objetivo; resolver conflictos si existen.
2. Desplegar migración Knex (índice único).
3. Desplegar backend con middleware, cambios OIDC y config Entra local.
4. Reiniciar proceso backend para cargar JWKS de Entra.
5. Verificar: token Entra válido + email con perfil → 200 en `/api/me/session`; sin perfil → 404 `PROFILE_NOT_ASSIGNED`; token inválido → 401.

**Rollback**: Revertir deploy backend (quitar middleware, restaurar config). Índice único puede permanecer (no rompe Keycloak). Si se revierte también la migración, `DROP INDEX`.

## Open Questions

- ¿Aceptar también `api://{client-id}` como audiencia válida además del GUID? Decidir tras primera prueba con token real de Entra.
- ¿Actualizar `SET_VARS_AMBIENTE_LOCAL.cmd` con vars Entra? Fuera del alcance explícito del usuario; opcional en implementación si facilita dev local.
