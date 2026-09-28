## Context

El precio lo escribe `preprocessMissingFieldOverrides` en `backend/services/documentBuilderService.js`. Hoy siempre antepone `$` y formatea miles con `formatThousands` (`es-CL`). `precio_texto` sale de `numberToWords`, sin moneda. La moneda, cuando aparece, está en el texto fijo de la plantilla.

CONTRATO_0016 y CONTRATO_0017 (México, ya con `country_code` `MX`) tienen la cláusula 3.1 idéntica: «…en moneda de curso legal en (Tipo de moneda País), de `{{precio_numero}}` `{{precio_texto}}` líquido…». Un contrato mexicano sale «…de $290 doscientos noventa líquido…». Esas plantillas son en dólares de los Estados Unidos, no en pesos mexicanos: país y moneda son cosas distintas.

La decisión de producto (David, 28-sep-2026, `docs/disenos/moneda-plantilla.md`) es que la moneda es fija por plantilla. Nadie la elige al generar. Este change no corre la migración: la base local es la de pre-producción y la aplica David después de fusionar.

## Goals / Non-Goals

**Goals:**

- `template.currency_code` obligatorio, `CLP` o `USD`, `CLP` por omisión. CONTRATO_0016 y CONTRATO_0017 quedan en `USD`.
- `precio_numero` según esa moneda: `$1.290` en `CLP`, `US$1,290` en `USD`.
- Reescribir solo la cláusula 3.1 de esas dos plantillas, con respaldo reversible del `content_json`.
- Guardar el precio ya formateado en `contract_overrides`, para que el listado muestre `US$1,290` sin tocar la consulta ni el frontend.

**Non-Goals:**

- Montos con decimales. El precio sigue siendo entero.
- Parsear una entrada que ya traiga separador de miles (`1,290` hoy se lee como `1`). Defecto previo; otro recorte.
- Elegir la moneda en la interfaz de plantillas. El país tampoco se elige ahí.
- Otras monedas. Agregar una exige migración y código.
- Contratos ya generados (PDF emitidos).
- Cambios de contrato de la API, de frontend, de dependencias o del MCP (usa los mismos services).
- Tocar `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`, `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`, ni migraciones ya existentes.

## Decisions

### 1. Columna en `template`, no derivada del país

`currency_code` `string(3)`, `notNullable`, `defaultTo('CLP')`, con `CHECK (currency_code IN ('CLP', 'USD'))` llamado `template_currency_code_check`. La migración `202609280002` deja `CONTRATO_0016` y `CONTRATO_0017` en `USD`. El resto queda en `CLP` por el default de `202609280001`.

**Alternativa descartada:** sacar la moneda de `template.country_code`. México con dólares muestra que no coinciden.

### 2. Formato al lado de `formatThousands`, no dentro

`formatThousands` sigue en `es-CL` y se usa para `CLP`. `USD` se formatea al lado con `toLocaleString('en-US', { maximumFractionDigits: 0 })`. Un mapa chico moneda → prefijo y locale:

| Moneda | 1290 | 1500000 | 0 |
| --- | --- | --- | --- |
| `CLP` (o sin moneda) | `$1.290` | `$1.500.000` | `$0` |
| `USD` | `US$1,290` | `US$1,500,000` | `US$0` |

`parseIntegerOverride` no cambia. `precio_texto` sigue siendo `numberToWords(n)`, igual en las dos monedas. El comentario «Precio con signo '$' y separadores de miles» pasa a decir que el formato depende de la moneda de la plantilla.

`preprocessMissingFieldOverrides(overrides, { currencyCode } = {})`: sin `currencyCode`, o con `null` o vacío, usa `CLP`. Así los llamadores y las pruebas actuales siguen igual (sus mocks de `template as t` no traen `currency_code`). Una moneda distinta de `CLP` o `USD` lanza `Error`: es un error de programación; el `CHECK` no la deja entrar.

### 3. La plantilla se carga antes del preproceso

Hoy `generateAndPersist` corre `preprocessMissingFieldOverrides` antes de `loadCompanyRow` y `getTemplateRow`. La moneda está en la plantilla, así que el orden queda:

