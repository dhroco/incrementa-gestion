## 1. Migraciones de base de datos

- [x] 1.1 Crear `backend/migrations/202605300016_create_draft_document.js` con tabla `draft_document`, FKs, defaults e índices (`supplier_id`, `company_id`, `status`)
- [x] 1.2 Crear `backend/migrations/202605300017_create_document_table.js`: `dropTableIfExists('document')` legacy, luego `CREATE document` con esquema del diseño e índices (`supplier_id`, `company_id`, `source`)
- [x] 1.3 Crear `backend/migrations/202605300018_drop_generated_document.js` con `dropTableIfExists('generated_document')` (down sin recrear legacy)
- [x] 1.4 Crear `backend/migrations/202605300019_mcp_service_profile.js` con inserts idempotentes y `down` en orden `role_permissions` → `user_profile` → `profile`
- [x] 1.5 Ejecutar `knex migrate:latest` en entorno local y verificar las cuatro migraciones

## 2. documentBuilderService

- [x] 2.1 Extender factory: parámetros `gcsService` y `getUserProfileIdByUserId` (requeridos o con fallo explícito en tests)
- [x] 2.2 En `getTemplateRow`, agregar `t.code` al SELECT
- [x] 2.3 En `generateAndPersist`: resolver `created_by` (404 si falta perfil), `randomUUID()` para id, construir `gcsPath`, `uploadBuffer`, INSERT en `draft_document`, retornar `id`, `file_name`, `gcs_path`, `status`
- [x] 2.4 En `getGeneratedDocumentForDownload`: leer `draft_document`, `downloadBuffer`, mantener validación de `company_id`
- [x] 2.5 Eliminar referencias a `generated_document`, `file_data`, `standard_template_id` y `pdf_render_engine` en el servicio

## 3. Wiring en app.js

- [x] 3.1 Importar `{ gcsService }` desde `./services/gcsService`
- [x] 3.2 Pasar `gcsService` y `getUserProfileIdByUserId: userProfileIdResolver` a `createDocumentBuilderService`

## 4. Pruebas y verificación

- [x] 4.1 Actualizar o añadir tests del document builder que mockeen `gcsService` y `getUserProfileIdByUserId` (generate 404 sin perfil, download desde GCS)
- [x] 4.2 Ejecutar suite de tests backend relevantes (`documentBuilderApi`, servicio si existe)
- [x] 4.3 Probar manualmente generate + download con GCS configurado localmente

## 5. Seguimiento (fuera de alcance inmediato)

- [x] 5.1 (Opcional) Ajustar frontend `DocumentBuilderPage` si se elimina `pdfRenderEngine` de la respuesta API
