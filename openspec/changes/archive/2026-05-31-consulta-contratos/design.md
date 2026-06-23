## Context

Incrementa-gestion persiste contratos en dos tablas: `draft_document` (borradores en proceso de firma, estados `draft`, `pending_signature`, etc.) y `document` (contratos firmados). Los PDFs viven en GCS; metadatos consultables (fecha de contrato, red social, precio, cliente) solo existen en memoria durante `generateAndPersist` como `overrides` pre-procesados. No hay API ni UI de consulta unificada.

El stack usa Knex + PostgreSQL, Express con `authorize(action, subject)` (CASL), `gcsService.downloadBuffer` para PDFs (patrón en `supplierController.getDocumentView`), y frontend React con páginas tipo ERP compactas. El módulo Clientes ya existe (`client_id` en `draft_document`); la migración añade `client_id` también en `document` para firmados.

## Goals / Non-Goals

**Goals:**

- Persistir `contract_overrides` JSONB en `draft_document` (al generar) y en `document` (schema listo para firmados).
- Servicio `listContracts` con UNION ALL, filtros compartidos, paginación offset/limit (18/página), exclusión global de `rejected`.
- Endpoints `GET /api/contracts` y `GET /api/contracts/:id/pdf?source=draft|signed` con CASL `Contract` / `read`.
- UI `ContractsListPage` bajo Gestión de Contratos: filtros con debounce, tabla, paginación, PDF vía fetch+blob.

**Non-Goals:**

- Backfill de `contract_overrides` en contratos históricos.
- Escritura/edición desde consulta; firma de contratos.
- Filtro por empresa; cursor pagination.
- MCP tools para consulta.
- Migración de permisos seed para roles existentes (admin ya tiene `manage/all`).

## Decisions

### 1. Migración `202606010005_add_contract_overrides.js` como prerequisito

**Decisión:** Agregar `contract_overrides` JSONB nullable + índice GIN en `draft_document` y `document`; `client_id` UUID nullable FK → `client` ON DELETE SET NULL solo en `document`.

**Rationale:** JSONB permite filtrar por claves (`proveedor_red_social`) con `->>` e ILIKE; GIN acelera búsquedas futuras. `client_id` en `document` desacopla la consulta de firmados del borrador origen.

**Alternativa descartada:** Tabla normalizada `contract_metadata` — más joins, fuera del alcance del brief.

### 2. Persistir overrides ya pre-procesados en `generateAndPersist`

**Decisión:** Tras `preprocessMissingFieldOverrides(overridesRaw)`, guardar el objeto resultante en INSERT: `contract_overrides: JSON.stringify(overrides)` (Knex serializa JSONB).

**Rationale:** Los valores mostrados en consulta coinciden con lo impreso en PDF (precio formateado es-CL, fechas resueltas). No re-ejecutar `buildSubstitutionMap` en listado.

**Alternativa descartada:** Extraer campos desde PDF o TipTap — costoso e impreciso.

### 3. UNION ALL con Knex raw para listado unificado

**Decisión:** Dos subqueries (draft + signed) con columnas homogéneas; envolver en `(?) UNION ALL (?)`, contar con subquery externa, paginar con `ORDER BY created_at DESC LIMIT/OFFSET`.

**Filtros aplicados dentro de cada subquery antes del UNION:**

| Filtro | SQL |
|--------|-----|
| `supplierSearch` | `(supplier.full_name ILIKE ? OR supplier.razon_social ILIKE ?)` |
| `clientId` | `client_id = ?` |
| `templateId` | `template_id = ?` |
| `redSocialSearch` | `contract_overrides->>'proveedor_red_social' ILIKE ?` |
| `status: draft` | solo subquery draft |
| `status: signed` | solo subquery document |
| `status: all` | ambas; draft excluye `rejected` |

**Rationale:** Una sola paginación sobre el conjunto ordenado por fecha; patrón explícito en brief.

**Alternativa descartada:** Dos queries separadas + merge en memoria — paginación incorrecta.

### 4. Mapeo de campos desde `contract_overrides`

**Decisión:** En el service, `const o = row.contract_overrides ?? {}`; exponer `fecha_contrato`, `mes_ejecucion`, `proveedor_red_social`, `proveedor_cuenta_social`, `precio_numero` como propiedades planas del item.

**Rationale:** Frontend simple; contratos pre-migración muestran "—" sin error.

### 5. Endpoint PDF unificado

**Decisión:** `contractsController.getPdf`: validar `source ∈ {draft, signed}`; cargar fila por id; `gcsService.downloadBuffer`; headers `Content-Type: application/pdf`, `Content-Disposition: inline`; mismo sanitizado de filename que suppliers.

**Rationale:** Reutiliza infraestructura GCS; no expone paths; `window.open` directo no lleva JWT — frontend usa fetch+blob (patrón `SupplierDocumentHistoryPanel.openPdfBlob`).

### 6. CASL subject `Contract`

**Decisión:** Insertar en `permissionsCatalog.js` después de `DocumentBuilder`: `{ id: 'Contract', label: 'Consulta de contratos' }`, actions `['read']`.

**Rationale:** Permiso de solo lectura acotado; coherente con dashboard/widgets read-only.

### 7. Frontend: filtros y UX

**Decisión:**

- Barra horizontal de filtros: proveedor y red social con debounce 300ms; selects de cliente (`fetchClientsList`) y plantilla (`fetchStandardTemplates`, todas); estado (Todos / En proceso de firma / Firmados).
- Cambio de filtro → `page = 1`.
- Tabla con chips de tipo proveedor y badge estado (gris "En proceso", verde "Firmado").
- Paginación: « Anterior | Página X de Y | Siguiente » + total encontrados.
- Menú: `consulta_contratos` bajo `gestion_contratos`, `NAV_ITEM_CONTRATOS_CONSULTA`.

**Rationale:** Brief + guías ERP (tabla compacta, 13px, sin decoración).

## Risks / Trade-offs

- **[Contratos sin `contract_overrides`]** → Campos "—" en UI; aceptable según brief.
- **[UNION ALL performance con volumen alto]** → Índices GIN y filtros selectivos; offset pagination puede degradar en páginas altas — aceptable para volumen esperado.
- **[ `document.template_id` nullable ]** → Mostrar "—" si plantilla eliminada; no inferir desde borrador.
- **[PDF blob URLs]** → `URL.revokeObjectURL` tras timeout (60s) como en historial proveedor.
- **[Permisos no seedeados para roles no-admin]** → Requiere asignación manual en Roles y permisos; documentar en verificación.

## Migration Plan

1. Desplegar migración `202606010005` en dev/staging/prod vía `knex migrate:latest`.
2. Desplegar backend (service, controller, rutas, cambio en `generateAndPersist`).
3. Desplegar frontend (página, API, menú).
4. **Rollback:** `knex migrate:down` elimina columnas; endpoints nuevos inactivos tras revert de código. Datos en GCS intactos.

## Open Questions

- ¿Copiar `contract_overrides` y `client_id` al promover borrador → `document` en el flujo de firma? **Fuera de alcance** de este change; firmados posteriores a firma-with-overrides-copy tendrán datos; históricos pueden carecer hasta que exista ese flujo.
- ¿Icono sidebar para `NAV_ITEM_CONTRATOS_CONSULTA`? Usar ícono documento/search coherente con `sidebarIconography.jsx` (p. ej. `description` o `find_in_page`).
