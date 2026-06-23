## Context

El backend valida hoy Bearer JWTs con `requireSupabaseAuth` (JWKS de Supabase o fallback HS256 vía `SUPABASE_JWT_SECRET`). Keycloak 26 corre en desarrollo como aplicación Java standalone en `C:\Tools\keycloak-26.2.5` (Docker no está disponible en el entorno AWS t3). El realm `incrementa` se importa desde `infra/keycloak/import/incrementa-realm.json`. Este cambio sustituye la validación Supabase por OIDC genérico en backend únicamente; la autorización (perfiles, grants de navegación) sigue en BD vía `authorizationService` y middlewares existentes.

Estado actual relevante:

- `backend/app.js` inyecta `requireSupabaseAuth` como `requireAuth` por defecto.
- `requireSupabaseAuth.js` ya usa `jose` y expone `req.auth = { userId, email }`.
- Un cambio previo añadió `docker-compose.yml` y `bootstrap-test-users.sh` orientados a Docker; deben retirarse.

## Goals / Non-Goals

**Goals:**

- Middleware `requireOidcAuth` que valide JWT contra JWKS del emisor configurado en `OIDC_ISSUER_URL`.
- Resolver `jwks_uri` desde el discovery document OIDC (`.well-known/openid-configuration`), sin hardcodear rutas JWKS.
- Validar `iss` y `aud` (`OIDC_AUDIENCE`, default `incrementa-backend`).
- Mantener interfaz `req.auth = { userId, email }` y códigos HTTP 401 alineados al middleware actual.
- Configuración en `config.js` y variables locales en `SET_VARS_AMBIENTE_LOCAL.cmd`.
- Sustituir import en `app.js`; conservar `requireSupabaseAuth.js` hasta cambio de limpieza.
- Actualizar documentación Keycloak standalone; eliminar artefactos Docker obsoletos.

**Non-Goals:**

- Cambios en `frontend/`.
- Autorización por roles/claims en el middleware (sin `requireNavigationGrant` ni similares).
- Alinear seeds `user_profile` con UUIDs Keycloak (`sub`).
- Eliminar `SUPABASE_*` de `config.js` o borrar `requireSupabaseAuth.js`.
- Integrar login frontend con Keycloak (cambio posterior).

## Decisions

### 1. Nuevo archivo en lugar de modificar Supabase middleware

- **Elección**: `backend/middleware/requireOidcAuth.js` exportando `requireOidcAuth`.
- **Rationale**: Permite rollback y limpieza incremental; el usuario exige no borrar el archivo Supabase aún.
- **Alternativa descartada**: Renombrar/refactorizar `requireSupabaseAuth.js` — mezcla dos proveedores y complica el diff.

### 2. Validación con jose y JWKS remoto

- **Elección**: `createRemoteJWKSet` + `jwtVerify` (misma librería que el middleware actual).
- **Opciones de verify**: `issuer: OIDC_ISSUER_URL`, `audience: OIDC_AUDIENCE` (cuando el token incluya `aud`; Keycloak emite `aud` para clientes configurados).
- **Cache**: Una instancia de `RemoteJWKSet` por proceso, creada tras resolver `jwks_uri` la primera vez que se necesite.
- **Alternativa descartada**: Validación HS256 local — no aplica a Keycloak/Entra (RS256).

### 3. Discovery y arranque lazy

- **Elección**: Al primer request autenticado, si aún no hay JWKS:
  1. `GET {OIDC_ISSUER_URL}/.well-known/openid-configuration`
  2. Leer `jwks_uri` del JSON
  3. Instanciar `createRemoteJWKSet(new URL(jwks_uri))`
- **Rationale**: El servidor Node puede arrancar aunque Keycloak esté apagado; falla 401 solo cuando llega un request con token.
- **Alternativa descartada**: Discovery en `require()` del módulo — bloquearía o crashearía el boot sin IdP.

### 4. Extracción de Bearer y errores