1. `validateSelectOverrides` sobre los overrides crudos. No se mueve y no depende de la moneda.
2. `getTemplateRow`. Si no hay fila: 404 «Plantilla no encontrada.», el mismo mensaje.
3. `preprocessMissingFieldOverrides(overridesRaw, { currencyCode: templateRow.currency_code })`.
4. `loadCompanyRow` y el control de coherencia país–plantilla, en el mismo orden relativo que hoy.
5. Sustitución, PDF y persistencia, igual. El objeto preprocesado es el que se guarda en `contract_overrides`.

`getTemplateRow` también selecciona `t.currency_code`.

### 4. La cláusula 3.1 se reescribe por posición, no por búsqueda de texto

Dos migraciones nuevas. `backend/migrations/202609280001_template_currency_code.js` solo agrega la columna y el `CHECK`. `backend/migrations/202609280002_mx_price_clause_usd.js` marca las dos plantillas y reescribe la cláusula. Siguen el patrón de `202609040004_template_country_and_mx_wording.js` (columna, `CHECK`, respaldo, `down` que restaura), partido en esquema y datos. El reemplazo no reutiliza `replacePlainText`.

`202609280002` exporta la función pura `rewriteMxPriceClause(contentJson)` además de `up` y `down`, para probarla sin base. Busca en todo el documento el único párrafo que contiene la variable `precio_numero`. Ese párrafo tiene hoy exactamente 8 nodos (idénticos en la 0016 y la 0017). Cambian solo tres nodos de texto, por índice, verificando el texto exacto:

| Índice | Hoy | Queda |
| --- | --- | --- |
| 3 | ` pagará al Influencer, corresponderá a una cantidad fija y única en moneda de curso legal en (Tipo de moneda País), de ` | ` pagará al Influencer, corresponderá a una cantidad fija y única, en dólares de los Estados Unidos de América, de ` |
| 5 | ` ` | ` (` |
| 7 | ` líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el “Precio”.` | ` dólares de los Estados Unidos de América) líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el “Precio”.` |

Las comillas de “Precio” son las curvas del `content_json` (U+201C / U+201D). Devuelve un documento nuevo; no muta la entrada. El resto (otros párrafos, marcas, atributos, variables) queda idéntico.

Si no hay exactamente un párrafo con `precio_numero`, o si ese párrafo no tiene exactamente esos 8 nodos con esos textos y variables, lanza `Error` y el mensaje dice qué no calzó. El `up` de `202609280002` llama a la función antes de escribir: si lanza para cualquiera de las dos plantillas, no actualiza ninguna.

Ese `up` guarda el `content_json` actual de esas dos filas en `template_content_backup` con la nota `moneda-plantilla-usd: cláusula 3.1 en dólares`, y escribe el documento reescrito. Su `down` restaura desde ese respaldo, borra esas filas de respaldo y vuelve `CONTRATO_0016` y `CONTRATO_0017` a `CLP`. No quita el `CHECK` ni la columna: eso lo hace el `down` de `202609280001`.

Si `CONTRATO_0016` o `CONTRATO_0017` no están (base nueva, o códigos distintos en la nube del cliente), el `up` de `202609280002` no lanza. Sigue el precedente de `202609040004` (el `whereIn` no hace nada si no hay filas) y así `migrate:latest` no se rompe en una base sin esas plantillas. Si encuentra menos de 2, escribe `console.warn` y solo reescribe y respalda las filas que sí encontró. Antes de correr `202609280002` en pre-producción o producción hay que confirmar los códigos reales.

**Alternativa descartada:** reemplazar por coincidencia de texto, como `replacePlainText` en la migración de país. Aquí hay que verificar la forma exacta del párrafo y abortar si no calza, para no dejar una cláusula a medias.

### 5. Pruebas solo en archivos nuevos

Ningún archivo de prueba que existiera antes de esta corrida se modifica. Si uno falla, se consulta a la mesa; no se ajusta.

