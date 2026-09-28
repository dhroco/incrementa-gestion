## Context

El precio de un contrato entra en `missingFieldOverrides.precio_numero` y lo lee `parseIntegerOverride` en `backend/services/documentBuilderService.js`: quita los puntos y aplica `parseInt`. Lo que no calza cambia sin avisar (`1,290` → `1`, `1290.50` → `129050`, `12,5` → `12`, `290 USD` → `290`). Con las plantillas en dólares, `1,290` es la forma natural de escribir mil doscientos noventa y el PDF saldría por US$1.

La regla (Ignacio, 28-sep-2026, `docs/disenos/moneda-plantilla.md`, sección «El precio mal escrito») es de validación de entrada: se acepta solo un entero limpio, igual en `CLP` y en `USD`. Se descartó aceptar la coma solo en dólares.

Hoy `generateAndPersist` carga la plantilla y llama `preprocessMissingFieldOverrides(overridesRaw, { currencyCode })` antes de armar el PDF. `dryRun` recorre ese mismo tramo y vuelve antes de escribir. `formatPriceNumber`, `CURRENCY_FORMAT` y `numberToWords` ya formatean un entero limpio y no se tocan.

## Goals / Non-Goals

**Goals:**

- Aceptar `1290` (también como número, y con espacios solo en los extremos) y el agrupado de a tres con un solo separador: `1.290`, `1.500.000`, `12.345`, `1,290`, `1,500,000`.
- Rechazar todo lo demás con un único mensaje en español, sin generar el contrato ni en `dryRun`, y sin escribir en `draft_document` ni en GCS.
- Seguir formateando el entero aceptado como hoy: `$1.290` / `US$1,290` y `precio_texto` con `numberToWords`.

**Non-Goals:**

- Montos con decimales. El precio sigue siendo entero.
- Cambiar `cantidad_reels`, `duracion_ejecucion` ni `dias_cesion`. `parseIntegerOverride` se queda para esos campos.
- Frontend, contrato de la API, MCP, migraciones, dependencias nuevas.
- Tocar `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`, `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`.
- Reescribir contratos ya generados.
- Modificar cualquier archivo de prueba existente.

## Decisions

### 1. Tres expresiones cortas, no una sola

`parsePriceInput(value)`, pura y exportada desde `documentBuilderService.js`, trabaja sobre `String(value).trim()`. Acepta si calza una de estas tres, y solo una:

- `^\d+$`
- `^\d{1,3}(\.\d{3})+$`
- `^\d{1,3}(,\d{3})+$`

Si calza la primera, el entero es `parseInt` de ese texto. Si calza una agrupada, se quita ese único separador y el resto es el entero. Devuelve `{ ok: true, value }` o `{ ok: false, message }`.

El mensaje es siempre el mismo: `El precio debe ser un número entero, sin decimales ni símbolos. Por ejemplo: 1290, 1.290 o 1,290.`

**Alternativa descartada:** una sola expresión larga. Cuesta ver qué grupo falló y el encargo pide tres cortas. También se descartó interpretar la coma como decimal en `CLP` y como miles en `USD`: la regla es la misma en las dos monedas.

### 2. `generateAndPersist` rechaza antes de preprocesar

Si `overridesRaw.precio_numero` no es `null` y, pasado a texto, no queda vacío tras `trim`, se valida con `parsePriceInput` justo después de resolver la plantilla y justo antes de `preprocessMissingFieldOverrides`. Si no es válido, la función devuelve `{ ok: false, status: 400, code: 'VALIDATION_ERROR', message }` con el mensaje de `parsePriceInput`. Vale para `dryRun` y para la generación real: en ese punto todavía no hay PDF, ni `insert` en `draft_document`, ni subida a GCS.

El 404 `Plantilla no encontrada.` sigue ganando cuando no hay fila. `validateSelectOverrides` no se mueve. El control de país sigue después del preproceso. Un precio ausente o vacío no entra a esta validación, igual que hoy.

**Alternativa descartada:** validar al inicio, antes de leer proveedor y plantilla. Un precio inválido taparía el 404 de plantilla inexistente. El encargo solo exige que el rechazo ocurra antes del preproceso.

### 3. El preproceso formatea solo lo que `parsePriceInput` acepta

`preprocessMissingFieldOverrides` deja de usar `parseIntegerOverride` para el precio. Si `parsePriceInput` acepta, `formatPriceNumber` y `numberToWords` siguen igual. Si no acepta —solo puede pasar si alguien llama el preproceso directo, porque `generateAndPersist` ya cortó—, `precio_numero` queda como vino y no se escribe `precio_texto`. Es lo que hoy ocurre cuando `parseInt` no entiende el valor.

`parseIntegerOverride` no cambia de comportamiento. El comentario pasa a decir que ya no se usa para el precio; sigue en `cantidad_reels`. `formatDuracion` y `formatDias` no se enrutan por `parsePriceInput`.

### 4. Las pruebas nuevas no tocan las que ya existen

Todas viven en `backend/test/documentBuilderService.priceInput.test.js`. Ejercitan `parsePriceInput`, `preprocessMissingFieldOverrides` y `generateAndPersist`. El andamiaje de mocks de `generateAndPersist` se copia desde `documentBuilderService.currency.test.js`; no se importa ni se modifica ese archivo. Ninguna prueba lee el fuente ni se conecta a la base.

## Risks / Trade-offs

- [Un `1,290` que alguien pensó como decimal queda en mil doscientos noventa] → La regla lo pide: grupos de exactamente tres, un solo separador. `12,5`, `1290,5` y `1.29` se rechazan; no se leen como doce ni como uno.
- [`1.290` en cabeza de quien usa punto decimal es mil doscientos noventa, no 1,290] → Mismo criterio. `1.29` y `1290.50` se rechazan. No se adivina la moneda para decidir el separador.
- [Una prueba existente que hoy depende de un precio mal parseado falla] → No se ajusta. Se consulta a la mesa. Las que hay usan `1290` y `1500000`, que siguen siendo válidos y se formatean igual.
- [El mensaje fijo no dice qué carácter sobró] → A propósito: no se devuelve ni se loguea el valor enviado.

## Migration Plan

No hay migración ni cambio de esquema. El despliegue es el del backend. Los PDF ya emitidos quedan como están. Rollback: revertir el cambio de `documentBuilderService.js`; no hay datos que deshacer.

## Open Questions

Ninguna. La tabla de aceptación y el mensaje quedan cerrados en el encargo.
