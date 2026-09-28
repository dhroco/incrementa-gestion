# Recorte · precio-entero-estricto

> Encargo de Ignacio (arquitecto), 28-sep-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/moneda-plantilla.md`, sección «El precio mal escrito».

## 1. Objetivo

El precio de un contrato (`precio_numero`) se lee con `parseIntegerOverride`
(`backend/services/documentBuilderService.js`), que quita los puntos y aplica `parseInt`. Lo que no
calza lo cambia **sin avisar**: `1,290` → `1` (el contrato en dólares sale por US$1), `1290.50` →
`129050`, `12,5` → `12`, `290 USD` → `290`.

Al terminar:
- **El precio se acepta solo como entero limpio**: `1290`, o agrupado de a tres con **un solo tipo**
  de separador: `1.290`, `1.500.000`, `1,290`, `1,500,000`.
- **Todo lo demás se rechaza** con un mensaje en español y el contrato no se genera (tampoco el
  `dryRun`).
- Los precios limpios se escriben exactamente igual que hoy, en las dos monedas.

## 2. Arquitectura

- **Función pura nueva** `parsePriceInput(value)` en `documentBuilderService.js`, exportada:
  devuelve `{ ok: true, value: <entero> }` o `{ ok: false, message }`.
- **`generateAndPersist`**: si `overridesRaw.precio_numero` viene con valor (no `null`, no vacío
  tras `trim`), lo valida con `parsePriceInput` **antes** de `preprocessMissingFieldOverrides`. Si
  no es válido, devuelve
  `{ ok: false, status: 400, code: 'VALIDATION_ERROR', message }`, igual que los otros errores de
  validación de esa función. Vale para `dryRun` y para la generación real.
- **`preprocessMissingFieldOverrides`** usa `parsePriceInput` para el precio en vez de
  `parseIntegerOverride`. Si recibe un precio inválido (solo puede pasar si alguien la llama directo),
  deja `precio_numero` como vino y no genera `precio_texto`, que es lo que hace hoy con un valor que
  `parseInt` no entiende.
- `parseIntegerOverride` **se queda como está** para `cantidad_reels`, `duracion_ejecucion` y
  `dias_cesion`: esos campos quedan fuera.
- El formato de salida (`formatPriceNumber`, `CURRENCY_FORMAT`) y `precio_texto` (`numberToWords`)
  no cambian.
- Sin cambios de frontend, de la API ni del MCP: el mensaje sale por el mismo camino que los errores
  de validación de hoy. Sin migraciones ni dependencias nuevas.

## 3. Regla

Sobre la entrada convertida a texto y con `trim()` en los extremos:

| Entrada | Resultado |
|---|---|
| `1290` · `0` · `1500000` | ok, el entero |
| `1.290` · `1.500.000` · `12.345` | ok, `1290` · `1500000` · `12345` |
| `1,290` · `1,500,000` | ok, `1290` · `1500000` |
| `' 1290 '` | ok, `1290` (solo se recortan los extremos) |
| número `1290` (no texto) | ok, `1290` |
| `1,290.50` · `1290.50` · `1290,5` · `12,5` · `1.29` | rechazo |
| `1.290,000` · `1,290.000` (separadores mezclados) | rechazo |
| `1.2900` · `12.90` · `.290` · `1.` · `1..290` (grupos mal formados) | rechazo |
| `$1290` · `US$1,290` · `290 USD` · `1 290` · `-1290` · `abc` | rechazo |

Expresión de referencia: `^\d+$`, o `^\d{1,3}(\.\d{3})+$`, o `^\d{1,3}(,\d{3})+$`.

Mensaje de rechazo, siempre el mismo:
**«El precio debe ser un número entero, sin decimales ni símbolos. Por ejemplo: 1290, 1.290 o
1,290.»**

## 4. Recomendaciones

- Tres expresiones regulares cortas se leen mejor que una sola larga.
- Actualiza el comentario de `parseIntegerOverride` (o agrégale uno) para que diga que ya no se usa
  para el precio.

## 5. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`.
- Nada que se conecte a la base; sin migraciones.
- Mensajes, documentación y commits en español.

## 6. Pruebas existentes

Ninguna prueba existente cambia. **No modifiques ningún archivo de prueba existente.** Todas usan
precios limpios (`1290`, `1500000`), así que tienen que seguir pasando. Si cualquier prueba existente
falla, **no la ajustes: consulta a la mesa.**

## 7. Pruebas nuevas

**Todas en el archivo nuevo `backend/test/documentBuilderService.priceInput.test.js`.** Ejecutan el
comportamiento; ninguna lee el código fuente ni se conecta a la base.

- **`parsePriceInput`**: cada fila de la tabla de la sección 3, con el valor en los aceptados y el
  mensaje exacto en los rechazados.
- **`preprocessMissingFieldOverrides`**: `1,290` en `USD` da `US$1,290` y `mil doscientos noventa`;
  `1.290` en `CLP` da `$1.290`; un precio inválido queda tal cual y sin `precio_texto`.
- **`generateAndPersist`**, con `dryRun: true` y también sin `dryRun`: `precio_numero: '1,290.50'`
  devuelve `ok: false`, `status: 400`, `code: 'VALIDATION_ERROR'` y el mensaje exacto, y **no se
  guarda nada** (no hay insert en `draft_document` ni subida a GCS). Con `'1,290'` y una plantilla
  `USD`, el `contract_overrides` guardado trae `precio_numero: 'US$1,290'`. Copia a este archivo el
  andamiaje de mocks que necesites de `documentBuilderService.currency.test.js`; no lo importes ni lo
  modifiques.

## 8. Puntos de atención

- El formulario web usa `<input type="number">`, que ya limita la entrada. Los precios mal escritos
  llegan sobre todo por el MCP y la API. Este recorte no toca ninguno de los dos: el rechazo en el
  backend alcanza a todos los canales.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test`. Las
  dos en verde.
