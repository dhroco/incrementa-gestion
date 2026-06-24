## Context

Microsoft Entra ID reemplazó a Keycloak como IdP único. El frontend autentica con MSAL (Auth Code + PKCE); el backend valida JWT con `requireOidcAuth` y resuelve identidad interna por email. El alta de usuarios de plataforma valida existencia en el tenant vía Microsoft Graph (solo lectura). A pesar de ello, el repositorio conserva:

- Backend ROPC: `oidcAuthService.js`, `authController.js`, rutas `/api/auth/login|refresh|logout`.
- Cliente Keycloak Admin: `keycloakAdminClient.js`, usado solo por `delete-app-user.js` y tests.
- Infra local: `infra/keycloak/`.
- Frontend legacy: `ForgotPasswordPage`, `ResetPasswordPage`, `SessionKeepAlive.jsx` (ROPC, ya no montado), `tokenStorage.js`, `jwtUtils.js` (sin importadores).
- Config: variables `KEYCLOAK_*` y `OIDC_CLIENT_*` usadas exclusivamente por ROPC/Keycloak admin.
- Specs y textos con referencias residuales a Keycloak.

El `authSlice` ya está migrado a MSAL; no exporta `refreshSessionThunk` ni `selectSession`, pero `SessionKeepAlive.jsx` aún los referencia (código muerto).

## Goals / Non-Goals

**Goals:**

- Eliminar código, rutas, tests e infra legacy de Keycloak y ROPC sin cambiar el flujo Entra operativo.
- Reducir variables de entorno y secretos obsoletos en `backend/config.js`.
- Actualizar specs y mensajes para reflejar Microsoft Entra / Graph.
- Dejar email de plataforma como solo lectura en UI de edición.
- Pasar `npm test` (backend), `npm run build` + `npm test` (frontend).

**Non-Goals:**

- Modificar `requireOidcAuth`, `resolveInternalIdentity`, `graphClient`, MSAL, `AuthInitializer`, ni la lógica de `platformUsersAdminService` salvo imports muertos.
- Tocar `SET_VARS_AMBIENTE_LOCAL.cmd` (gitignored).
- Borrar usuarios en Microsoft Entra desde la aplicación (Graph sigue solo lectura).
- Migrar requisitos de enriched session fuera de `backend-auth-session-endpoints` (solo se retiran requisitos ROPC de esa spec).

## Decisions

### 1. Orden de eliminación: grep → desregistrar → borrar

**Decisión:** Antes de borrar cada archivo o símbolo, ejecutar grep en backend/frontend; quitar imports y registros de rutas; luego eliminar el archivo.

**Alternativa descartada:** Borrar archivos primero y arreglar errores de compilación — más frágil y deja imports rotos temporales.

### 2. `delete-app-user.js`: simplificar a solo DB

**Decisión:** Mantener el script operativo pero limitado a borrar `user_profile` (y validaciones de perfil `ADMINISTRADOR_PLATAFORMA`). Resolver usuario por `--email` (vía `user_profile.email`), `--user-id` (Entra oid en `user_profile.user_id`) o `--user-profile-id`. Eliminar dependencia de Keycloak Admin y la llamada `deleteUser`.

**Alternativa descartada:** Eliminar el script — aún útil para ops locales sin API de borrado de plataforma.

**Nota:** No se borra la identidad en Entra; el admin debe hacerlo en el portal de Microsoft si corresponde.

### 3. `SessionKeepAlive.jsx`: eliminar

**Decisión:** Borrar el componente completo. MSAL renueva tokens en `acquireApiAccessToken()`; no hay `expiresAt` en Redux. El componente no está montado en la app.

**Alternativa descartada:** Reescribir con MSAL — duplica lo que ya hace `apiClient` + MSAL silent acquire.

### 4. Páginas forgot/reset password: eliminar rutas y archivos

**Decisión:** Quitar rutas `/forgot-password` y `/reset-password` del router y borrar las páginas. La recuperación de contraseña es responsabilidad de Microsoft Entra.

**Alternativa descartada:** Mantener página estática "contacte al administrador" — añade rutas muertas sin enlace desde login MSAL.

### 5. Spec `backend-auth-session-endpoints`: retirar solo requisitos ROPC

**Decisión:** Marcar como REMOVED los requisitos de login/refresh/logout, credenciales ROPC y errores IdP de esos endpoints. Conservar requisitos de `GET /api/me/session` (enriched session).

**Alternativa descartada:** Eliminar la spec entera — perdería requisitos activos de sesión enriquecida.

### 6. Spec `backend-keycloak-admin-client`: retirar completa

**Decisión:** REMOVED de todos los requisitos; al archivar el change, la spec desaparece del catálogo activo.

### 7. Config backend: conservar OIDC para validación JWT

**Decisión:** Mantener `OIDC_ISSUER_URL` y `OIDC_AUDIENCE` (usados por `requireOidcAuth`). Eliminar `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` y todas las `KEYCLOAK_*`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Cliente externo aún llama `/api/auth/login` | Cambio **BREAKING** documentado; flujo soportado es MSAL únicamente |
| Referencias ocultas a Keycloak en comentarios/migraciones | Grep acotado a código ejecutable y config; comentarios históricos en migraciones pueden permanecer |
| `delete-app-user.js` deja identidad huérfana en Entra | Documentar en script que solo elimina registro de aplicación; Entra se gestiona aparte |
| Tests fallan por mocks de Keycloak/ROPC | Actualizar o eliminar tests afectados en la misma PR |
| `PlatformUserEditPage` aún muestra email editable | Aplicar estilo readonly (`ui_tokens.form_field_readonly`) o texto fuera del form |

## Migration Plan

1. **Backend:** Quitar rutas y controller ROPC → eliminar `oidcAuthService.js` → eliminar `keycloakAdminClient.js` y tests → simplificar `delete-app-user.js` → limpiar `config.js` → grep y tests.
2. **Frontend:** Quitar rutas forgot/reset → borrar páginas y `SessionKeepAlive` → borrar `tokenStorage.js`/`jwtUtils.js` si sin referencias → email readonly en edit → grep y build/test.
3. **Infra:** Eliminar `infra/keycloak/`.
4. **Specs:** Aplicar deltas; al archivar, specs Keycloak retiradas y textos Entra actualizados.
5. **Verificación:** `npm test` backend; `npm run build` + `npm test` frontend; smoke manual login Microsoft + alta usuario plataforma (422/409).

**Rollback:** Revertir el commit/PR; no hay migración de BD.

## Open Questions

- Ninguna bloqueante. La decisión de mantener vs eliminar `delete-app-user.js` queda resuelta: mantener simplificado (solo DB).