- Reutilizar patrón de `getBearerToken` y `sendError` del middleware Supabase.
- `catch` genérico → 401 `AUTH_INVALID_OR_EXPIRED_TOKEN` (incluye red JWKS, firma inválida, expiración).
- Token ausente o sin `sub` → 401 con códigos existentes (`AUTH_MISSING_TOKEN`, `AUTH_INVALID_TOKEN`).
- Si `OIDC_ISSUER_URL` vacía al validar: 500 `AUTH_SERVER_MISCONFIG` (paridad con falta de config Supabase).

### 5. Configuración

| Variable | Requerida | Default local | Uso |
|----------|-----------|---------------|-----|
| `OIDC_ISSUER_URL` | Sí (para auth OIDC) | `http://localhost:8080/realms/incrementa` | Issuer + base discovery |
| `OIDC_AUDIENCE` | No | `incrementa-backend` | Claim `aud` en `jwtVerify` |

Añadir en los tres bloques `local` / `dev` / `prod` de `config.js` leyendo `process.env`. En `dev`/`prod` sin default hasta definir Entra; en `local` puede documentarse el default en el script `.cmd`.

`SUPABASE_URL`, `SUPABASE_JWT_SECRET`, etc. permanecen sin cambios.

### 6. Integración en app.js

- Cambiar solo la línea de import y el identificador por defecto en `createApp({ requireAuth = requireOidcAuth })`.
- Los tests que inyectan `requireAuth` mock siguen funcionando.

### 7. Limpieza infra Keycloak

| Acción | Artefacto |
|--------|-----------|
| Eliminar | `docker-compose.yml`, `infra/keycloak/scripts/bootstrap-test-users.sh` |
| Conservar | `infra/keycloak/import/incrementa-realm.json`, `scripts/print-test-user-ids.sh` (si sigue siendo útil contra Admin API local) |
| Actualizar | `infra/keycloak/README.md`, `infra/keycloak/.env.example` |

README debe documentar arranque PowerShell:

```powershell
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
$env:KEYCLOAK_ADMIN = "admin"
$env:KEYCLOAK_ADMIN_PASSWORD = "admin"
& "C:\Tools\keycloak-26.2.5\bin\kc.bat" start-dev --import-realm
```

(Desde directorio de datos/import según layout Keycloak; documentar copia o symlink del JSON si aplica.)

`.env.example`: mantener `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`, `KEYCLOAK_CLIENT_SECRET`; quitar `TEST_USER_*`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Primer request lento (discovery + JWKS) | Cache a nivel módulo; jose cachea claves |
| Keycloak caído → 401 en todos los requests autenticados | Comportamiento esperado; mensaje claro en español |
| `sub` Keycloak ≠ seeds Supabase → 404 en `/api/me/session` | Documentado; cambio de seeds aparte |
| `aud` ausente o distinto en algunos tokens | Verificar configuración del cliente Keycloak; audience default documentado |
| Dev/prod aún sin `OIDC_ISSUER_URL` en despliegue | Variables obligatorias antes de activar este cambio en esos entornos |

## Migration Plan

1. Implementar `requireOidcAuth.js`, `config.js`, `app.js`, `SET_VARS_AMBIENTE_LOCAL.cmd`.
2. Actualizar README y `.env.example`; eliminar compose y bootstrap Docker.
3. Arrancar Keycloak standalone e importar realm.
4. Arrancar backend con `OIDC_ISSUER_URL` configurada.
5. Verificar: sin token → 401; token Keycloak válido → 200 o 404; token inválido/expirado → 401.

**Rollback**: Revertir import en `app.js` a `requireSupabaseAuth` y quitar vars OIDC del entorno. No se elimina el middleware Supabase en este cambio.

## Open Questions

- Valores exactos de `OIDC_ISSUER_URL` para `dev`/`prod` (Entra) — fuera de alcance; solo local en este change.
- Si `print-test-user-ids.sh` debe adaptarse a Keycloak sin Docker (curl a localhost) — mantener si sigue funcionando; no bloqueante.
