## 1. Migración y reescritura de la cláusula

- [x] 1.1 Crear la migración de moneda sin editar migraciones existentes. `up`: agregar `template.currency_code` `string(3)` `notNullable` `defaultTo('CLP')` y el `CHECK (currency_code IN ('CLP', 'USD'))` llamado `template_currency_code_check`; dejar `CONTRATO_0016` y `CONTRATO_0017` en `USD`. El archivo único quedó partido en la sección 6.
- [x] 1.2 Exportar la función pura `rewriteMxPriceClause(contentJson)`. Busca el único párrafo con la variable `precio_numero` y exige los 8 nodos de `design.md` (textos y variables exactos, comillas curvas en “Precio”). Reemplaza solo los índices 3, 5 y 7. Devuelve un documento nuevo. Si no hay exactamente un párrafo, o el párrafo no calza, lanza `Error` diciendo qué no calzó.
- [x] 1.3 En `up`, reescribir las dos plantillas en memoria antes de escribir. Si cualquiera lanza, no actualizar ninguna. Luego guardar el `content_json` actual en `template_content_backup` con la nota `moneda-plantilla-usd: cláusula 3.1 en dólares` y persistir el documento reescrito. Las demás plantillas no cambian de redacción.
- [x] 1.4 `down`: restaurar el `content_json` desde los respaldos con esa nota, borrar esos respaldos, quitar el `CHECK` y la columna. Mismo patrón que `202609040004_template_country_and_mx_wording.js`. No correr la migración. Ese `down` único quedó partido en la sección 6.
- [x] 1.5 Si `up` encuentra menos de 2 plantillas entre `CONTRATO_0016` y `CONTRATO_0017`, `console.warn` y sigue sin lanzar (precedente de `202609040004`). Anotado en `design.md`, junto con el riesgo aceptado de que el `content_json` editable puede desalinearse de `currency_code`. Mostrar la moneda en la ficha queda como recorte futuro. No se cambia `standardTemplatesService`. `C-H7K38JV` confirmada: la spec `template-variable-pairs` de main no se toca en este cambio.

## 2. Formato del precio

- [x] 2.1 En `documentBuilderService.js`, dejar `formatThousands` en `es-CL` para `CLP` y agregar el formato `USD` con `toLocaleString('en-US', { maximumFractionDigits: 0 })` y prefijo `US$`. Mapa chico moneda → prefijo y locale. `CLP`: `$1.290` / `$1.500.000` / `$0`. `USD`: `US$1,290` / `US$1,500,000` / `US$0`.
- [x] 2.2 `preprocessMissingFieldOverrides(overrides, { currencyCode } = {})`: sin `currencyCode`, o con `null` o vacío, usa `CLP`. Otra moneda lanza `Error`. `parseIntegerOverride` y `precio_texto` (`numberToWords`) no cambian. Actualizar el comentario del precio para que diga que el formato depende de la moneda de la plantilla.
- [x] 2.3 `getTemplateRow` también selecciona `t.currency_code`. En `generateAndPersist`, cargar la plantilla después de `validateSelectOverrides` (que sigue sobre los overrides crudos) y antes del preproceso: `preprocessMissingFieldOverrides(overridesRaw, { currencyCode: templateRow.currency_code })`. Si no hay plantilla, el mismo 404 «Plantilla no encontrada.». `loadCompanyRow` y la coherencia país–plantilla quedan después, en el mismo orden relativo. El precio ya formateado es el que se guarda en `contract_overrides`.

## 3. Pruebas nuevas

- [x] 3.1 Crear `backend/test/templateCurrencyMigration.test.js`. Importar `rewriteMxPriceClause` desde la migración. Con el párrafo de la spec envuelto en un `doc` más otro párrafo, una prueba por escenario de `document-builder-supplier-context`:
  - «Clause nodes rewritten and input unchanged»: los nodos 3, 5 y 7 quedan con el texto nuevo, todo lo demás idéntico (incluido el otro párrafo) y la entrada no cambia (compararla con una copia profunda tomada antes de llamar).
  - «Plain text is the US dollar clause»: el texto plano del párrafo reescrito (con `backend/utils/tipTapPlainText.js`), reemplazando `{{precio_numero}}` por `US$1,290` y `{{precio_texto}}` por `mil doscientos noventa`, es exactamente la cláusula de `design.md`.
  - «Mismatch throws»: lanza `Error` si el nodo 3 ya trae la redacción en dólares (documento ya reescrito), si no hay párrafo con `precio_numero` y si hay dos.
  Sin base y sin leer el fuente.
