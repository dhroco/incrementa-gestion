## 1. Migración de base de datos

- [x] 1.1 Crear `backend/migrations/202605300020_template_supplier_type.js` con columna nullable, limpieza de códigos `PLANTILLA-%`, update de `PL0001`, NOT NULL y check constraint
- [x] 1.2 Implementar `down` que elimine constraint y columna `supplier_type`
- [x] 1.3 Ejecutar migración en entorno local y verificar que PL0001 queda con `supplier_type = 'empresa'`

## 2. Servicio standardTemplatesService

- [x] 2.1 Añadir helper `normalizeSupplierType` y validación obligatoria en `createStandardTemplate` / `updateStandardTemplate`
- [x] 2.2 Persistir `supplier_type` en insert/update; incluir columna en `selectAuthorColumns`, listado y `mapTemplateRow`
- [x] 2.3 Añadir filtro opcional `supplier_type` en `listStandardTemplates`

## 3. Controladores y Document Builder

- [x] 3.1 Validar y propagar `supplier_type` en body (create/update) y query (list) en `standardTemplatesController.js`
- [x] 3.2 Aceptar query `supplier_type` en `documentBuilderController.getTemplates` con validación HTTP 400 si es inválido
- [x] 3.3 Filtrar e incluir `supplier_type` en `documentBuilderService.listEligibleTemplates`

## 4. Tests

- [x] 4.1 Actualizar/añadir tests en `backend/test/standardTemplatesApi.test.js` (create sin tipo, list filtrado, respuesta incluye campo)
- [x] 4.2 Actualizar/añadir tests en `backend/test/documentBuilderApi.test.js` (filtro `supplier_type`, item incluye campo, param inválido → 400)
- [x] 4.3 Ejecutar suite de tests backend afectada y corregir regresiones
