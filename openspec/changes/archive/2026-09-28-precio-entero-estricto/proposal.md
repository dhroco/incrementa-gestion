## Why

`parseIntegerOverride` le quita los puntos al precio y aplica `parseInt`. Lo que no calza lo cambia sin avisar: `1,290` queda en `1`, `1290.50` en `129050`, `12,5` en `12` y `290 USD` en `290`. Con las plantillas en dólares el riesgo subió, porque ahí lo natural es escribir `1,290` y el contrato saldría por US$1. Hay que rechazar el precio mal escrito ahora, antes de emitir otro PDF con un monto que el usuario no ingresó.

## What Changes

- El precio (`precio_numero`) se acepta solo como entero limpio: `1290`, o agrupado de a tres con un solo tipo de separador (`1.290`, `1.500.000`, `1,290`, `1,500,000`). La misma regla vale para `CLP` y `USD`.
- Todo lo demás (decimales, separadores mezclados, grupos mal formados, símbolos, letras, espacios internos, negativos) se rechaza con el mensaje «El precio debe ser un número entero, sin decimales ni símbolos. Por ejemplo: 1290, 1.290 o 1,290.» El contrato no se genera, tampoco en `dryRun`.
- Un precio limpio se escribe igual que hoy: `$1.290` en `CLP`, `US$1,290` en `USD`, y `precio_texto` sigue saliendo de `numberToWords`.
- **BREAKING (comportamiento de aceptación):** una entrada que antes se recortaba en silencio (`1,290` → `1`, `1290.50` → `129050`, `290 USD` → `290`) ahora se acepta como entero agrupado o se rechaza. El contrato HTTP no cambia: el rechazo usa el mismo `VALIDATION_ERROR` 400 de hoy.

No entra: frontend, contrato de la API, MCP (sigue usando los mismos services), migraciones, dependencias nuevas, `cantidad_reels`, `duracion_ejecucion`, `dias_cesion`, el formato de salida (`formatPriceNumber`, `CURRENCY_FORMAT`) y `numberToWords`.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `template-variable-pairs`: el preproceso de `precio_numero` deja de usar `parseIntegerOverride`. Solo un entero limpio se formatea y genera `precio_texto`; un precio inválido que llegue directo al preproceso queda tal cual y sin `precio_texto`.
- `document-builder-supplier-context`: si `precio_numero` viene con valor, `generateAndPersist` lo valida antes de preprocesar. Si no es un entero limpio, responde 400 `VALIDATION_ERROR` con el mensaje fijo, en `dryRun` y en la generación real, y no persiste nada.

## Impact

**Backend:** `backend/services/documentBuilderService.js`. Función pura nueva para leer el precio; `generateAndPersist` la aplica antes de `preprocessMissingFieldOverrides`; el preproceso deja de parsear el precio con `parseIntegerOverride`. Pruebas nuevas en `backend/test/documentBuilderService.priceInput.test.js`. Ningún archivo de prueba existente se modifica.

**Frontend:** ninguno. El formulario ya usa `<input type="number">`. Los precios mal escritos llegan por el MCP y la API; el rechazo en el service los cubre.

**APIs:** mismos endpoints. Un precio inválido responde el error de validación que ya existe (`status` 400, `code` `VALIDATION_ERROR`), con el mensaje nuevo. Sin endpoints ni campos nuevos.

**Datos:** sin migraciones ni seeds. Los contratos ya generados no se reescriben.

## Consideraciones de seguridad

El precio no es dato personal, pero sí es el monto que queda impreso en el contrato. El fallo actual es de integridad: el sistema sustituye el valor ingresado por otro, sin avisar.

- El rechazo no «arregla» la entrada ni devuelve el entero que habría adivinado. El mensaje es fijo y no incluye el valor enviado.
- La validación vive en el service que usan la API y el MCP. El frontend no se toca: el input numérico ya acota lo que se tipea en la web.
- Sin endpoints, grants ni columnas nuevas. No se loguea el precio rechazado.

**Validación:**

| Campo | Dónde | Regla |
| --- | --- | --- |
| `precio_numero` | Backend, al generar | Entero limpio (`1290`) o grupos de tres con un solo separador (punto o coma). Decimales, símbolos, letras, espacios internos, negativos y grupos mal formados se rechazan. Mensaje en español (`es-CL`), el mismo para las dos monedas. |
| `precio_numero` vacío o ausente | Backend | Sigue como hoy: no se valida ni se formatea. |
| Formulario web | Frontend | Sin cambio. `<input type="number" min="0">` ya limita la entrada. |
