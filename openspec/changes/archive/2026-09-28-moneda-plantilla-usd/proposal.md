## Why

El precio de un contrato se escribe siempre a la chilena, y las plantillas mexicanas CONTRATO_0016 y CONTRATO_0017 imprimen el texto de relleno «(Tipo de moneda País)». Un contrato mexicano sale hoy «…en moneda de curso legal en (Tipo de moneda País), de $290 doscientos noventa líquido…». La moneda es fija por plantilla (México usa dólares, no pesos mexicanos) y hay que dejarla en los datos ahora, antes de seguir emitiendo PDFs con el relleno y el formato chileno.

## What Changes

- `template` gana `currency_code` (`CLP` o `USD`, obligatorio, `CLP` por omisión). CONTRATO_0016 y CONTRATO_0017 quedan en `USD`; el resto, en `CLP`.
- `precio_numero` se formatea según la moneda de la plantilla: `$1.290` en `CLP` (igual que hoy) y `US$1,290` en `USD`.
- `precio_texto` no cambia: sigue siendo el número en palabras (`numberToWords`), sin sufijo de moneda.
- La cláusula 3.1 de CONTRATO_0016 y CONTRATO_0017 pasa a decir «…en dólares de los Estados Unidos de América, de US$1,290 (mil doscientos noventa dólares de los Estados Unidos de América) líquido…». El `content_json` previo se respalda. Las plantillas chilenas no cambian de redacción.
- El precio ya formateado se guarda en `contract_overrides`. El listado de contratos muestra `US$1,290` sin tocar la consulta ni el frontend.
- Sin cambio de contrato de la API, sin frontend, sin dependencias nuevas y sin tocar el MCP (usa los mismos services).

**No entra:** montos con decimales; parsear una entrada que ya traiga coma de miles (`1,290` hoy se lee como `1`); elegir la moneda en la interfaz de plantillas; otras monedas; reescribir contratos ya generados.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `document-builder-supplier-context`: `template.currency_code`; CONTRATO_0016 y CONTRATO_0017 en `USD` con la cláusula 3.1 reescrita y respaldo del `content_json`; al generar, el precio usa la moneda de la plantilla. El control de coherencia país–plantilla no cambia.
- `template-variable-pairs`: el preproceso de `precio_numero` deja de ser siempre chileno y depende de `currency_code` (`$1.290` en `CLP`, `US$1,290` en `USD`). `precio_texto` sigue saliendo de `numberToWords`.

## Impact

**Backend:** migración `202609280001_template_currency_code.js` (columna y `CHECK`, antes del deploy) y `202609280002_mx_price_clause_usd.js` (marca USD, respaldo y reescritura de las dos plantillas mexicanas, después del deploy; su `down` restaura el texto y vuelve esas plantillas a `CLP`). `documentBuilderService.js`: `getTemplateRow` selecciona `currency_code`; `generateAndPersist` carga la plantilla antes de preprocesar los overrides y formatea el precio con esa moneda. Sin cambios de firma en REST ni MCP.

**Frontend:** ninguno. La moneda no se elige en pantalla.

**APIs:** ninguna. El 404 «Plantilla no encontrada.» y el error de coherencia de país siguen igual.

**Datos:** las dos plantillas USD reciben `content_json` nuevo; el anterior queda en `template_content_backup`. Los PDF ya emitidos no se tocan. La migración la aplica David después de fusionar; este change no la corre.

## Consideraciones de seguridad

`currency_code` no es dato personal. El precio ya se persiste en `contract_overrides` y en el PDF; este change solo cambia cómo se escribe. No hay grants nuevos, ni endpoints nuevos, ni campos nuevos en la respuesta de la API.

**Validación:**

| Campo | Dónde | Regla |
| --- | --- | --- |
| `template.currency_code` | Base | Obligatorio, `CLP` o `USD` (`CHECK`). Nadie lo elige en el frontend: lo fija la migración. |
| Moneda al preprocesar el precio | Backend | Vacía o ausente se trata como `CLP`. Un valor distinto de `CLP` o `USD` es error de programación (`Error`); la base no lo admite, así que no llega al usuario. |
| Reescritura de la cláusula 3.1 | Migración | Si el párrafo no calza exactamente, `up` falla y no deja las plantillas a medias. |

Los mensajes de error dirigidos al usuario siguen en español (`es-CL`). El formato chileno de miles (`$1.290`) se conserva para `CLP`; `USD` usa coma de miles (`US$1,290`).
