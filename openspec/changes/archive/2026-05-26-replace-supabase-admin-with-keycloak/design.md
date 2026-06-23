## Context

El backend aprovisiona usuarios con `getSupabaseAdminClient()` → `admin.auth.admin.createUser()` / `deleteUser()` / `updateUserById()`. Los servicios afectados insertan el UUID devuelto en `user_profile.user_id` y marcan `must_change_password: true` con contraseña temporal generada en servidor.

La autenticación de API ya usa OIDC/Keycloak (`requireOidcAuth`, `POST /api/auth/login` con ROPC). El IdP de verdad es Keycloak realm `incrementa`; Supabase Auth queda desalineado para altas y borrados.

Restricciones del cambio: solo backend, `fetch` nativo, no tocar middleware de sesión ni frontend. `supabaseAdminClient.js` permanece hasta limpieza futura.

## Goals / Non-Goals

**Goals:**

- Centralizar operaciones admin de identidad en `backend/lib/keycloakAdminClient.js`.
- Que `user_profile.user_id` sea el UUID de Keycloak (mismo valor que JWT `sub`).
- Mantener semántica actual: contraseña generada en servidor (expuesta como `temporary_password` en respuesta API), flag `must_change_password` **solo en BD**, rollback si falla la transacción Postgres. Keycloak **no** fuerza cambio de contraseña en el IdP al crear.
- Configurar credenciales admin vía `config.js` y `SET_VARS_AMBIENTE_LOCAL.cmd`.
- Actualizar scripts de borrado para eliminar en Keycloak.

**Non-Goals:**

- Eliminar `supabaseAdminClient.js` o dependencia `@supabase/supabase-js`.
- Cambios en frontend, `requireOidcAuth.js`, endpoints de sesión.
- Migración masiva de usuarios Supabase → Keycloak (fuera de este change).
- Borrado de tablas/esquema `auth.*` en Postgres de Supabase.

## Decisions

### 1. Cliente Keycloak Admin con fetch nativo

**Decisión:** Módulo singleton `keycloakAdminClient.js` exportando `getKeycloakAdminClient()` (o funciones directas) sin dependencias npm nuevas.

**API pública:**

| Método | Keycloak |
|--------|----------|
| `createUser({ email, password, firstName?, lastName? })` | `POST /admin/realms/{realm}/users` con credencial activa |
| `deleteUser(userId)` | `DELETE /admin/realms/{realm}/users/{id}` |
| `updateUserEmail(userId, email)` | `PUT /admin/realms/{realm}/users/{id}` (`email`, `username`, `emailVerified: true`) |

`createUser` retorna UUID parseado del header `Location` (`.../users/{uuid}`).

**Payload de creación** (sin `requiredActions`; credencial no temporal):

```json
{
  "username": "<email>",
  "email": "<email>",
  "emailVerified": true,
  "enabled": true,
  "firstName": "...",
  "lastName": "...",
  "credentials": [{ "type": "password", "value": "<password>", "temporary": false }]
}
```

Esto permite login ROPC inmediato con la contraseña generada en servidor. El flujo `must_change_password` lo controla la app vía `user_profile.must_change_password` (igual que con Supabase), no Keycloak.

**Deuda técnica (comentario en `keycloakAdminClient.js`):** al migrar a **Microsoft Entra ID**, `must_change_password` en BD deberá reemplazarse por políticas nativas del IdP (password policies / Conditional Access); el campo en BD quedará obsoleto en esa etapa.

`firstName`/`lastName` opcionales: partir `full_name` en primer token / resto si los servicios lo pasan.

**Alternativa descartada:** `@keycloak/keycloak-admin-client` — añade dependencia; el alcance es acotado y `fetch` basta.

### 2. Autenticación al Admin API (realm master, ROPC)

**Decisión:** Obtener access token con Resource Owner Password Credentials contra `{KEYCLOAK_ADMIN_URL}/realms/master/protocol/openid-connect/token`:

- `grant_type=password`
- `client_id=admin-cli`
- `username=KEYCLOAK_ADMIN_USER`
- `password=KEYCLOAK_ADMIN_PASSWORD`

