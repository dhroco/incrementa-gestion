## Why

Las redes sociales de proveedores se almacenan hoy como texto libre (`network_name`), lo que impide validación consistente, iconografía uniforme en UI y extensión controlada del catálogo. Un catálogo maestro estructurado permite referenciar redes por ID, exponer metadatos estables (`code`, `name`) y mantener el orden de presentación del proveedor de forma independiente.

## What Changes

- Nueva tabla `social_network_catalog` con columnas `id` (UUID PK), `code` (texto único, minúsculas sin espacios), `name` (etiqueta legible) y `sort_order` (integer). Sin columna de ícono — los íconos se mapean en frontend por `code`.
- Migración que: crea la tabla, inserta 8 registros iniciales (Instagram, Facebook, LinkedIn, X, TikTok, YouTube, WhatsApp Business, Pinterest), limpia filas existentes de `supplier_social_network`, agrega columna `catalog_id` FK, elimina columna `network_name`.
- **BREAKING:** el payload de create/update de proveedor acepta `catalog_id` en cada elemento de `social_networks` en lugar de `network_name`.
- **BREAKING:** las respuestas de list/detail de proveedor devuelven `catalog_id`, `code`, `name` y `account_name` por red social (ya no `network_name`).
- `supplierService`: actualizar `validateSocialNetworks`, `mapSocialNetworkRow`, queries con JOIN a catálogo, e insert/select de redes.
- Nueva función `listSocialNetworkCatalog()` (en `supplierService` o servicio dedicado) que retorna el catálogo completo ordenado por `sort_order`.
- Nuevo endpoint `GET /api/social-networks/catalog` con `authorize('read', 'Supplier')` para consumo del frontend y MCP.
- Tests de migración, servicio y API.

**Restricciones explícitas:** sin CRUD de administración para `social_network_catalog` (solo migraciones). Sin cambios al contrato API de proveedor más allá de los campos de redes sociales. Alcance: base de datos y backend únicamente (sin frontend ni MCP en este ajuste).

## Capabilities

### New Capabilities

- `social-network-catalog`: Tabla maestra de redes sociales, seed inicial, endpoint de lectura del catálogo y función de servicio reutilizable.

### Modified Capabilities

- `suppliers-admin`: Esquema de `supplier_social_network` referencia catálogo vía FK; validación y respuestas API de redes sociales usan `catalog_id` + campos del catálogo en lugar de `network_name` libre.

## Impact

- **Base de datos:** nueva migración `202605300021_*` (o siguiente número disponible); tabla `social_network_catalog`; refactor de `supplier_social_network`.
- **Backend:** `supplierService.js`, `supplierController.js` (handler del catálogo), `app.js` (ruta nueva); tests en `supplierApi.test.js` y posible test de servicio/migración.
- **Frontend / MCP:** sin cambios en este ajuste; consumidores migrarán a `catalog_id` y al endpoint de catálogo en ajustes posteriores.
- **Datos:** entorno de desarrollo sin datos productivos — la migración puede truncar `supplier_social_network` antes del cambio estructural.

## Consideraciones de seguridad

- El catálogo no contiene datos personales; solo metadatos de plataformas.
- `catalog_id` debe validarse contra filas existentes en `social_network_catalog` para evitar referencias arbitrarias.
- El endpoint del catálogo requiere autenticación OIDC global y permiso CASL `read` sobre `Supplier`, coherente con el módulo de proveedores.
- Mensajes de validación en español (es-CL) para payloads inválidos de redes sociales.