- [x] 3.2 Crear `backend/test/documentBuilderService.currency.test.js`, una prueba por escenario de `template-variable-pairs` y de «Generate formats price with the template currency»:
  - «CLP price cells»: `preprocessMissingFieldOverrides` con `1290`, `1500000` y `0` da `$1.290`, `$1.500.000` y `$0`, con `currencyCode: 'CLP'`, sin segundo argumento, con `null` y con `''`.
  - «USD price cells»: `US$1,290`, `US$1,500,000` y `US$0` con `currencyCode: 'USD'`.
  - «Price text ignores currency»: `precio_texto` = `mil doscientos noventa` para `1290` en `CLP` y en `USD`.
  - «Unknown currency throws»: lanza `Error` con, por ejemplo, `currencyCode: 'MXN'`.
  - «Price number formatted and text generated»: `{ precio_numero: '1500000' }` sin moneda da `$1.500.000` y un `precio_texto` no vacío.
  - «USD template stores US dollar price» y «CLP template stores Chilean price»: `generateAndPersist` sin `dryRun`, con plantilla mock `currency_code: 'USD'` (o `'CLP'`) y `country_code` coherente con el proveedor, y `precio_numero: '1290'`: el `contract_overrides` que se inserta trae `precio_numero` `US$1,290` (o `$1.290`). Capturar el insert con un hook del mock de base.
  Copiar el andamiaje de mocks desde `documentBuilderService.test.js`; no importarlo ni modificarlo.
- [x] 3.3 No modificar ningún archivo de prueba existente. Si uno falla, no ajustarlo: consultar a la mesa.
- [x] 3.4 En los archivos de prueba del recorte, cazar las ablaciones que sobrevivían: `getTemplateRow` pide `t.currency_code`; `up` deja `CONTRATO_0016` y `CONTRATO_0017` en `USD` y avisa si hay menos de 2; un párrafo con 9 nodos, el nodo 0 sin negrita o `precio_numero`/`precio_texto` intercambiados lanza `Error`; una moneda desconocida lanza `Moneda de plantilla no admitida`; una moneda solo con espacios cae a `CLP`.
- [x] 3.5 En `backend/test/templateCurrencyMigration.test.js`, cazar la segunda vuelta de ablaciones de `up`/`down` sin tocar los casos ya escritos: el `content_json` persistido trae la cláusula en dólares; el insert a `template_content_backup` guarda el original con la nota de este cambio; la lectura y la reescritura se acotan a `CONTRATO_0016` y `CONTRATO_0017`; con `hasColumn` en falso la columna nace `defaultTo('CLP')` y el `CHECK` es `template_currency_code_check` sobre `('CLP', 'USD')`; `down` restaura desde esa nota y el `delete` de respaldos filtra por ella; con exactamente una de las dos plantillas, `console.warn`.

## 4. Cierre

- [x] 4.1 `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test`, las dos en verde. No correr la migración ni conectarse a la base. Backend 353 pruebas y frontend 124, el 2026-09-28.
- [x] 4.2 Sin cambios de API, frontend, MCP, dependencias, ni de los archivos prohibidos del encargo (`openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, configs, `knexfile.js`, `db/knex.js`, `.github/**`, `infra/**`).

## 5. Devolución de cierre

- [x] 5.1 Pruebas nuevas en `backend/test/templateCurrencyMigrationClosure.test.js`, sin tocar las pruebas ya escritas: si el párrafo de precio de una plantilla mexicana no calza, `up` no marca `currency_code='USD'` en esa plantilla (se marca solo después de reescribir con éxito); `down` quita la columna `currency_code` y su `CHECK` (operaciones de esquema, no solo updates y deletes). El orden del Migration Plan quedó reemplazado por la sección 6.

## 6. Separación de la migración

- [x] 6.1 `202609280001_template_currency_code.js` solo agrega `template.currency_code` default `CLP` y el `CHECK` `template_currency_code_check`. Su `down` quita el `CHECK` y la columna. Se corre antes del deploy.
- [x] 6.2 `202609280002_mx_price_clause_usd.js` marca `CONTRATO_0016` y `CONTRATO_0017` en `USD`, reescribe la cláusula 3.1 y exporta `rewriteMxPriceClause`. Su `down` restaura el `content_json`, borra los respaldos de esa nota y vuelve esas plantillas a `CLP`, sin quitar la columna. Se corre después del deploy.
- [x] 6.3 Las pruebas de esta corrida importan el esquema desde `202609280001` y los datos desde `202609280002`, sin cambiar lo que verifican. `backend/test/templateCurrencyMigrationOrder.test.js` corre A y después B, y el rollback B y después A.
- [x] 6.4 Migration Plan de `design.md`: A, deploy, B. Antes de correr B en pre-producción o producción, confirmar los códigos reales de `CONTRATO_0016` y `CONTRATO_0017`.
