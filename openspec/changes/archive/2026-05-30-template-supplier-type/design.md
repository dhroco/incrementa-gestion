## Context

La tabla `template` almacena el contenido y metadatos de plantillas estándar (vía join con `template_standard`). Hoy no existe distinción por tipo de proveedor; el servicio `standardTemplatesService` expone CRUD y listado sin ese campo, y `documentBuilderService.listEligibleTemplates` devuelve todas las plantillas estándar activas sin filtro.

Los proveedores ya usan `supplier_type` con valores `'persona_natural' | 'empresa'` (migración `202605290005`). El objetivo de este ajuste es alinear plantillas con ese mismo vocabulario en backend y BD, sin tocar frontend ni MCP en esta entrega.

Restricciones del brief:
- Columna NOT NULL con check constraint en `template`.
- No modificar `template_standard` ni migraciones previas.
- Migración debe limpiar seeds `PLANTILLA-*` y fijar `PL0001` antes de aplicar NOT NULL.
- Campo obligatorio en create/update (servicio + controlador).

## Goals / Non-Goals

**Goals:**
- Persistir `supplier_type` en cada fila de `template`.
- Exponer y validar `supplier_type` en API de plantillas estándar (list/create/update/get).
- Permitir filtro opcional `?supplier_type=` en listados de `/api/standard-templates` y `/api/document-builder/templates`.
- Incluir `supplier_type` en respuestas mapeadas (`mapTemplateRow`, items de listado, items de Document Builder).
- Cubrir con tests de servicio/API los caminos felices y validaciones.

**Non-Goals:**
- UI de administración de plantillas (selector de tipo, formulario).
- Filtrado automático en Document Builder según proveedor seleccionado (frontend).
- Cambios en MCP `listar_plantillas`.
- Actualización de seeds GFA (`006_gfa_template_seed.js`) — queda para ajuste posterior; la migración elimina filas conflictivas en BD existente.
- Modificar tabla `template_standard`.

## Decisions

### 1. Nombre y valores de columna

**Decisión:** columna `supplier_type` (`text`/`varchar`) con check `IN ('persona_natural', 'empresa')`, mismos literales que tabla `supplier`.

**Alternativa descartada:** enum PostgreSQL nativo — el proyecto ya usa check constraints textuales en `supplier` y conviene mantener consistencia.

### 2. Orden de operaciones en migración `202605300020_template_supplier_type.js`

Secuencia en `up`:

1. Agregar columna `supplier_type` **nullable** (si no existe).
2. Eliminar plantillas cuyo `code` cumpla `code ILIKE 'PLANTILLA-%'`:
   - Borrar dependencias en orden seguro: `document` (si existe `template_id`), `draft_document` (si existe), `template_standard`, luego `template`.
3. `UPDATE template SET supplier_type = 'empresa' WHERE code = 'PL0001'`.
4. `ALTER COLUMN supplier_type SET NOT NULL`.
5. Agregar constraint `template_supplier_type_check` si no existe.

**Rationale:** evita fallo al aplicar NOT NULL sobre filas seed sin valor. PL0001 recibe valor explícito antes del constraint.

**Alternativa descartada:** default global `'empresa'` para todas las filas restantes — el brief solo autoriza asignación explícita a PL0001; otras filas productivas deben ya tener valor o no existir tras limpieza.

### 3. Validación compartida en servicio

**Decisión:** helper local en `standardTemplatesService.js`:

```javascript
const VALID_SUPPLIER_TYPES = ['persona_natural', 'empresa']

function normalizeSupplierType(value) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return VALID_SUPPLIER_TYPES.includes(v) ? v : null
}
```

- `createStandardTemplate` / `updateStandardTemplate`: si `normalizeSupplierType` retorna `null`, devolver `{ ok: false, error: { type: 'invalid_supplier_type', message: '...' } }`.
- Controlador traduce a HTTP 400 con código `TEMPLATE_INVALID_SUPPLIER_TYPE`.

**Alternativa descartada:** validar solo en controlador — duplicaría lógica si MCP u otros consumidores llaman al servicio directamente.

### 4. Filtrado en listados

**Decisión:**
- `listStandardTemplates({ search, supplier_type })`: si `supplier_type` normalizado es válido, añadir `where('t.supplier_type', supplierType)`; si el param viene pero es inválido, ignorar filtro (o devolver 400 desde controlador — preferir **400 en controlador** si query param presente pero inválido).
- `listEligibleTemplates`: aceptar `supplierType` opcional; filtrar query Knex igual que arriba; incluir `supplier_type` en cada item del response.

**Document Builder controller:** leer `req.query.supplier_type`, validar si presente, pasar a servicio.

**Standard templates controller:** mismo patrón en `getList`.

### 5. Select columns y mapTemplateRow

**Decisión:** añadir `t.supplier_type` a `selectAuthorColumns()` y al select del listado; extender `mapTemplateRow` y el mapper inline de `listStandardTemplates` con `supplier_type`.

### 6. documentBuilderService vs reutilizar standardTemplatesService

**Decisión:** mantener query propia en `listEligibleTemplates` (patrón actual) pero añadir columna y filtro allí. No refactorizar para delegar en `standardTemplatesService` en este cambio — minimiza diff.

**Alternativa descartada:** unificar en un solo servicio — fuera de alcance del ajuste 1.

## Risks / Trade-offs

- **[Riesgo] Filas `template` productivas distintas de PL0001 sin `supplier_type` tras limpieza** → Mitigación: la migración solo asigna PL0001; si quedan otras filas NULL al SET NOT NULL, la migración fallará explícitamente en deploy, forzando corrección manual antes de producción.
- **[Riesgo] Seeds GFA insertan plantillas sin `supplier_type`** → Mitigación: migración elimina códigos `PLANTILLA-*`; re-seed local fallará hasta actualizar seed en cambio futuro.
- **[Riesgo] Document Builder sin filtro en frontend muestra todas las plantillas** → Mitigación: aceptado en non-goals; el backend ya expone el param para el ajuste 2 frontend.
- **[Trade-off] Duplicación de filtro Knex** entre `standardTemplatesService` y `documentBuilderService` → Aceptado por alcance mínimo.

## Migration Plan

1. Desplegar migración `202605300020_template_supplier_type.js` en local/dev/prod vía `knex migrate:latest`.
2. Desplegar backend con servicio/controladores actualizados.
3. Verificar que `GET /api/standard-templates` y create/update exigen `supplier_type`.
4. Verificar `GET /api/document-builder/templates?supplier_type=persona_natural` filtra correctamente.

**Rollback (`down`):** eliminar constraint, eliminar columna `supplier_type`. No restaura filas `PLANTILLA-*` eliminadas — rollback de datos no es reversible; documentar en runbook.

## Open Questions

- Ninguna bloqueante: el brief fija valores, endpoints y orden de migración. Confirmar en implementación si existen filas `template` además de PL0001 que requieran backfill manual en dev/prod (fuera de seeds `PLANTILLA-*`).
