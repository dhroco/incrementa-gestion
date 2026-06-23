## 1. Configuración OIDC Entra (local)

- [x] 1.1 Actualizar defaults en `backend/config.js` bloque `local`: `OIDC_ISSUER_URL`, `OIDC_AUDIENCE` y `OIDC_CLIENT_ID` con valores Entra ID documentados; mantener `process.env` con prioridad
- [x] 1.2 Verificar que bloques `dev` y `prod` no reciben defaults Entra hardcodeados

## 2. Extracción de email en requireOidcAuth

- [x] 2.1 Importar `normalizeAuthEmail` en `backend/middleware/requireOidcAuth.js`
- [x] 2.2 Extraer email como `payload.email ?? payload.preferred_username` (solo si es string), normalizar con `normalizeAuthEmail`, asignar `null` si queda vacío
- [x] 2.3 Añadir o actualizar tests en `backend/test/` que cubran claim `email`, `preferred_username` y ausencia de ambos

## 3. Middleware resolveInternalIdentity

- [x] 3.1 Crear `backend/middleware/resolveInternalIdentity.js` con fábrica `resolveInternalIdentity({ db })` exportada
- [x] 3.2 Implementar lookup: email normalizado → `SELECT user_id FROM user_profile WHERE LOWER(email) = ? LIMIT 1` → sobrescribir `req.auth.userId` si hay fila; si no, no modificar
- [x] 3.3 Crear `backend/test/resolveInternalIdentity.test.js` con casos: match por email, sin match, email ausente/null

## 4. Cableado en Express

- [x] 4.1 Importar `resolveInternalIdentity` en `backend/app.js`
- [x] 4.2 Añadir parámetro inyectable `resolveInternalIdentityMiddleware` a `createApp` con default `resolveInternalIdentity({ db })`
- [x] 4.3 Registrar `app.use(resolveInternalIdentityMiddleware)` entre `app.use(requireAuth)` y `app.use(attachAbilityMiddleware)`

## 5. Migración de índice único en email

- [x] 5.1 Crear migración Knex (p. ej. `202606230001_user_profile_email_unique.js`)
- [x] 5.2 En `up`: detectar duplicados case-insensitive con query agrupada; si existen, lanzar error con lista de emails duplicados
- [x] 5.3 En `up`: crear índice `user_profile_email_lower_unique` con `knex.raw`; en `down`: `DROP INDEX IF EXISTS user_profile_email_lower_unique`

## 6. Tests de integración y ajustes

- [x] 6.1 Revisar tests existentes de auth/session (`meSessionApi.test.js` y similares) que asuman vinculación directa por `sub`; ajustar mocks si el flujo requiere email + resolución
- [x] 6.2 Ejecutar suite de tests del backend y corregir fallos relacionados con este cambio

## 7. Verificación manual

- [x] 7.1 Reiniciar backend con `OIDC_ISSUER_URL` apuntando a Entra; confirmar discovery JWKS desde issuer v2.0
- [x] 7.2 Token Entra válido con email que coincide en `user_profile` → `GET /api/me/session` responde **200**
- [x] 7.3 Token válido sin perfil asignado → **404** `PROFILE_NOT_ASSIGNED`
- [x] 7.4 Token inválido o expirado → **401**
