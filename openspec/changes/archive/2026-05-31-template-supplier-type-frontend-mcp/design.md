## Context

El cambio previo `template-supplier-type` (BD y Backend) ya implementó:
- Columna `supplier_type` NOT NULL en `template` con check constraint.
- CRUD backend que exige y devuelve `supplier_type`.
- Filtro opcional `?supplier_type=` en `GET /api/standard-templates` y `GET /api/document-builder/templates`.

El frontend de plantillas (`StandardTemplateEditor`, `StandardTemplatesListPage`, `StandardTemplateViewPage`) aún no captura ni muestra el campo. El Constructor (`DocumentBuilderPage`) carga plantillas sin filtrar por tipo del proveedor seleccionado. MCP `listar_plantillas` solo acepta `search`.

Restricciones del brief:
- Reutilizar patrón `<select className="clause-input">` del editor de plantillas (como el selector de Estado en modo editar).
- No crear componente nuevo para el selector de tipo.
- No modificar `app.js` ni rutas backend.

## Goals / Non-Goals

**Goals:**
- Capturar `supplier_type` obligatorio en formularios de crear/editar plantilla.
- Mostrar tipo de proveedor en listado y vista de plantilla.
- Filtrar automáticamente plantillas en Constructor según `supplier_type` del proveedor seleccionado.
- Exponer `supplier_type` opcional en MCP `listar_plantillas`.
- Actualizar API clients y tests afectados.

**Non-Goals:**
- Cambios en backend (servicios, controladores, migraciones).
- Selector manual de tipo en Constructor (el filtro es automático e invisible).
- Actualización de seeds GFA.
- Nuevo componente reutilizable de tipo de proveedor (usar `<select>` nativo, no radio chips como en `SupplierFormSections`).

## Decisions

### 1. Selector de tipo en formulario de plantilla

**Decisión:** `<select className="clause-input">` con opciones `persona_natural` → "Persona Natural" y `empresa` → "Empresa", colocado en el panel de metadatos junto a Nombre/Código (misma fila o fila dedicada según espacio).

**Alternativa descartada:** radio buttons con `SupplierTypeChip` (patrón de proveedores) — el brief prohíbe componente nuevo y pide patrón de select existente en formularios de plantilla.

**Default en create:** `'persona_natural'` (consistente con `SupplierFormSections`).

**Validación client-side:** incluir `supplier_type` válido en `canSubmit` junto a `name` y `code`; enviar en payload de create/update.

### 2. Visualización en listado y vista

**Decisión:**
- **Listado:** nueva columna sortable `supplier_type` con etiqueta "Tipo de proveedor", renderizando `SupplierTypeChip` (componente existente de solo lectura).
- **Vista:** campo read-only con `SupplierTypeChip` o texto equivalente en panel de metadatos.

**Alternativa descartada:** texto plano sin chip — el chip ya se usa en listados de proveedores y Constructor; mantiene consistencia visual.

### 3. Filtrado automático en Document Builder

**Decisión:**
1. Derivar `selectedSupplier` de `suppliers` + `selectedSupplierId` (ya existe patrón similar para mostrar chip).
2. Extender `fetchDocumentBuilderTemplates` para aceptar `supplierType` y añadir `supplier_type` al query string.
3. Pasar `selectedSupplier?.supplier_type` en el `useEffect` que carga plantillas (línea ~133 de `DocumentBuilderPage.jsx`).
4. Re-fetch plantillas cuando cambie proveedor (ya depende de `stage1Ok` / `selectedSupplierId`).
5. Limpiar `templateSelected` si el proveedor cambia y la plantilla previa no coincide (via `resetDocumentBuilder` parcial o efecto al cambiar supplier).

**Alternativa descartada:** filtrar client-side sobre lista completa — desperdicia ancho de banda y expone plantillas incompatibles en network tab; el backend ya soporta filtro.

### 4. documentBuilderApi helper

**Decisión:** extender `withCompany` o crear helper que también acepte `supplierType`:

```javascript
export async function fetchDocumentBuilderTemplates({ companyId, supplierType, accessToken, signal } = {}) {
  const qs = new URLSearchParams()
  if (companyId) qs.set('companyId', companyId)
  if (supplierType) qs.set('supplier_type', supplierType)
  // ...
}
```

No cargar plantillas hasta que haya proveedor seleccionado (`stage1Ok`) — comportamiento actual preservado, solo se añade param.

### 5. MCP listar_plantillas

**Decisión:** añadir parámetro Zod opcional:

```javascript
supplier_type: z.enum(['persona_natural', 'empresa']).optional()
  .describe('Filtrar por tipo de proveedor; usar una vez conocido el supplier_type del proveedor')
```

Pasar a `standardTemplatesService.listStandardTemplates({ search, supplier_type })`.

Actualizar descripción de herramienta para indicar que Claude debe usar `supplier_type` después de identificar el proveedor.

**Alternativa descartada:** filtrar en MCP post-query — el servicio ya soporta filtro nativo.

### 6. Tests

**Decisión:**
- `DocumentBuilderPage.test.jsx`: verificar que la llamada API incluye `supplier_type` del proveedor mock.
- `mcpServer.test.js`: caso con `supplier_type` en `listar_plantillas`.
- Tests de plantillas frontend si existen; si no, validación manual documentada en tasks.

## Risks / Trade-offs

- **[Riesgo] Plantilla seleccionada queda inválida al cambiar proveedor de tipo distinto** → Mitigación: limpiar selección de plantilla al cambiar `selectedSupplierId` (dispatch `setTemplateSelected(null)` o reset parcial).
- **[Riesgo] Plantillas existentes en BD sin tipo en respuesta cacheada** → Mitigación: backend ya incluye campo; no aplica si API está actualizada.
- **[Riesgo] Claude Desktop no ve nuevo param MCP hasta reinicio** → Mitigación: documentar en tasks/README operacional.
- **[Trade-off] Select nativo vs chips en formulario plantilla** → Aceptado por restricción del brief; chips solo en display read-only.

## Migration Plan

1. Desplegar frontend con cambios de UI y API client.
2. Desplegar backend MCP (`mcpTools.mjs`) si no está ya en mismo release.
3. Reiniciar Claude Desktop en estaciones de desarrollo que usen MCP local.
4. Verificar flujo: crear plantilla con tipo → listar con columna → Constructor filtra al seleccionar proveedor → MCP `listar_plantillas` con `supplier_type`.

**Rollback:** revertir frontend/MCP; backend sigue compatible (campo obligatorio en API — formularios antiguos sin tipo fallarían al guardar, por lo que rollback frontend implica no editar plantillas hasta re-desplegar).

## Open Questions

- Ninguna bloqueante: el brief define UI, endpoints y restricciones. Confirmar en implementación si `StandardTemplateViewPage` usa el mismo panel de metadatos que el editor o layout propio (solo afecta ubicación del campo read-only).
