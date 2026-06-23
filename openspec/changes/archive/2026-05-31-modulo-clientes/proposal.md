## Why

Los contratos de campaña vinculan a Incrementa/Dynamics Corp (empresa), al proveedor/influencer (contraparte) y a la marca para la que se ejecuta la campaña. Hoy no existe un catálogo de clientes (marca/empresa anunciante) ni variables de plantilla ni persistencia en borradores, lo que impide modelar correctamente campañas multi-marca y automatizar la generación vía Constructor de Documento o MCP. Este módulo cierra esa brecha con un CRUD global alineado al patrón de Proveedores.

## What Changes

- Dos migraciones en orden: `202606010002_create_client_tables.js` (tablas `client` y `client_product_campaign`) y `202606010003_add_client_to_draft_document.js` (`client_id` nullable en `draft_document` con índice).
- Nuevo backend: `clientService.js`, `clientsController.js`, rutas REST `/api/clients` con CASL `Client` (`read`, `create`, `update`); subject insertado en `permissionsCatalog.js` después de `Supplier`.
- Sustitución de variables: grupo `client` en `buildSubstitutionMap` (`client_name`, `client_brand`, `client_brand_account`); catálogo de variables en frontend (y backend si aplica).
- Constructor de documento: paso opcional de selección de cliente entre proveedor y plantilla; `clientId` opcional en `generateAndPersist` y persistencia en `draft_document` (sin mostrar `client_id` en listados existentes de borradores).
- Validación de borrador duplicado sin cambios: clave `supplier+company+template+mes` — independiente del cliente.
- Nuevo frontend: `clientsApi.js`, páginas `ClientListPage`, `ClientViewPage`, `ClientUpsertPage` (patrón visual y UX de Proveedores); menú **Clientes** bajo Administración global (`/app/admin-global/clientes`); rutas con `RequireCan`.
- MCP: herramienta `listar_clientes`; parámetro opcional `clientId` en `validar_contrato` y `generar_contrato`; inyección de `clientService` en `mcp.mjs` / `registerMcpTools`.

**No se incluye**: subject CASL `ClientProductCampaign` (campañas solo vía cliente padre); eliminación de clientes; migración de permisos para `ADMINISTRADOR_PLATAFORMA` (ya tiene `manage/all`); obligatoriedad de `clientId` en ninguna capa.

## Capabilities

### New Capabilities

- `clients-admin`: CRUD de clientes globales con campañas de producto (`client_product_campaign`), API REST, navegación CASL y UI de administración (listado, vista, crear/editar).
- `document-builder-client-context`: Selección opcional de cliente en Constructor de Documento, variables de sustitución y persistencia `client_id` en borradores activos.

### Modified Capabilities

- `backend-mcp-server`: Nueva herramienta `listar_clientes` y parámetro opcional `clientId` en flujos de validación/generación de contrato.
- `document-builder-supplier-context`: Extensión del flujo de generación para aceptar contexto de cliente opcional (requiere delta en spec de generación/sustitución, no solo implementación interna).

## Impact

- **Base de datos**: tablas `client`, `client_product_campaign`; columna `draft_document.client_id`.
- **API**: cuatro endpoints bajo `/api/clients`; body de generación de documento ampliado con `clientId` opcional.
- **Frontend**: submódulo en Administración global; Redux o state local para `selectedClientId` en document builder.
- **MCP**: reinicio de Claude Desktop tras cambios en herramientas.
- **Dependencias**: patrón `supplierService` / `supplierController` / páginas Proveedores; `authorize` + CASL existente; transacciones Knex en create/update de campañas (replace-all).
- **Tests**: API de clientes (`clientApi.test.js`), actualización de tests de `documentBuilderVariableContext`, MCP y document builder según patrones existentes.

## Consideraciones de seguridad

- Los clientes almacenan nombre de marca y cuenta de marca — datos de negocio sensibles. Toda mutación exige JWT válido y permiso CASL explícito (`create` / `update`); lectura exige `read` sobre subject `Client`.
- Validar payloads en backend (name, brand, product_campaigns no vacías donde aplique); no confiar solo en frontend.
- Transacciones Knex en create/update: replace-all de `client_product_campaign` (delete + insert) dentro de la misma transacción que el cliente.
- `client_id` en borradores es nullable y no altera la unicidad de borradores activos — evita escalamiento de duplicados por cliente.
- Mensajes de error al usuario en español (es-CL); no exponer detalles internos de BD en respuestas 500.
- Perfil `ADMINISTRADOR_PLATAFORMA` ya autorizado vía `manage/all`; otros perfiles requieren asignación explícita de permisos `Client` en roles.
