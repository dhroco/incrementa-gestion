## 1. Investigación y preparación



- [x] 1.1 Grep de `phone`, `rut_body`, `rut_dv` en contexto `user_profile` / platform users; documentar archivos a tocar (excluir empresas, proveedores, clientes)

- [x] 1.2 Grep de todos los callers de `findUserIdByEmail` (`platformUsersAdminService`, `delete-app-user.js`, tests)



## 2. Keycloak admin client



- [x] 2.1 Cambiar `findUserIdByEmail` para retornar `{ id, fullName } | null`; helper interno que construye `fullName` desde `firstName`/`lastName` con fallback al email

- [x] 2.2 Actualizar JSDoc del método

- [x] 2.3 Actualizar `delete-app-user.js` para usar `.id` del resultado



## 3. Migración de base de datos



- [x] 3.1 Crear migración `202606030002_drop_user_profile_personal_fields.js` con `hasColumn` antes de cada `DROP COLUMN` (`phone`, `rut_body`, `rut_dv`)

- [x] 3.2 Implementar `down` que recrea las tres columnas como nullable



## 4. Backend — platformUsersAdminService



- [x] 4.1 Simplificar `validateCreatePayload`: solo `email`, `profile_code`, `is_active`; eliminar validación de `full_name`, `phone`, RUT; quitar import de `parseRut` si ya no se usa

- [x] 4.2 Simplificar `validateUpdatePayload`: eliminar `full_name`, `phone`, RUT

- [x] 4.3 En `createPlatformUser`: usar `keycloakUser.id` y `keycloakUser.fullName` para INSERT; eliminar columnas phone/rut del insert

- [x] 4.4 En `updatePlatformUser`: eliminar patches de `full_name`, `phone`, `rut_body`, `rut_dv`

- [x] 4.5 En list/detail queries: quitar SELECT de `phone`, `rut_body`, `rut_dv`; quitar filtro `orWhereILike('up.phone', ...)`; ajustar mapeo de respuesta



## 5. Frontend — usuarios plataforma



- [x] 5.1 `PlatformUserCreatePage.jsx`: formulario con Email, Rol, Activo; eliminar nombre, teléfono, RUT y dependencias (`RutInput`, `parseRut`)

- [x] 5.2 `PlatformUserEditPage.jsx`: editar solo Email, Rol, Activo; eliminar campos nombre/teléfono/RUT

- [x] 5.3 `PlatformUserViewPage.jsx`: quitar teléfono y RUT; mantener nombre como solo lectura

- [x] 5.4 `PlatformUsersListPage.jsx`: quitar columna teléfono



## 6. Tests



- [x] 6.1 Actualizar `backend/test/platformUsersPlatformApi.test.js`: payloads sin `full_name`/phone/rut; assert `full_name` desde mock Keycloak

- [x] 6.2 Agregar o actualizar tests unitarios para `findUserIdByEmail` (nombre presente, nombre vacío → fallback email)

- [x] 6.3 Ejecutar suite de tests backend relacionada y corregir fallos



## 7. Verificación final



- [x] 7.1 Ejecutar migración en local y confirmar columnas eliminadas

- [x] 7.2 Smoke test manual: crear usuario plataforma (email existente en Keycloak), editar rol/activo, ver listado y detalle

