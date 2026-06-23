## Context

Incrementa-gestion ya modela la contraparte contractual vía **Proveedores** (`supplier`, CASL `Supplier`, UI bajo Administración global) y la parte Incrementa vía **Empresa**. Los contratos de campaña requieren además identificar la **marca/cliente** para quien se ejecuta la campaña. No existe tabla ni API de clientes; `draft_document` solo referencia `supplier_id` y `company_id`; `buildSubstitutionMap(supplier, company, overrides)` no expone variables de cliente. El MCP expone listado/generación de contratos sin `clientId`.

El stack actual usa Knex + PostgreSQL, Express con `authorize(action, subject)` (CASL), y frontend React con patrón de páginas Proveedores (`SupplierListPage`, tabs, tabla editable de hijos). El perfil `ADMINISTRADOR_PLATAFORMA` ya tiene `manage/all`; permisos granulares se definen en `permissionsCatalog.js` y seeds de roles.

## Goals / Non-Goals

**Goals:**

- Persistir clientes (`client`) y campañas de producto anidadas (`client_product_campaign`) con auditoría `created_by` / `updated_by`.
- CRUD REST `/api/clients` con autorización CASL subject `Client` (`read`, `create`, `update`).
- UI de administración (listado, vista, crear/editar) idéntica en estructura y estilos a Proveedores.
- Variables de plantilla `client_name`, `client_brand`, `client_brand_account` opcionales en generación.
- Paso opcional de cliente en Constructor de Documento; `client_id` nullable en `draft_document`.
- MCP: `listar_clientes` y `clientId` opcional en `validar_contrato` / `generar_contrato`.

**Non-Goals:**

- Subject CASL `ClientProductCampaign` o endpoints separados para campañas.
- Eliminar clientes (soft/hard delete).
- Mostrar `client_id` en listados de borradores existentes.
- Obligar `clientId` en API, UI o MCP.
- Migración de permisos para `ADMINISTRADOR_PLATAFORMA`.
- Cambiar la clave de borrador duplicado (`findActiveDuplicateDraft`).

## Decisions

### 1. Modelo de datos en dos migraciones ordenadas

**Decisión:** `202606010002_create_client_tables.js` crea `client` + `client_product_campaign`; `202606010003_add_client_to_draft_document.js` agrega `client_id` a `draft_document`.

**Rationale:** La segunda migración depende de `client.id` existente; orden explícito evita fallos en `migrate:latest`. `ON DELETE CASCADE` en campañas; `ON DELETE SET NULL` en `draft_document.client_id` preserva borradores si se eliminara un cliente (aunque delete no esté en alcance).

**Alternativa descartada:** Una sola migración — válida, pero el brief exige dos archivos para claridad de despliegue parcial.

### 2. Replace-all de campañas en update (patrón Proveedores)

**Decisión:** `createClient` / `updateClient` reciben `product_campaigns: [{ name }]`; en update se hace `DELETE` de filas hijas + `INSERT` con `sort_order` según índice del array, dentro de transacción Knex.

**Rationale:** Misma semántica que `supplier_social_network`; evita diffing de IDs en UI editable.

### 3. CASL subject `Client` sin hijo propio

**Decisión:** Un solo subject en `permissionsCatalog.js` insertado después de `Supplier`. Campañas solo mutables vía POST/PUT del cliente.

**Rationale:** Reduce superficie de autorización y coincide con restricción del brief.

### 4. `buildSubstitutionMap(supplier, company, client, overrides)`

**Decisión:** Tercer parámetro `client` nullable; si null, claves `client_*` son `undefined`/vacío según comportamiento actual de placeholders. Actualizar todas las llamadas en `documentBuilderService.js` (y tests).

**Rationale:** Firma explícita evita mezclar cliente en `overrides` ad hoc.

### 5. Cliente opcional en flujo de generación

**Decisión:** `generateAndPersist` acepta `clientId` opcional; si viene, `getClientById`; si no existe → 400 español; si omitido → `client_id` NULL en INSERT. Duplicado activo no incluye `client_id`.

**Rationale:** Un mismo proveedor+empresa+plantilla+mes puede reutilizarse para distintas marcas sin bloquear generación; el brief lo exige explícitamente.

### 6. UI: menú bajo `admin_global` en `/app/admin-global/clientes`

**Decisión:** Ítem `clientes` en `menuConfig.js` después de `proveedores`, `navCode` `NAV_ITEM_ADMIN_GLOBAL_CLIENTES`, `RequireCan` `{ action: 'read', subject: 'Client' }`. Páginas copian clases y tabs de Proveedores; campañas = tabla editable tipo redes sociales.

**Nota:** Proveedores sigue en `/app/proveedores`; Clientes usa ruta admin-global según brief.

**Alternativa:** Mover Proveedores a admin-global — fuera de alcance.

### 7. Estado de cliente en Document Builder

**Decisión:** Preferir consistencia con proveedor: si Redux `documentBuilder` ya guarda `selectedSupplierId`, agregar `selectedClientId` al mismo slice; si la página usa state local para supplier, replicar el patrón dominante tras leer `DocumentBuilderPage.jsx`.

**Rationale:** Minimiza divergencia entre pasos del wizard.

### 8. MCP: inyección de `clientService`

**Decisión:** Instanciar en `mcp.mjs`, pasar en `deps` a `registerMcpTools`; `listar_clientes` delega a `listClients`. Extender `contractParams` Zod con `clientId: z.string().uuid().optional()`.

**Rationale:** Mismo patrón que `supplierService` / `standardTemplatesService`.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Migración 003 antes de 002 falla FK | Nombres de archivo con timestamp ordenado; documentar en tasks |
| Placeholders `client_*` en plantillas sin cliente seleccionado | Variables opcionales; dry-run reporta `MISSING_PLACEHOLDERS` solo si plantilla las exige y no hay override |
| Replace-all borra campañas si UI envía array vacío por error | Validar al menos cero filas permitido vs requerir ≥1 — alinear con Proveedores (redes pueden ser vacías); campañas pueden ser lista vacía si negocio lo permite |
| MCP desactualizado en Claude Desktop | Documentar reinicio tras deploy de herramientas |
| Rutas admin-global vs proveedores inconsistentes | Solo Clientes usa nueva ruta; no refactorizar Proveedores en este cambio |

## Migration Plan

1. Desplegar backend con migraciones `202606010002` luego `202606010003` (`npm run migrate:latest` en backend).
2. Desplegar backend con `permissionsCatalog` actualizado (roles existentes con `manage/all` no requieren seed).
3. Desplegar frontend con menú y páginas.
4. Reiniciar Claude Desktop si se usa MCP local.
5. **Rollback:** `knex migrate:rollback` en orden inverso (003 quita columna; 002 drop tablas). Borradores con `client_id` quedarían NULL tras rollback de 003.

## Open Questions

- ¿Validar `product_campaigns` con al menos una fila en create? Por analogía con redes sociales (opcional), se permite lista vacía salvo que negocio indique lo contrario en implementación.
- ¿Ícono sidebar para `NAV_ITEM_ADMIN_GLOBAL_CLIENTES`? Añadir entrada en `sidebarIconography.jsx` siguiendo convención de otros ítems admin-global.
