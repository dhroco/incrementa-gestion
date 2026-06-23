## Context

Hoy existen tres perfiles en seeds (`001_profiles_seed.js`): `ADMINISTRADOR_PLATAFORMA`, `USUARIO_EMPRESA_ADMINISTRADOR`, `CONTADOR`. Los dos últimos tienen:

| Área | Artefactos principales |
|------|------------------------|
| BD | `accountant`, `accountant_company`, `company_internal_user`; filas en `profile`, `user_profile`, `profile_navigation_grant` |
| Backend | `accountantPlatformController`, `internalCompanyUsersController`, servicios admin, rutas en `app.js`, `loadSessionMetaForUser` con join a `accountant`, `defaultCompanyContextResolver` para empresa admin |
| Frontend | 9 páginas bajo `/admin-global/contadores/*` y `/admin-global/usuarios-internos-empresa/*`, `authSlice` con `accountantIsActive`, APIs dedicadas |
| Keycloak | Roles realm y usuarios `contador@`, `empresa@` en `incrementa-realm.json` |

La FK `profile_navigation_grant.profile_id → profile.id` usa `ON DELETE CASCADE` (`202604160001_create_navigation_authorization.js`), por lo que borrar filas de `profile` elimina grants automáticamente.

**Restricción explícita**: no editar migraciones históricas; solo agregar `YYYYMMDDXXXX_drop_contador_empresa_profiles.js`.

## Goals / Non-Goals

**Goals:**

- Dejar un único perfil de negocio en seeds y runtime: `ADMINISTRADOR_PLATAFORMA` (más gestión de usuarios plataforma vía `/api/platform/users` sin cambiar).
- Ejecutar migración `up` en orden: drop tablas → delete `user_profile` → delete `profile`.
- Eliminar código muerto backend/frontend y alinear Keycloak import.
- Preservar `POST /api/me/password-rotation-complete` para flujo de cambio obligatorio de contraseña (admin).
- Verificación: migrate, session admin, rutas eliminadas 404, frontend sin imports rotos, grep limpio.

**Non-Goals:**

- Eliminar tabla `company` ni CRUD de empresas del admin global.
- Modificar `ADMINISTRADOR_PLATAFORMA` ni `/api/platform/users`.
- Introducir perfil `USUARIO_PLATAFORMA` (no existe hoy).
- Revertir migración (`down` vacío o error — cambio irreversible).
- Eliminar nodos de navegación del árbol global (pueden quedar huérfanos sin grant; opcional limpieza futura).

## Decisions

### 1. Orden y contenido de la migración

**Decisión:** `up` ejecuta en transacción Knex:

1. `DROP TABLE IF EXISTS accountant_company`
2. `DROP TABLE IF EXISTS accountant`
3. `DROP TABLE IF EXISTS company_internal_user`
4. `DELETE FROM user_profile WHERE profile_id IN (SELECT id FROM profile WHERE code IN ('CONTADOR','USUARIO_EMPRESA_ADMINISTRADOR'))`
5. `DELETE FROM profile WHERE code IN ('CONTADOR','USUARIO_EMPRESA_ADMINISTRADOR')`

**Rationale:** Orden respeta dependencias (tablas hijas primero; `user_profile` antes de `profile`). Grants se eliminan por CASCADE al borrar `profile`.

**Alternativa descartada:** Borrar `profile` antes que `user_profile` — fallaría por FK si existe.

### 2. `down` irreversible

**Decisión:** `exports.down` lanza `Error('Irreversible migration')` o queda vacío documentado.

**Rationale:** Recrear esquema y datos no es objetivo; alineado con spec del usuario.

### 3. Relocalizar password rotation

**Decisión:** Mover `completePasswordRotation` a `meController` + función en servicio genérico (p. ej. extender `userSessionMetaService` o pequeño helper en `meController`) que solo acepte `ADMINISTRADOR_PLATAFORMA`; eliminar rama `CONTADOR` y `USUARIO_EMPRESA_ADMINISTRADOR`.

