## Why

Los PDFs generados por el Document Builder se almacenan hoy como `BYTEA` en `generated_document`, lo que escala mal en PostgreSQL y no alinea el modelo con contratos finales en GCS. Con `gcs-backend-service` ya disponible, conviene persistir borradores en Cloud Storage, registrar metadatos en tablas relacionales (`draft_document`, `document`) y retirar la tabla legacy.

## What Changes

- Cuatro migraciones Knex (016–019): `draft_document`, tabla `document` (nuevo esquema GCS), `DROP generated_document`, perfil técnico `MCP_SERVICE`.
- **BREAKING**: `documentBuilderService.generateAndPersist` deja de insertar en `generated_document` y cambia la forma del documento devuelto (`gcs_path`, `status`; sin `pdfRenderEngine` en la respuesta de este cambio).
- **BREAKING**: `getGeneratedDocumentForDownload` lee `draft_document` y descarga desde GCS (requiere credenciales/bucket configurados).
- Sustitución de la tabla legacy GFA `document` (esquema employee/template_type) por el nuevo esquema de registro de contratos antes de crear la tabla `document` del diseño.
- Inyección de `gcsService` y `getUserProfileIdByUserId` en `createDocumentBuilderService` vía `app.js`.
- Perfil de servicio MCP con permiso CASL `manage` / `all` para integraciones automatizadas.

## Capabilities

### New Capabilities

- `draft-document-gcs`: Tabla `draft_document`, generación y descarga del Document Builder vía GCS.
- `document-registry-table`: Tabla `document` para contratos generados o subidos (metadatos + `gcs_path`; sin uso en servicios en este cambio).
- `mcp-service-profile`: Perfil `MCP_SERVICE`, usuario técnico y grant en `role_permissions`.

### Modified Capabilities

- _(Ninguno en `openspec/specs/`; el consumo de GCS se especifica en `draft-document-gcs`.)_

## Impact

- **Migraciones:** `backend/migrations/202605300016_*` … `202605300019_*` (numeración secuencial tras `202605290015`).
- **Servicios:** `documentBuilderService.js`, wiring en `app.js`.
- **Dependencia existente:** `gcsService` (`@google-cloud/storage`, `GCS_BUCKET`, credenciales).
- **Tests:** Actualizar pruebas que mockean `generated_document` / `file_data` si existen a nivel de servicio.
- **Frontend:** `DocumentBuilderPage` muestra `pdfRenderEngine`; puede requerir ajuste en un cambio posterior si se elimina ese campo de la API.
- **Datos:** `generated_document` y filas legacy en `document` se pierden al migrar (POC sin migración de bytes a GCS).

## Consideraciones de seguridad

- Rutas GCS deben construirse solo en backend; no exponer bucket ni credenciales al cliente.
- `created_by` en `draft_document` referencia `user_profile.id`; resolver desde `userId` de Keycloak vía `getUserProfileIdByUserId` — si no hay perfil, responder 404 (no crear borrador anónimo).
- El usuario técnico MCP (`00000000-0000-0000-0000-000000000001`) tiene `manage`/`all`; restringir su uso a procesos de confianza y no a login humano en producción sin controles adicionales.
- Validación de alcance de empresa (`resolveReadableCompanyId`) se mantiene en generate y download.
- Errores al usuario en español (es-CL), coherente con el resto de la API.
