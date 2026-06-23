## Why

El backend ya expone el catálogo maestro de redes sociales y el contrato API de proveedores usa `catalog_id` en lugar de `network_name` (Ajuste 2 — BD y Backend), pero la UI de Proveedores sigue usando una tabla editable con select de texto libre y el MCP no documenta ni expone el catálogo. Esto impide iconografía consistente, validación visual contra redes conocidas y uso correcto del catálogo desde Claude.

## What Changes

- **Nuevo componente `SocialNetworkSelector`:** reemplaza la tabla editable de redes sociales. En modo edición: grilla de chips/tarjetas del catálogo con ícono + nombre; toggle de selección; campo inline para handle/cuenta al seleccionar. En modo lectura: solo redes del proveedor con ícono + nombre + handle.
- **Íconos SVG:** archivos en `frontend/src/assets/social-networks/` nombrados por `code` del catálogo (ej. `instagram.svg`, `whatsapp_business.svg`); ícono genérico si falta SVG para un `code`.
- **API client frontend:** nueva función `fetchSocialNetworkCatalog()` que llama `GET /api/social-networks/catalog`; el catálogo se carga una vez al montar el formulario.
- **Integración en Proveedores:** `SupplierSocialNetworksSection` usa `SocialNetworkSelector`; actualizar `supplierToForm`, validación y payload de submit para `{ catalog_id, account_name }` en lugar de `{ network_name, account_name }`.
- **MCP:** actualizar descripciones de `crear_proveedor` y `actualizar_proveedor` para documentar `social_networks` con `catalog_id` + `account_name`; nueva herramienta `listar_catalogo_redes` que llama `GET /api/social-networks/catalog` y retorna `id`, `code` y `name`.
- **Tests:** componente/integración frontend y test MCP para `listar_catalogo_redes`.

**Restricciones explícitas:** no modificar contrato backend (payload ya espera `catalog_id`); `SocialNetworkSelector` es el único componente nuevo (sin subcomponentes); estilos propios en archivo CSS dedicado respetando tokens de `shared-form.css`.

## Capabilities

### New Capabilities

- `social-network-selector-ui`: Componente visual de selección y visualización de redes sociales del catálogo, con íconos SVG mapeados por `code`, modos edición y lectura, y consumo del endpoint de catálogo.

### Modified Capabilities

- `suppliers-admin`: UI de proveedores usa selector de catálogo en lugar de tabla de texto libre; form state y payload de create/update envían `catalog_id` + `account_name`.
- `supplier-form-layout`: `SupplierSocialNetworksSection` delega en `SocialNetworkSelector`; elimina tabla editable y handlers de filas dinámicas.
- `backend-mcp-server`: herramienta `listar_catalogo_redes`; descripciones actualizadas de `crear_proveedor` y `actualizar_proveedor` para redes con `catalog_id`.

## Impact

- **Frontend:** nuevo `SocialNetworkSelector.jsx` + CSS; assets SVG en `frontend/src/assets/social-networks/`; `SupplierFormSections.jsx`, `SupplierUpsertPage.jsx`, `suppliersApi.js`; posibles tests de componente/página.
- **MCP:** `backend/mcpTools.mjs`; test en `backend/test/mcpServer.test.js`.
- **Backend API:** sin cambios de código (endpoints ya implementados).
- **Operacional:** tras desplegar MCP, reiniciar Claude Desktop para registrar `listar_catalogo_redes`.

## Consideraciones de seguridad

- El catálogo no contiene PII; los handles de cuenta (`account_name`) son datos de negocio ya manejados en el módulo de proveedores.
- `GET /api/social-networks/catalog` requiere autenticación y permiso `read` sobre `Supplier` — el frontend y MCP heredan la sesión/token existente.
- Validación client-side complementa la del backend: no enviar redes seleccionadas sin `account_name` completo; mensajes de error en español (es-CL).
- Los íconos SVG son assets estáticos locales; no cargar recursos externos en runtime.