**Caché:** variable de módulo `{ token, expiresAt }`. Tras cada obtención, calcular `expiresAt` desde `expires_in` (default 60 s). Antes de cada operación, si `Date.now() >= expiresAt - 10_000`, renovar.

**Alternativa:** `client_credentials` con service account — requiere cliente dedicado en master; ROPC con admin local ya está documentado en `infra/keycloak/.env.example`.

### 3. URLs y configuración

**Base admin:** `{KEYCLOAK_ADMIN_URL}/admin/realms/{KEYCLOAK_REALM}`  
Ejemplo local: `http://localhost:8080/admin/realms/incrementa`

**`config.js`** (todos los ambientes, vía `process.env`):

| Variable | Default | Notas |
|----------|---------|-------|
| `KEYCLOAK_ADMIN_URL` | `http://localhost:8080` | Solo en `local` si no se setea |
| `KEYCLOAK_ADMIN_USER` | `admin` | |
| `KEYCLOAK_ADMIN_PASSWORD` | _(ninguno)_ | Requerida para operaciones admin |
| `KEYCLOAK_REALM` | `incrementa` | |

Si falta password (u otra config crítica), `getKeycloakAdminClient()` retorna `null` y los servicios responden `503` `ADMIN_CLIENT_UNAVAILABLE` con mensaje que cite Keycloak (no Supabase).

### 4. Integración en servicios existentes

**Patrón de reemplazo** (accountant, platform, internal create):

1. `const kc = getKeycloakAdminClient()` — guard de disponibilidad.
2. `tempPassword = generateTempPassword()`.
3. `newAuthUserId = await kc.createUser({ email, password: tempPassword, ... })`.
4. Transacción BD igual que hoy con `user_id: newAuthUserId`.
5. En `catch` de transacción: `await kc.deleteUser(newAuthUserId)` best-effort.

**Actualización de email** (platform + internal update): `updateUserEmail(user_id, normalizedEmail)`.

**`completePasswordRotation`:** Sin llamada a IdP admin; solo actualiza `must_change_password` en BD. **No cambiar** el controller.

### 5. Scripts de borrado

La BD GCP **no tiene** esquema `auth`. **Decisión:** Reescribir `delete-accountant-user.js` y `delete-app-user.js` para:

1. Resolver el usuario por `--email`, `--user-id` (Keycloak/`user_profile.user_id`) o `--accountant-id` / perfil, consultando solo tablas `public.*` (`user_profile`, etc.).
2. Borrar datos de aplicación (cascadas existentes en `user_profile`).
3. Llamar `deleteUser(user_profile.user_id)` en Keycloak.

Eliminar por completo joins a `auth.users`, `deleteAuthDependentsForUsers` y cualquier `DELETE` sobre esquema `auth`.

### 6. Manejo de errores

- Mapear HTTP Keycloak a errores de dominio existentes: `422` `AUTH_CREATE_FAILED`, `AUTH_UPDATE_FAILED`.
- Mensajes en español (es-CL); no reenviar JSON crudo de Keycloak al cliente.
- Log interno `debug` con status/body truncado en fallos admin.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Usuario huérfano en Keycloak si falla BD | Rollback `deleteUser` (ya existe patrón con Supabase) |
| Token master expira (~60 s) | Caché con margen 10 s |
| Email duplicado en Keycloak | Keycloak devuelve 409; mapear a `DUPLICATE` / mensaje coherente |
| Scripts legacy con `auth.users` | Eliminar referencias; solo `user_profile` + Keycloak Admin API |
| `updateUserEmail` cambia `username` | Obligatorio para login ROPC por email |
| Admin password en dev | Solo `SET_VARS_AMBIENTE_LOCAL.cmd` (gitignored); prod vía secret manager |

## Migration Plan

1. Implementar cliente + config + vars locales.
2. Cambiar los tres servicios y scripts; desplegar backend con vars Keycloak admin en dev/prod.
3. Verificación manual (criterios del proposal): crear contador, login `POST /api/auth/login`, comparar UUID en Keycloak vs `user_profile.user_id`.
4. Rollback de deploy: revertir código; usuarios ya creados en Keycloak permanecen (limpieza manual si aplica).

## Open Questions

- ¿`firstName`/`lastName` en Keycloak son requeridos por el realm import? Si sí, derivar de `full_name` siempre.