- `backend/test/templateCurrencyMigration.test.js` importa `rewriteMxPriceClause` desde `202609280002_mx_price_clause_usd.js`. El esquema (`up` de la columna) se importa desde `202609280001_template_currency_code.js`. Arma el párrafo de la decisión envuelto en un `doc` junto a otro párrafo, y comprueba los tres nodos, el texto plano de la cláusula, que la entrada no cambia, y los tres casos que lanzan (nodo 3 que no calza, cero párrafos, dos párrafos).
- `backend/test/documentBuilderService.currency.test.js` cubre cada celda de la tabla de formato, `precio_texto` = `mil doscientos noventa` para `1290` en las dos monedas, el `Error` de moneda desconocida, y `generateAndPersist` (sin `dryRun`) con mock `USD` → `contract_overrides.precio_numero` `US$1,290` y con `CLP` → `$1.290`. El andamiaje de mocks se copia de `documentBuilderService.test.js`; no se importa ni se modifica ese archivo.

El texto plano esperado del párrafo reescrito, con `precio_numero` y `precio_texto` sustituidos y `company_nombre_comercial` como token `{{…}}` (así lo escribe `tipTapPlainText`), es:

`3.1 El precio de los Servicios que {{company_nombre_comercial}} pagará al Influencer, corresponderá a una cantidad fija y única, en dólares de los Estados Unidos de América, de US$1,290 (mil doscientos noventa dólares de los Estados Unidos de América) líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el “Precio”.`

Perfil de pruebas: `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test`. Las dos en verde. Ninguna prueba se conecta a la base ni lee el código fuente.

## Risks / Trade-offs

- [Mover `getTemplateRow` antes del preproceso cambia el ganador si faltan plantilla y empresa a la vez] → El 404 de plantilla y el de coherencia de país conservan mensaje y condición. Las pruebas existentes lo cubren. Si alguna falla por el orden, no se toca: se consulta a la mesa.
- [El párrafo de pre-producción no calza con los 8 nodos esperados] → `rewriteMxPriceClause` lanza y `up` no escribe. No hay actualización parcial.
- [Mocks actuales sin `currency_code`] → Ausencia, `null` o vacío significan `CLP`, que es el formato de hoy (`$` + miles `es-CL`).
- [`1,290` se sigue leyendo como `1`] → Fuera de alcance, a propósito. Mismo `parseIntegerOverride`.
- [Contratos viejos de la 0016/0017 siguen con `$` chileno] → Son PDF emitidos. No se reescriben.
- [Ambiente sin `CONTRATO_0016` / `CONTRATO_0017`] → el `up` de `202609280002` no lanza. `console.warn` si hay menos de 2. Las ausentes no se marcan en `USD` ni se reescriben. Antes de correr B en pre-producción o producción, confirmar los códigos reales.
- [Moneda y cláusula 3.1 pueden desalinearse] → `currency_code` no se edita desde la interfaz, pero `content_json` sí (`PUT /api/standard-templates/:id`). Alguien puede reescribir la cláusula de una plantilla `USD` a pesos, o copiar la cláusula en dólares a una `CLP`, y ni la base ni el servicio lo detectan. Riesgo aceptado. Mostrar la moneda en la ficha de la plantilla queda como recorte futuro. No se cambia `standardTemplatesService`.

## Migration Plan

1. Agregar `202609280001_template_currency_code.js` (solo `template.currency_code` default `CLP` y el `CHECK`) y `202609280002_mx_price_clause_usd.js` (marca `CONTRATO_0016` y `CONTRATO_0017` en `USD` y reescribe la cláusula 3.1). No editar migraciones anteriores. No ejecutarlas en este change.
2. Orden: primero la migración A (`202609280001`), después el deploy del backend nuevo, después la migración B (`202609280002`). David las aplica después de fusionar. Antes de correr B en pre-producción o producción, confirma los códigos reales de `CONTRATO_0016` y `CONTRATO_0017`.
3. Rollback: primero el `down` de B (restaura el `content_json` desde el respaldo con esa nota, borra esos respaldos y vuelve esas plantillas a `CLP`, sin quitar la columna). Después el `down` de A (quita el `CHECK` y la columna). Los PDF ya emitidos no se tocan en ningún sentido.

## Open Questions

Ninguna. La moneda por plantilla, el formato, el texto de la cláusula 3.1 y el alcance están cerrados en el encargo y en `docs/disenos/moneda-plantilla.md`.
