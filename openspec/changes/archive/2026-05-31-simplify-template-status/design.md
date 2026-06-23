## Context

La tabla `template` tiene columna `status` con check constraint `IN ('draft', 'active', 'inactive')` (migración `202604160009`), default `'active'`. El servicio `standardTemplatesService` usa `'draft'` como default en create/update y valida los tres valores. La UI admin (`StandardTemplateEditor.jsx`) ofrece selector con Borrador/Activo/Inactivo; nuevas plantillas se crean con status `'draft'`. El util `mapTemplateStatusToSpanish` devuelve "Borrador" para cualquier valor desconocido.

El listado admin (`StandardTemplatesListPage`) muestra todas las plantillas sin filtrar por status — comportamiento deseado que se mantiene. El dashboard (`dashboardService.js`) ya cuenta solo plantillas `active`. MCP `listar_plantillas` hoy devuelve todas las plantillas (activas e inactivas), lo cual no es adecuado para flujos conversacionales.

Restricciones del brief: no tocar seeds, dashboard, firma REST del listado admin, ni agregar filtro de status en la página de listado.

## Goals / Non-Goals

**Goals:**

- Reducir estados válidos a `active` e `inactive` en BD, servicio y UI.
- Migrar datos existentes `draft` → `inactive` de forma idempotente.
- Default de nuevas plantillas: `inactive` (servicio + columna BD).
- MCP expone solo plantillas activas vía filtro interno en `listStandardTemplates({ status: 'active' })`.
- Etiquetas UI en es-CL: Activo / Inactivo; sin opción Borrador.

**Non-Goals:**

- Cambiar `dashboardService.js`, seeds, o `documentBuilderService` en este ajuste.
- Exponer query param `status` en `GET /api/standard-templates`.
- Agregar filtro de status en `StandardTemplatesListPage`.
- Modificar estados de `draft_document` (tabla distinta; "borrador" de contrato ≠ status de plantilla).

## Decisions

### 1. Migración de datos y constraint

**Decisión:** migración `202606010001_simplify_template_status.js` con secuencia:

1. `UPDATE template SET status = 'inactive' WHERE status = 'draft'`
2. `DROP CONSTRAINT template_status_check`
3. `ADD CONSTRAINT template_status_check CHECK (status IN ('active', 'inactive'))`
4. `ALTER COLUMN status SET DEFAULT 'inactive'`

**Down:** restaurar constraint con `draft`, default `'active'`, y opcionalmente `UPDATE ... SET status = 'draft' WHERE status = 'inactive'` solo si se desea reversión simétrica (documentar que datos migrados no se distinguen de inactivos nativos).

**Alternativa descartada:** mantener `draft` en BD pero ocultarlo en UI — no elimina deuda técnica ni alinea MCP.

### 2. Filtro `status` solo en servicio (no en REST admin)

**Decisión:** añadir parámetro opcional `status` a `listStandardTemplates`. Si presente y válido (`'active'` | `'inactive'`), añadir `.where('t.status', status)`. MCP lo usa con `'active'`; el controlador REST admin no lo expone (sin cambio de contrato público).

**Alternativa descartada:** filtrar en handler MCP con query Knex duplicada — viola DRY y el brief pide centralizar en el servicio.

### 3. Defaults y validación en CRUD

**Decisión:** en `createStandardTemplate` y `updateStandardTemplate`:

- Destructuring default: `status = 'inactive'`
- Validación: `['active', 'inactive'].includes(status) ? status : 'inactive'`

Create desde UI seguirá enviando `'inactive'` explícitamente en payload (modo create fuerza inactive en editor).

### 4. Frontend editor

**Decisión:**

- `useState('inactive')` inicial; fallback al cargar: `'inactive'` si status no reconocido.
- Modo create: label readonly "Inactivo" (`mapTemplateStatusToSpanish('inactive')`); payload `status: 'inactive'`.
- Modo edit: `<select>` solo `active` e `inactive`; eliminar `<option value="draft">`.

**Alternativa descartada:** permitir elegir Activo al crear — el brief fija create como inactivo (consistente con default BD).

### 5. Util de etiquetas

**Decisión:** `mapTemplateStatusToSpanish`: fallback `'Inactivo'` en lugar de `'Borrador'` para valores desconocidos o legados post-migración.

## Risks / Trade-offs

- **[Riesgo] Plantillas `draft` indistinguibles de `inactive` tras migración** → Mitigación: aceptado por decisión de negocio; ambos se tratan como inactivos.
- **[Riesgo] Down migration no restaura qué filas eran `draft`** → Mitigación: documentar en runbook; rollback de schema sin reversión semántica de datos.
- **[Riesgo] Tests y mocks aún usan `status: 'draft'`** → Mitigación: actualizar `standardTemplatesApi.test.js`, `mcpServer.test.js` y cualquier test de template status en implementación.
- **[Trade-off] Document Builder no filtra por `active` en código actual** → Fuera de alcance; brief indica comportamiento heredado del endpoint; no modificar en este cambio.

## Migration Plan

1. Desplegar migración en local: `cd backend && knex migrate:latest` (con env cargado).
2. Desplegar backend + frontend.
3. Verificar listado admin: filas antes `draft` muestran "Inactivo".
4. Reiniciar Claude Desktop; invocar `listar_plantillas` y confirmar solo status `active`.
5. Crear plantilla nueva: debe persistir como `inactive` y mostrarse como Inactivo.

**Rollback:** `knex migrate:rollback` revierte constraint/default; datos `inactive` no vuelven automáticamente a `draft`.

## Open Questions

- Ninguna bloqueante: el cliente confirmó equivalencia Borrador/Inactivo y las decisiones de arquitectura están fijadas en el brief.
