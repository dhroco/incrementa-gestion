## 1. Migración de base de datos



- [x] 1.1 Crear `backend/migrations/202606010001_simplify_template_status.js`: UPDATE `draft` → `inactive`, drop/add check constraint, default `'inactive'`

- [x] 1.2 Implementar `down`: restaurar constraint con `'draft'`, default `'active'`

- [x] 1.3 Ejecutar `knex migrate:latest` desde `backend/` con variables de entorno cargadas



## 2. Backend — standardTemplatesService



- [x] 2.1 En `createStandardTemplate`: default `status = 'inactive'`; validación `['active', 'inactive']` con fallback `'inactive'`

- [x] 2.2 En `updateStandardTemplate`: aplicar las mismas correcciones de default y validación

- [x] 2.3 En `listStandardTemplates`: aceptar parámetro opcional `status`; si es `'active'` o `'inactive'`, añadir `.where('t.status', status)`



## 3. Backend — MCP



- [x] 3.1 En `backend/mcpTools.mjs` handler `listar_plantillas`: pasar `status: 'active'` a `listStandardTemplates`

- [x] 3.2 Actualizar descripción del tool si hace falta para indicar que solo lista plantillas activas



## 4. Frontend



- [x] 4.1 En `StandardTemplateEditor.jsx`: `useState('inactive')`, fallback load `'inactive'`, label create con `mapTemplateStatusToSpanish('inactive')`, payload create `status: 'inactive'`, eliminar option Borrador

- [x] 4.2 En `frontend/src/utils/templateStatus.js`: fallback desconocido → `'Inactivo'` (no `'Borrador'`)



## 5. Tests



- [x] 5.1 Actualizar `backend/test/standardTemplatesApi.test.js`: reemplazar expectativas `status: 'draft'` por `'inactive'` donde aplique

- [x] 5.2 Actualizar `backend/test/mcpServer.test.js`: verificar que `listar_plantillas` pasa `status: 'active'` y excluye inactivas

- [x] 5.3 Ejecutar suite de tests backend afectada (`standardTemplatesApi`, `mcpServer`) y corregir regresiones



## 6. Verificación manual



- [x] 6.1 Listado admin Plantillas: filas que eran `draft` aparecen como "Inactivo"

- [x] 6.2 Crear plantilla nueva: persiste y muestra como Inactivo

- [x] 6.3 Claude Desktop (tras reiniciar MCP): `listar_plantillas` retorna solo plantillas activas


