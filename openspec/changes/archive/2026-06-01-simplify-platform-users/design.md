## Context

Tras `platform-users-idp-register-only`, la plataforma ya registra usuarios vinculando email preexistente en Keycloak con `user_profile`. Sin embargo, el módulo admin sigue pidiendo y persistiendo `full_name`, `phone`, `rut_body` y `rut_dv` — datos que no son responsabilidad del registro de acceso. Keycloak ya expone `firstName` y `lastName` en la respuesta de búsqueda por email (`findUserIdByEmail`). El módulo Mi Perfil (`avatar_gcs_path`, `contact_email`, `widget_preferences`) es independiente y no se modifica.

**Estado actual relevante:**
- `keycloakAdminClient.findUserIdByEmail` retorna `string | null` (solo UUID).
- `platformUsersAdminService.validateCreatePayload` exige `full_name` y acepta phone/RUT.
- `user_profile` tiene columnas `phone`, `rut_body`, `rut_dv` además de `full_name`.
- Frontend: cuatro páginas de usuarios plataforma con campos nombre/teléfono/RUT.
- Callers de `findUserIdByEmail`: `createPlatformUser`, `delete-app-user.js`.

## Goals / Non-Goals

**Goals:**
- Reducir el módulo admin de usuarios plataforma a su propósito: email + rol + activo.
- Poblar `user_profile.full_name` desde Keycloak al crear (caché de display).
- Eliminar columnas `phone`, `rut_body`, `rut_dv` de `user_profile`.
- Actualizar API, servicio, UI y tests al nuevo contrato.

**Non-Goals:**
- Modificar flujo OIDC, middleware `requireOidcAuth`, ni login.
- Tocar campos de Mi Perfil (`avatar_gcs_path`, `contact_email`, `widget_preferences`).
- Sincronizar `full_name` desde Keycloak en cada edición o login (solo al crear).
- Eliminar columna `full_name` de la tabla.
- Cambiar RUT/teléfono en otros módulos (empresas, proveedores, clientes).

## Decisions

### 1. `findUserIdByEmail` retorna `{ id, fullName } | null`

**Decisión:** Ampliar el retorno a un objeto con UUID y nombre construido desde `firstName` + `lastName` (trim, omitir partes vacías). Si ambos están vacíos/undefined, `fullName = email`.

**Alternativa descartada:** Mantener retorno UUID-only y agregar `findUserByEmail` separado — duplica la misma llamada HTTP.

**Callers:**
- `createPlatformUser`: usar `result.id` y `result.fullName`.
- `delete-app-user.js`: usar `result.id` (destructuring o `.id`).

### 2. Payload de creación mínimo

**Decisión:** `validateCreatePayload` valida solo `email`, `profile_code`, `is_active` (default `true`). Ignorar silenciosamente campos extra (`full_name`, `phone`, `rut*`) o rechazarlos — preferir **ignorar** para no romper clientes legacy de forma abrupta; no documentar campos obsoletos.

**Alternativa descartada:** Rechazar con 400 si vienen campos obsoletos — más estricto pero innecesario para uso interno.

### 3. `full_name` no se actualiza en edit

**Decisión:** `updatePlatformUser` elimina `full_name`, `phone`, `rut_body`, `rut_dv` del payload y del `UPDATE`. El nombre queda como se persistió al crear.

**Alternativa descartada:** Re-sincronizar desde Keycloak en cada PATCH — más complejo, beneficio marginal.

### 4. Migración idempotente con `hasColumn`

**Decisión:** Nueva migración `202606030002_drop_user_profile_personal_fields.js` (nombre tentativo) que hace `DROP COLUMN` de `phone`, `rut_body`, `rut_dv` solo si existen. `down` recrea las tres columnas como nullable.

Patrón: igual a `202606030001_drop_must_change_password.js`.

### 5. Frontend: formularios simplificados

**Decisión:**
- **Create:** Email, Rol (select), Activo (toggle, default true).
- **Edit:** Email, Rol, Activo — sin nombre editable.
- **View:** Mostrar nombre como solo lectura (viene de BD/Keycloak al crear); quitar teléfono y RUT.
- **List:** Quitar columna teléfono; mantener nombre como columna informativa.

### 6. Queries y búsqueda

**Decisión:** Eliminar `phone`, `rut_body`, `rut_dv` de SELECTs y del filtro de búsqueda en listado (`orWhereILike('up.phone', ...)` se elimina). Mantener búsqueda por email y `full_name`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| `full_name` desactualizado si admin cambia nombre en Keycloak | Aceptado: no es fuente de verdad; Mi Perfil / IdP son canonical; re-sync fuera de alcance |
| Datos históricos en `phone`/`rut_*` se pierden al migrar | Columnas eran opcionales y no críticas para acceso; backup implícito vía snapshot BD pre-deploy |
| Callers olvidados de `findUserIdByEmail` | Grep completo + actualizar `delete-app-user.js` y tests |
| Referencias a columnas en seeds/tests | Grep antes de merge; ajustar solo seeds/tests de `user_profile` plataforma |
| Keycloak sin firstName/lastName | Fallback a email documentado y testeado |

## Migration Plan

1. Desplegar backend con código compatible (sin escribir phone/rut) **antes** o **junto** con migración — en este change se eliminan columnas y código en un solo PR; orden: migración → deploy backend+frontend.
2. Ejecutar `knex migrate:latest` en dev/prod.
3. Rollback: `knex migrate:rollback` recrea columnas nullable (datos previos no se restauran).

## Open Questions

Ninguna — decisiones acordadas en la propuesta del usuario.