**Rationale:** `MandatoryPasswordChangePage` depende del endpoint; no es exclusivo de contadores.

**Alternativa descartada:** Eliminar el endpoint — rompería cambio obligatorio de contraseña.

### 4. Rutas de asignación contador en empresas

**Decisión:** Eliminar `GET/PUT /api/companies/:id/accountants` y `GET /api/accountants` de `app.js` y métodos correspondientes en `companyController` / `companyService` que lean/escriban `accountant_company`.

**Rationale:** Sin perfil CONTADOR no hay asignación; UI de empresas que mostraba contadores debe limpiarse si referencia esas APIs.

### 5. Simplificación de sesión enriquecida

**Decisión:** En `app.js` y `userSessionMetaService`: quitar `accountantIsActive`, `assignedCompanies`, `buildAccountantInactiveBody`, ramas `profile.code === 'CONTADOR'`, `defaultCompanyContextResolver` para `USUARIO_EMPRESA_ADMINISTRADOR`. `isActive` en sesión usa solo `user_profile.is_active` para admin.

**Rationale:** Un solo modelo de activación post-eliminación.

### 6. Frontend API para password rotation

**Decisión:** Mover `postPasswordRotationComplete` a `enrichedSessionApi.js` o `apiClient` dedicado; actualizar `MandatoryPasswordChangePage`; eliminar `accountantsPlatformApi.js`.

### 7. Limpieza de navegación en seeds

**Decisión:** En `002_navigation_authorization_seed.js`, eliminar bloques que insertan grants para códigos de perfil `CONTADOR` y `USUARIO_EMPRESA_ADMINISTRADOR`; actualizar mensaje de error de prerequisito de perfiles.

**Rationale:** Seeds idempotentes no deben recrear perfiles eliminados en fresh install.

### 8. Tests y archivos colaterales

**Decisión:** Actualizar o eliminar tests que crean usuarios con esos perfiles (`meSessionApi.test.js`, `clauseApi.test.js`, `companyTemplatesApi.test.js`, `navigationConfig.test.js`, `authSlice.test.js`, etc.) para usar solo `ADMINISTRADOR_PLATAFORMA`. Eliminar `accountantPlatformApi.test.js` y `delete-accountant-user.js`.

**Archivos a evaluar en grep final:** `platformUsersAdminService.js`, `companyScopeService.js`, `resolveCompanyClauseContext.js`, `AppSubHeader.jsx`, páginas de plantillas que condicionan por perfil.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Datos productivos en tablas `accountant*` | Backup BD; ventana de mantenimiento; validar que no hay usuarios activos con esos perfiles |
| Tokens Keycloak de usuarios eliminados | Revocar o eliminar usuarios en Keycloak admin tras migrate |
| Nodos NAV de contadores sin grant | Inofensivos en menú; admin no los ve si no hay grant |
| `companyService` aún referencia accountant | Grep y limpiar métodos huérfanos en mismo change |
| Tests rotos en CI | Ejecutar `npm test` backend y frontend antes de merge |

## Migration Plan

1. Desplegar código con migración nueva (sin ejecutar) — opcional.
2. `knex migrate:latest` en GCP dev → verificar tablas dropped.
3. `knex seed:run` en entorno fresh o confiar en datos ya migrados.
4. Reimportar realm Keycloak local o patch manual de roles.
5. Smoke: login admin, `GET /api/me/session`, frontend arranque, `404` en `/api/platform/accountants`.

**Rollback:** Restaurar snapshot de BD; revertir commit de código. No usar `knex migrate:rollback` en esta migración.

## Open Questions

- ¿Eliminar nodos `navigation_node` de contadores/usuarios internos en migración separada? **Por ahora no** — fuera de alcance; grants CASCADE es suficiente para menú.
- ¿Mantener `AccountantInactivePage`? **No** — eliminar con el resto de páginas contador.
