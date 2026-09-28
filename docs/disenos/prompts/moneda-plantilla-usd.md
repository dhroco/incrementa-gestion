# Recorte · moneda-plantilla-usd

> Encargo de Ignacio (arquitecto), 28-sep-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/moneda-plantilla.md`.

## 1. Objetivo

El precio de un contrato siempre se escribe a la chilena, y las plantillas mexicanas CONTRATO_0016
y CONTRATO_0017 imprimen el texto de relleno «(Tipo de moneda País)». Un contrato mexicano sale hoy:
«…en moneda de curso legal en (Tipo de moneda País), de $290 doscientos noventa líquido…».

Al terminar:
- **La plantilla tiene moneda**: `template.currency_code`, `CLP` o `USD`. La 0016 y la 0017 están en
  `USD` y todas las demás en `CLP`.
- **`precio_numero` se escribe según la moneda de la plantilla**: `$1.290` en `CLP` (igual que hoy)
  y `US$1,290` en `USD`.
- **La cláusula 3.1 de la 0016 y la 0017** dice: «…corresponderá a una cantidad fija y única, en
  dólares de los Estados Unidos de América, de US$1,290 (mil doscientos noventa dólares de los
  Estados Unidos de América) líquido, más el Impuesto al Valor Agregado…».
- Las plantillas chilenas no cambian en nada.

## 2. Arquitectura

- **Migración nueva** `backend/migrations/202609280001_template_currency_and_mx_price_clause.js`:
  - `up`: agrega `template.currency_code` (`string(3)`, `notNullable`, `defaultTo('CLP')`) con un
    `CHECK (currency_code IN ('CLP', 'USD'))` llamado `template_currency_code_check`; deja
    `CONTRATO_0016` y `CONTRATO_0017` en `USD`. Para esas dos plantillas guarda el `content_json`
    actual en `template_content_backup` con la nota
    `moneda-plantilla-usd: cláusula 3.1 en dólares`, y escribe el `content_json` reescrito por
    `rewriteMxPriceClause`.
  - `down`: restaura el `content_json` desde el respaldo con esa nota, borra esos respaldos, quita
    el `CHECK` y la columna. Sigue el patrón de `202609040004_template_country_and_mx_wording.js`.
  - Exporta, además de `up` y `down`, la función pura **`rewriteMxPriceClause(contentJson)`**, para
    probarla sin base (sección 3).
- **`documentBuilderService.js`**:
  - `getTemplateRow` también selecciona `t.currency_code`.
  - En `generateAndPersist`, la plantilla se carga **antes** de preprocesar los overrides, y
    `preprocessMissingFieldOverrides(overridesRaw, { currencyCode: templateRow.currency_code })`
    formatea el precio con esa moneda. El control de coherencia país–plantilla y todo lo demás
    quedan igual, en el mismo orden relativo.
  - `preprocessMissingFieldOverrides(overrides, { currencyCode } = {})`: sin `currencyCode`, o con
    `null`, usa `CLP`. Así los llamadores y las pruebas actuales siguen iguales.
- `precio_texto` no cambia: sigue siendo `numberToWords(n)`.
- El precio ya formateado es el que se guarda en `contract_overrides`, así que el listado de
  contratos mostrará `US$1,290` sin tocar `contractsQueryService` ni el frontend.
- Sin cambios de contrato de la API, sin cambios de frontend, sin dependencias nuevas. El MCP no se
  toca: usa los mismos services.

## 3. Reglas

**Formato de `precio_numero`** (entrada ya convertida a entero por `parseIntegerOverride`, que no
cambia):

| Moneda | 1290 | 1500000 | 0 |
|---|---|---|---|
| `CLP` (o sin moneda) | `$1.290` | `$1.500.000` | `$0` |
| `USD` | `US$1,290` | `US$1,500,000` | `US$0` |

Una moneda distinta de `CLP`, `USD` o vacía es un error de programación: `preprocessMissingFieldOverrides`
lanza un `Error`. La base no la admite (el `CHECK`), así que nunca debería llegar.

**`rewriteMxPriceClause(contentJson)`** busca, en todo el documento, el **único** párrafo que
contiene la variable `precio_numero`. Ese párrafo tiene hoy exactamente este `content` (idéntico en
la 0016 y la 0017; se leyó de pre-producción el 28-sep):

```json
[
  {"text": "3.1 ", "type": "text", "marks": [{"type": "bold"}]},
  {"text": "El precio de los Servicios que ", "type": "text"},
  {"type": "variable", "attrs": {"bold": false, "group": "empresa", "label": "Nombre Comercial", "italic": false, "underline": false, "uppercase": false, "variableId": "company_nombre_comercial"}},
  {"text": " pagará al Influencer, corresponderá a una cantidad fija y única en moneda de curso legal en (Tipo de moneda País), de ", "type": "text"},
  {"type": "variable", "attrs": {"bold": false, "group": "contrato", "label": "Precio", "italic": false, "underline": false, "uppercase": false, "variableId": "precio_numero"}},
  {"text": " ", "type": "text"},
  {"type": "variable", "attrs": {"bold": false, "group": "contrato", "label": "Precio en texto", "italic": false, "underline": false, "uppercase": false, "variableId": "precio_texto"}},
  {"text": " líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el “Precio”.", "type": "text"}
]
```

Cambian **solo tres nodos de texto**, por posición y verificando el texto exacto de cada uno:

| Nodo | Hoy | Queda |
|---|---|---|
| 3 | ` pagará al Influencer, corresponderá a una cantidad fija y única en moneda de curso legal en (Tipo de moneda País), de ` | ` pagará al Influencer, corresponderá a una cantidad fija y única, en dólares de los Estados Unidos de América, de ` |
| 5 | ` ` | ` (` |
| 7 | ` líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el “Precio”.` | ` dólares de los Estados Unidos de América) líquido, más el Impuesto al Valor Agregado que, en su caso, resulte aplicable, en adelante, el “Precio”.` |

- Devuelve un documento **nuevo**; no modifica el de entrada. Todo lo demás (otros párrafos, marcas,
  atributos, variables) queda idéntico.
- Si no hay exactamente un párrafo con `precio_numero`, o si ese párrafo no tiene exactamente estos
  8 nodos con estos textos y variables, **lanza un `Error`** con un mensaje que diga qué no
  calzó. La migración no escribe nada a medias: si la función lanza para cualquiera de las dos
  plantillas, `up` falla antes de actualizarlas.

## 4. Recomendaciones

- Deja `formatThousands` tal como está (`es-CL`) para `CLP`, y agrega el formato `USD` al lado, con
  `toLocaleString('en-US', { maximumFractionDigits: 0 })`. Un mapa chico de moneda → prefijo y
  locale se lee bien.
- Actualiza el comentario «Precio con signo '$' y separadores de miles» para que diga que depende
  de la moneda de la plantilla.
- En la migración, reutiliza la forma del `replacePlainText` de `202609040004` solo como referencia:
  aquí se reemplaza por posición y con verificación exacta, no por coincidencia de texto.

## 5. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`.
- **Las migraciones existentes no se editan**: solo se agrega la nueva.
- **No corras la migración** ni nada que se conecte a la base: la local es la de pre-producción. La
  aplica David después de fusionar.
