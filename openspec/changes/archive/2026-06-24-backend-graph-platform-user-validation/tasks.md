## 1. Configuración Graph



- [x] 1.1 Agregar `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID` y `GRAPH_CLIENT_SECRET` en `backend/config.js` para `local`, `dev` y `prod` (defaults de tenant/clientId solo en `local`; secreto sin default)

- [x] 1.2 Verificar que `SET_VARS_AMBIENTE_LOCAL.cmd` ya expone las tres variables Graph (ajustar comentarios si hace falta)



## 2. Cliente Microsoft Graph (`graphClient.js`)



- [x] 2.1 Crear `backend/lib/graphClient.js` con `GraphClientError`, `isGraphConfigured()`, singleton `getGraphClient()` y `resetGraphClientForTests()`

- [x] 2.2 Implementar obtención de token client credentials (`scope=https://graph.microsoft.com/.default`) con cache en memoria y margen de 10 s

- [x] 2.3 Implementar `findUserByEmail(email)`: normalizar con `normalizeAuthEmail`, escapar comillas OData, query con filtro mail/UPN/otherMails, header `ConsistencyLevel: eventual`, retornar `{ id, fullName } | null`

- [x] 2.4 Mapear errores de token/red/API a `GraphClientError`; lista vacía → `null` sin throw



## 3. Servicio de usuarios de plataforma



- [x] 3.1 En `platformUsersAdminService.js`, reemplazar import y uso de `getKeycloakAdminClient` por `getGraphClient` + `findUserByEmail` en `createPlatformUser`

- [x] 3.2 Actualizar mensajes es-CL: `ADMIN_CLIENT_UNAVAILABLE`, `IDP_USER_NOT_FOUND` e `IDP_LOOKUP_FAILED` referenciando Entra/Graph en lugar de Keycloak

- [x] 3.3 Eliminar bloque `updateUserEmail` y dependencia de Keycloak en `updatePlatformUser`

- [x] 3.4 Ajustar `validateUpdatePayload` para no persistir `email` (ignorar campo en update); quitar validación activa de email en update si ya no aplica



## 4. Tests



- [x] 4.1 Crear `backend/test/graphClient.test.js`: mock de `fetch` — usuario encontrado, `value` vacío → null, fallo de token/red → throw `GraphClientError`

- [x] 4.2 Crear o ampliar tests de `platformUsersAdminService` con Graph mockeado: create exitoso, 422 sin usuario, 503 Graph no configurado, 503 error de lookup

- [x] 4.3 Actualizar `backend/test/platformUsersPlatformApi.test.js` si el mensaje 422 cambia de Keycloak a Entra

- [x] 4.4 Ejecutar suite de tests del backend y corregir fallos relacionados



## 5. Verificación manual



- [x] 5.1 Con `GRAPH_*` configurado en local, probar `POST /api/platform/users` con email existente en el tenant → 201

- [x] 5.2 Probar con email inexistente en el tenant → 422 `IDP_USER_NOT_FOUND`

- [x] 5.3 Probar `PATCH /api/platform/users/:id` con `email` en body → email en BD sin cambios (cubierto por test unitario)

- [x] 5.4 Confirmar que no se realizan llamadas a Keycloak Admin durante create/update HTTP


