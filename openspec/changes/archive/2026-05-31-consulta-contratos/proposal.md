## Why

Hoy no existe una vista unificada para consultar contratos del sistema (borradores en proceso de firma y contratos firmados). Los datos clave del contrato (fecha, red social, precio, cliente) viven solo en PDFs en GCS o en overrides efímeros al generar, lo que impide buscar, filtrar y paginar. Este módulo persiste esos metadatos en BD y expone una pantalla de consulta bajo Gestión de Contratos con acceso al PDF.

## What Changes

- Migración `202606010005_add_contract_overrides.js`: columna JSONB `contract_overrides` en `draft_document` y `document`; columna `client_id` nullable en `document`; índices GIN sobre `contract_overrides`.
- `documentBuilderService.generateAndPersist`: persistir `contract_overrides` (overrides pre-procesados con precio formateado, fechas, etc.) al insertar en `draft_document`.
- Nuevo `contractsQueryService.js` con `listContracts({ page, pageSize, filters })`: UNION ALL de `draft_document` + `document`, filtros compartidos, paginación offset/limit, exclusión de status `rejected`.
- Nuevo `contractsController.js` y rutas REST:
  - `GET /api/contracts` — listado paginado con filtros
  - `GET /api/contracts/:id/pdf?source=draft|signed` — PDF unificado desde GCS
- CASL: subject `Contract` con action `read` y label "Consulta de contratos" en `permissionsCatalog.js`.
- Frontend: `contractsApi.js`, página `ContractsListPage.jsx` (filtros, tabla, paginación 18/página, apertura PDF vía fetch+blob), menú y ruta bajo `gestion_contratos` con `RequireCan I="read" a="Contract"`.

**No se incluye**: edición de contratos desde consulta; filtros por empresa; cursor-based pagination; migración retroactiva de `contract_overrides` en contratos históricos; permisos MCP adicionales.

## Capabilities

### New Capabilities

- `contracts-query`: Consulta unificada de contratos (borradores + firmados), API de listado y PDF, persistencia de `contract_overrides`, UI de filtros/tabla/paginación y autorización CASL `Contract`.

### Modified Capabilities

- `draft-document-gcs`: `generateAndPersist` SHALL persistir `contract_overrides` JSONB en `draft_document` al generar.
- `document-registry-table`: Tabla `document` SHALL almacenar `contract_overrides` JSONB y `client_id` nullable FK → `client` para consulta de contratos firmados.
- `casl-authorization`: Catálogo de permisos SHALL incluir subject `Contract` con action `read`.

## Impact

- **Base de datos**: columnas nuevas en `draft_document` y `document`; índices GIN.
- **API**: dos endpoints bajo `/api/contracts`; ampliación del INSERT en generación de documentos.
- **Frontend**: nueva página en Gestión de Contratos; entrada de menú `NAV_ITEM_CONTRATOS_CONSULTA`.
- **Dependencias**: `gcsService.downloadBuffer`, patrón PDF de proveedores/document builder, `fetchClientsList`, `fetchStandardTemplates`.
- **Tests**: `contractsQueryService` (unit), `contractsApi.test.js` (integración), posible ajuste en tests de `documentBuilderService`.

## Consideraciones de seguridad

- Los contratos contienen datos comerciales sensibles (precio, proveedor, cliente, red social). Todo acceso exige JWT válido y permiso CASL `read` sobre subject `Contract`.
- El endpoint PDF no expone rutas GCS directas; sirve bytes vía backend tras verificar existencia del registro y autorización.
- Validar query params (`source` ∈ `{draft, signed}`; UUIDs en filtros); respuestas 404/403 en español sin detalles internos.
- Contratos con status `rejected` nunca se listan, independientemente del filtro de estado.
- Perfil `ADMINISTRADOR_PLATAFORMA` ya autorizado vía `manage/all`; otros perfiles requieren asignación explícita del permiso `Contract`.
