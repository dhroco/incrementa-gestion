## 1. Lectura estricta del precio

- [x] 1.1 En `backend/services/documentBuilderService.js`, agregar `parsePriceInput(value)` y exportarla en `module.exports`. Sobre `String(value).trim()`, aceptar solo `^\d+$`, `^\d{1,3}(\.\d{3})+$` o `^\d{1,3}(,\d{3})+$`. Devolver `{ ok: true, value: <entero> }` (el agrupado se lee quitando ese único separador) o `{ ok: false, message }` con el texto exacto `El precio debe ser un número entero, sin decimales ni símbolos. Por ejemplo: 1290, 1.290 o 1,290.`
- [x] 1.2 Actualizar el comentario de `parseIntegerOverride` para que diga que ya no se usa para el precio. No cambiar su comportamiento: sigue en `cantidad_reels`. No enrutar `duracion_ejecucion` ni `dias_cesion` por `parsePriceInput`. No tocar `formatPriceNumber`, `CURRENCY_FORMAT` ni `numberToWords`.

## 2. Generación y preproceso

- [x] 2.1 En `generateAndPersist`, después de encontrar la plantilla y antes de `preprocessMissingFieldOverrides`: si `overridesRaw.precio_numero` no es `null` y `String(...).trim()` no queda vacío, validar con `parsePriceInput`. Si `ok` es falso, devolver `{ ok: false, status: 400, code: 'VALIDATION_ERROR', message }` con ese mensaje. El 404 `Plantilla no encontrada.` y `validateSelectOverrides` quedan donde están. Un precio `null` o en blanco no entra a esta validación. El corte vale con `dryRun: true` y sin `dryRun`, antes de cualquier `insert` o subida a GCS.
- [x] 2.2 En `preprocessMissingFieldOverrides`, parsear `precio_numero` con `parsePriceInput` en vez de `parseIntegerOverride`. Si acepta, formatear y generar `precio_texto` como hoy. Si rechaza, dejar `precio_numero` como vino y no escribir `precio_texto`. Una moneda distinta de `CLP` o `USD` sigue lanzando `Error`.

## 3. Pruebas nuevas

Todas en el archivo nuevo `backend/test/documentBuilderService.priceInput.test.js`. Ejecutan el comportamiento; ninguna lee el código fuente ni se conecta a la base. No modificar ningún archivo de prueba existente. El andamiaje de mocks de `generateAndPersist` se copia desde `documentBuilderService.currency.test.js`; no se importa ni se modifica ese archivo.

- [x] 3.1 `parsePriceInput`, una afirmación por fila de la tabla del encargo: `1290`, `0` y `1500000`; `1.290` → `1290`, `1.500.000` → `1500000`, `12.345` → `12345`; `1,290` → `1290`, `1,500,000` → `1500000`; `' 1290 '` → `1290`; el número `1290` → `1290`. En cada rechazo (`1,290.50`, `1290.50`, `1290,5`, `12,5`, `1.29`, `1.290,000`, `1,290.000`, `1.2900`, `12.90`, `.290`, `1.`, `1..290`, `$1290`, `US$1,290`, `290 USD`, `1 290`, `-1290`, `abc`), `ok: false` y el mensaje exacto.
- [x] 3.2 `preprocessMissingFieldOverrides`: `1,290` con `USD` da `US$1,290` y `mil doscientos noventa`; `1.290` con `CLP` da `$1.290`; un precio inválido (`1290.50`) queda tal cual y sin `precio_texto`.
- [x] 3.3 `generateAndPersist` con `dryRun: true` y también sin `dryRun`: `precio_numero: '1,290.50'` devuelve `ok: false`, `status: 400`, `code: 'VALIDATION_ERROR'` y el mensaje exacto, y no hay `insert` en `draft_document` ni subida a GCS. Con `'1,290'` y plantilla `USD`, el `contract_overrides` guardado trae `precio_numero: 'US$1,290'`.

## 4. Verificación

- [x] 4.1 Correr `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test`. Las dos en verde. Sin migraciones y sin conexión a la base. Si falla una prueba existente, no ajustarla: consultar a la mesa.
- [x] 4.2 Sin cambios de frontend, de la API, del MCP, de dependencias, ni de los archivos prohibidos del encargo (`openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`, `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`).
