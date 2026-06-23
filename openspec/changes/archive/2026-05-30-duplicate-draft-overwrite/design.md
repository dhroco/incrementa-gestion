## Context

`documentBuilderService.generateAndPersist` crea un PDF, lo sube a GCS y registra una fila en `draft_document`. No hay hoy ninguna regla que impida múltiples borradores activos para la misma combinación proveedor + empresa + plantilla en el mismo mes calendario (zona `America/Santiago`, ya usada por `yearMonthInSantiago()` y `buildDraftGcsPath`).

El frontend (`DocumentBuilderPage`) llama a `postDocumentBuilderGenerate` vía `runGenerate` y solo maneja éxito, `MISSING_PLACEHOLDERS` (422) y errores genéricos. Existe `ConfirmDialog` reutilizable para confirmaciones modales.

Estados terminales `signed` y `rejected` no deben bloquear una nueva generación del mes — solo borradores aún activos.

## Goals / Non-Goals

**Goals:**

- Detectar duplicados activos antes de generar el PDF (después de validaciones de entrada y placeholders).
- Responder 409 `DUPLICATE_DRAFT` con metadatos del borrador existente cuando no hay confirmación de overwrite.
- Permitir reemplazo explícito (`overwrite: true`) eliminando GCS + registro BD tras re-validación.
- Mostrar modal de confirmación en frontend con estado traducido y fecha en es-CL.

**Non-Goals:**

- Migraciones, índices únicos en BD o cambios de esquema.
- Bloquear generación cuando el duplicado está `signed` o `rejected`.
- Cambios en descarga, historial de proveedores u otros flujos fuera del Constructor de Documentos.
- Soft-delete o auditoría del borrador reemplazado.

## Decisions

### 1. Criterio de duplicado: año/mes en America/Santiago sobre `created_at`

Usar `yearMonthInSantiago()` para obtener `{ year, month }` y filtrar con `EXTRACT(YEAR FROM created_at AT TIME ZONE 'America/Santiago')` y `EXTRACT(MONTH FROM ...)` — o equivalente Knex/raw coherente con la zona horaria del servicio.

**Alternativa descartada:** comparar solo el segmento año/mes del `gcs_path`. Es más frágil si cambia la convención de rutas.

**Alternativa descartada:** constraint UNIQUE en BD. El usuario indicó explícitamente lógica de negocio sin migración.

### 2. Estados excluidos del duplicado

`status NOT IN ('signed', 'rejected')`. Cualquier otro valor (`draft`, `pending_signature`, etc.) cuenta como activo.

### 3. Punto de inserción en `generateAndPersist`

La consulta de duplicado va **después** de validar placeholders (422) y **antes** de generar bytes PDF / subir a GCS. Así no se gasta CPU ni storage si hay conflicto.

Si `overwrite === true`, ejecutar eliminación solo si la consulta vuelve a encontrar el registro (mismo criterio). Orden recomendado:

1. Re-consultar duplicado dentro de transacción Knex.
2. Si existe: `gcsService.deleteFile({ gcsPath })`, luego `DELETE FROM draft_document WHERE id = ?`.
3. Si no existe (condición de carrera): continuar sin error — el overwrite es idempotente ante ausencia.

GCS delete fuera de la transacción SQL es aceptable; si falla GCS, abortar y no borrar BD (o viceversa documentado en riesgos).

### 4. Forma de respuesta 409

Servicio retorna:

```js
{
  ok: false,
  status: 409,
  code: 'DUPLICATE_DRAFT',
  message: 'Ya existe un contrato generado para este proveedor con esta plantilla en el mismo mes.',
  data: { existing: { id, file_name, created_at, status } }
}
```

El controller ya propaga `r.data` en `meta` vía `sendError`. Mensaje en español (es-CL).

### 5. Propagación al frontend

`apiClient.apiPost` hoy no expone `meta` en respuestas de error. Extender el handler de error (patrón similar a `missingFieldKeys`) para incluir `meta` completo o al menos `existing` cuando `code === 'DUPLICATE_DRAFT'`.

**Alternativa descartada:** handler especial en controller que ponga `existing` dentro de `error` — funciona pero rompe el patrón meta ya usado por el controller.

### 6. UI: reutilizar `ConfirmDialog`

Estado local en `DocumentBuilderPage`:

- `duplicateDraft` — objeto `existing` del 409, o null.
- `pendingGenerate` — `{ renderEngine }` para repetir la llamada al confirmar.

Modal:

- Título: «Contrato duplicado» (o similar).
- Mensaje con `file_name`, fecha formateada (`Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', ... })`) y etiqueta de estado.
- Botones: «Cancelar» / «Reemplazar» (`destructive: true` en confirm).

Mapa de estados:

| `status`            | Etiqueta UI              |
|---------------------|--------------------------|
| `draft`             | Borrador                 |
| `pending_signature` | Pendiente de firma       |
| (otro)              | Mostrar valor raw        |

Al confirmar «Reemplazar»: llamar `postDocumentBuilderGenerate` con `{ ...body, overwrite: true }`.

### 7. Tests

- Servicio: duplicado sin overwrite → 409 + `existing`.
- Servicio: duplicado con overwrite → delete GCS + delete row + nuevo insert.
- Servicio: overwrite sin duplicado → generación normal.
- Servicio: duplicado `signed` → no 409, generación normal.
- API (opcional): integración 409 en `documentBuilderApi.test.js`.
- Frontend (opcional): test de `runGenerate` con mock 409 y confirmación.

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Condición de carrera: dos generaciones simultáneas sin overwrite | Ambas pueden pasar la consulta; aceptable en POC. Índice único sería solución futura. |
| GCS delete falla pero BD ya borrada (o al revés) | Delete GCS primero; si falla, no borrar BD y retornar 500. Log del error. |
| `apiClient` no expone meta | Cambio pequeño en `apiSendJson` incluido en este change. |
| Múltiples duplicados históricos en BD | Consulta usa `.first()` — tomar el más reciente (`orderBy('created_at', 'desc')`) para informar al usuario. |

## Migration Plan

1. Desplegar backend con nueva lógica (compatible hacia atrás: clientes sin `overwrite` reciben 409 en lugar de duplicar silenciosamente).
2. Desplegar frontend con modal — usuarios pueden confirmar reemplazo.
3. Sin rollback de datos; rollback de código restaura comportamiento anterior (duplicados silenciosos).

## Open Questions

- _(Ninguna crítica — requisitos definidos por el usuario.)_
