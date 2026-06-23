## Context

Hoy `platformUsersAdminService.createPlatformUser` provisiona identidad en Keycloak (`createUser`), asigna contraseña temporal, persiste `user_profile` con `must_change_password: true` y compensa con `deleteUser` si falla la BD. El frontend fuerza `MandatoryPasswordChangePage` vía guard de router y expone `PUT /api/me/password`. Tras la migración a Keycloak como IdP único, ese acoplamiento es redundante: los administradores ya pueden crear usuarios y credenciales en Keycloak Admin Console (`http://localhost:8080` en local).

Restricciones del change: no tocar login OIDC, `requireOidcAuth`, ni el flujo de edición de usuario salvo limpieza de `must_change_password`.

## Goals / Non-Goals

**Goals:**

- Registrar usuarios plataforma solo si el email ya existe en Keycloak (`findUserIdByEmail` → UUID → `INSERT user_profile`).
- Eliminar toda gestión de credenciales desde backend y frontend.
- Quitar columna `must_change_password` y referencias en sesión, Redux y router.
- Mensajes de error claros en español (es-CL) para: no existe en IdP, ya registrado, IdP no disponible.
- Mantener `updateUserEmail`, CRUD de perfil y `is_active`.

**Non-Goals:**

- Cambiar políticas de contraseña en Keycloak realm.
- Modificar `PlatformUserEditPage` / `updatePlatformUser` más allá de quitar `must_change_password`.
- Sincronizar borrado de usuarios en Keycloak desde la app (script `delete-app-user.js` puede seguir usando `deleteUser` si aún se necesita para ops; el cliente admin puede conservar `deleteUser` comentado solo si el script lo usa — verificar en implementación).
- Nuevos endpoints de invitación o self-registration.

## Decisions

### 1. Lookup-only en creación (no create/delete/reset en flujo API)

**Decisión:** `createPlatformUser` solo llama `findUserIdByEmail(email)`. Si retorna `null`/vacío → HTTP **422** con mensaje que indica crear el usuario en Keycloak primero. Si ya hay fila `user_profile` con ese email o `user_id` → **409**.

**Alternativa rechazada:** Seguir creando en Keycloak y solo desactivar contraseña temporal — mantiene duplicidad de responsabilidades.

### 2. Errores de Keycloak diferenciados

**Decisión:** En el servicio, distinguir:
- Resultado vacío de búsqueda → 422, código tipo `IDP_USER_NOT_FOUND`, mensaje orientado al admin.
- `getKeycloakAdminClient() === null` o fallo de red/token → **503** `ADMIN_CLIENT_UNAVAILABLE` o **502** con mensaje de IdP no disponible (alineado con otros servicios admin).

**Alternativa rechazada:** Un solo mensaje genérico — peor UX para soporte.

### 3. Migración de esquema

**Decisión:** Nueva migración Knex `202606010006_drop_must_change_password.js` (o timestamp actual al implementar) con `ALTER TABLE user_profile DROP COLUMN must_change_password` en `up`; en `down`, re-agregar columna boolean default `false` solo si se requiere rollback documentado.

**Alternativa rechazada:** Dejar columna ignorada — deuda y riesgo en seeds/tests.

### 4. Cliente Keycloak admin

**Decisión:** Comentar con `// eliminado en refactor IdP` los cuerpos de `createUser`, `deleteUser`, `resetUserPassword`; exportar solo `findUserIdByEmail`, `updateUserEmail` y utilidades de token. Si `delete-app-user.js` aún importa `deleteUser`, mantener implementación activa solo para el script o mover llamada al script — **no** usar en flujo HTTP de creación.

### 5. Frontend post-creación

**Decisión:** `PlatformUserCreatePage` sin UI de contraseña; éxito → toast + redirect a listado (patrón de otros módulos). Error 422 IdP → mensaje en formulario citando Keycloak Admin Console.

**Decisión:** Eliminar ruta y página `MandatoryPasswordChangePage`; quitar guard que redirige cuando `mustChangePassword === true`; eliminar `mustChangePassword` del slice y selectores.

### 6. Sesión API

**Decisión:** `GET /api/me/session` deja de incluir `mustChangePassword` en `sessionResponses` / `userSessionMetaService`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Admin olvida crear usuario en Keycloak antes del alta en plataforma | Mensaje 422 explícito en API y formulario; documentar en README operativo si aplica |
| Usuario existe en Keycloak pero email distinto al username | `findUserIdByEmail` debe seguir la convención actual (email = username); no cambiar en este change |
| Referencias residuales a `must_change_password` rompen build/tests | Grep global antes de merge; actualizar seeds y tests de sesión/contraseña |
| Migración en prod con datos legacy | Columna se elimina; usuarios con flag true pierden el flag — aceptable porque el flujo desaparece |
| Script ops `delete-app-user.js` depende de `deleteUser` | Verificar en tasks; no eliminar export si el script lo usa |

## Migration Plan

1. Desplegar backend con nuevo `createPlatformUser` y rutas de contraseña eliminadas.
2. Ejecutar `knex migrate:latest` en cada entorno (DROP COLUMN).
3. Desplegar frontend sin guard de contraseña obligatoria.
4. Comunicar a admins: flujo Keycloak primero → alta en plataforma.
5. **Rollback:** revertir código; migración `down` reañade columna; usuarios creados durante ventana solo en BD siguen válidos si UUID coincide con Keycloak.

## Open Questions

- ¿`delete-app-user.js` debe seguir llamando `deleteUser` en Keycloak? (Implementación: leer script y decidir si el método comentado queda activo solo para scripts.)
- ¿Actualizar documentación en `infra/keycloak/README.md` con el flujo “crear usuario en consola antes de registrar en plataforma”? (Recomendado, no bloqueante.)