- Los mensajes, la documentación y los commits, en español.

## 6. Pruebas existentes

Ninguna prueba existente cambia. **No modifiques ningún archivo de prueba existente, ni para
agregarle pruebas.** Las mocks actuales de `template as t` no traen `currency_code`, así que deben
seguir pasando con `CLP` por omisión. Si cualquier prueba existente falla, **no la ajustes: consulta
a la mesa.**

## 7. Pruebas nuevas

**Todas en archivos nuevos.** Todas ejecutan el comportamiento: llaman la función o el servicio y
miran el resultado. Ninguna lee el código fuente ni se conecta a la base.

- **`backend/test/templateCurrencyMigration.test.js`**, sobre `rewriteMxPriceClause` (se importa
  desde el archivo de la migración), con el párrafo de la sección 3 envuelto en un `doc` junto a
  otro párrafo cualquiera:
  - los nodos 3, 5 y 7 quedan con el texto nuevo y todo lo demás queda idéntico (incluido el otro
    párrafo);
  - el texto plano del párrafo reescrito, con las variables reemplazadas por `US$1,290` y
    `mil doscientos noventa`, es exactamente la cláusula de la sección 1;
  - el documento de entrada no cambia;
  - lanza si el nodo 3 no calza (por ejemplo, un documento ya reescrito), si no hay párrafo con
    `precio_numero` y si hay dos.
- **`backend/test/documentBuilderService.currency.test.js`**:
  - `preprocessMissingFieldOverrides`: cada celda de la tabla de la sección 3, más
    `precio_texto` = `mil doscientos noventa` para `1290` en las dos monedas, y el `Error` con una
    moneda desconocida.
  - `generateAndPersist` (sin `dryRun`) con una plantilla mock con `currency_code: 'USD'` y
    `country_code` coherente con el proveedor: el `contract_overrides` que se guarda trae
    `precio_numero: 'US$1,290'`. Con `currency_code: 'CLP'`, trae `'$1.290'`. Copia a este archivo
    el andamiaje de mocks que necesites de `documentBuilderService.test.js`; no lo importes ni lo
    modifiques.

## 8. Puntos de atención

- El orden en `generateAndPersist`: hoy `preprocessMissingFieldOverrides` corre antes de
  `loadCompanyRow` y `getTemplateRow`. Al mover la carga de la plantilla, el 404 «Plantilla no
  encontrada.» y el error de coherencia de país tienen que seguir saliendo igual. Las pruebas
  existentes lo cubren.
- `validateSelectOverrides` usa los overrides crudos y no depende de la moneda. No lo muevas.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test`. Las
  dos en verde.
