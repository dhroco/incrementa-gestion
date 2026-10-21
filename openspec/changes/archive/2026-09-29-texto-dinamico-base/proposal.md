## Why

Las cláusulas del objeto (2.3 y 2.5) necesitan un texto que no cabe en variables fijas: «cinco (5) reels en TikTok y cuatro (4) reels en Facebook», y la cuenta del influencer en cada red nombrada. Quien completa el contrato tiene que redactarlo en el momento de crearlo y dejarlo incrustado en la cláusula. Este recorte construye solo el mecanismo (`dynamic_text`) y define esos dos textos. Ninguna plantilla cambia, así que ningún contrato existente cambia.

## What Changes

- El catálogo del backend gana el tipo `dynamic_text`, con instrucción y ejemplos para `servicios_entregables` y `cuentas_publicacion`.
- Esos ids se declaran en `VARIABLE_META` con `type: 'dynamic_text'` y `source: 'contract'`. Un id del catálogo se resuelve como `dynamic_text` aunque todavía no esté en ninguna plantilla.
- El campo faltante de ese tipo trae `instruccion`, `ejemplos` y `contexto` (el párrafo de la plantilla, con el hueco como `⟨…⟩` y el resto de variables como `{{id}}`). Los campos de los tipos actuales no ganan propiedades.
- Antes de sustituir, el valor se normaliza (extremos recortados, todo espacio interno colapsado a un espacio). Más de 500 caracteres se rechaza con 400 `VALIDATION_ERROR` y el mensaje «El texto de «<label>» no puede superar los 500 caracteres.». El valor normalizado es el que se sustituye y el que se guarda en `contract_overrides`.
- La sustitución no cambia: el texto dinámico se reemplaza como cualquier variable.
- El editor de plantillas muestra esas variables con un color propio y la etiqueta «Texto dinámico».
- El Constructor las pide en un área de texto con la instrucción, los ejemplos (visibles, sin insertarlos al hacer clic), el párrafo con el hueco resaltado y un contador «N / 500».
- La descripción de `validar_contrato` incluye `dynamic_text` y, al final, las reglas que le prohíben al agente redactar el texto por su cuenta. Las frases que ya existen no se editan.

## Capabilities

### New Capabilities

- `dynamic-text`: catálogo de textos dinámicos, resolución del campo faltante (`instruccion`, `ejemplos`, `contexto`), normalización y tope de 500 caracteres, área de texto en el Constructor y distinción visual en el editor de plantillas.

### Modified Capabilities

- `enriched-missing-fields`: `VARIABLE_META` acepta el tipo `dynamic_text`. `buildMissingFields` y `resolveFieldDefinition` aceptan `templateDoc` opcional para calcular `contexto`. Los tipos `text`, `date`, `select` y `number` conservan la forma actual del campo faltante.
- `document-builder-supplier-context`: el grupo `contrato` del catálogo del editor incluye `servicios_entregables` y `cuentas_publicacion`, con `type: 'dynamic_text'` y la instrucción como descripción.
- `backend-mcp-server`: la descripción de `validar_contrato` agrega `dynamic_text` a la lista de tipos y, al final, el párrafo que obliga a pedir el texto literal y prohíbe redactarlo, completarlo, corregirlo o inferirlo.

## Impact

**Backend:** `backend/services/dynamicTextCatalog.js` (nuevo), `backend/services/documentBuilderService.js` (`VARIABLE_META`, `resolveFieldDefinition`, `buildMissingFields`, validación en `generateAndPersist`), `backend/mcpTools.mjs` (solo se agrega texto a la descripción de `validar_contrato`). Pruebas nuevas en `backend/test/dynamicText.test.js` y `backend/test/mcpDynamicText.test.js`. Ningún archivo de prueba existente se modifica.

**Frontend:** `frontend/src/data/variableCatalog.js`, `VariableRenderer.jsx`, `VariableCatalog.jsx`, `DocumentBuilderPage.jsx` (`MissingFieldInput`) y el CSS del chip. Prueba nueva en `frontend/src/pages/DocumentBuilderPage.dynamicText.test.jsx`.

**APIs:** mismos endpoints. Un texto dinámico de más de 500 caracteres responde 400 `VALIDATION_ERROR`. El campo faltante de ese tipo suma `instruccion`, `ejemplos` y `contexto`. Sin endpoints nuevos.

**Datos:** sin migraciones ni seeds. Ninguna plantilla ni tabla cambia. El valor, cuando se use, queda en `contract_overrides` como hoy.

**Dependencias:** ninguna nueva.

## Consideraciones de seguridad

El texto dinámico es contenido libre que queda impreso en un contrato con efectos legales y se guarda en `contract_overrides`. Puede nombrar cuentas de redes del influencer. El sistema no lo redacta ni lo “corrige”: guarda el texto que la persona aprobó, después de normalizar espacios.

- El control está en el backend, en el mismo punto que la validación del precio, y vale para la API y para el MCP. El `maxLength` del textarea es solo de interfaz.
- El rechazo no reescribe el texto ni lo devuelve en el mensaje. El mensaje nombra el `label` del catálogo.
- Las reglas del MCP son una mitigación de prompt, no un control: el backend recibe un valor, no una conversación, y no verifica que el agente haya preguntado. El agente tiene prohibido usar un texto que la persona no aprobó de forma explícita.
- Los ejemplos se muestran y no se insertan con un clic, para no dejar en el contrato un ejemplo copiado sin adaptarlo.
- Sin endpoints, columnas, grants ni secretos nuevos. No se registra el texto rechazado.

**Validación:**

| Campo | Dónde | Regla |
| --- | --- | --- |
| Override `dynamic_text` con valor | Backend, al generar (también en `dryRun`) | Recortar extremos y colapsar todo espacio en blanco interno, incluidos los saltos de línea, a un espacio. Si el resultado supera 500 caracteres, 400 `VALIDATION_ERROR` con «El texto de «<label>» no puede superar los 500 caracteres.». 500 caracteres pasan. El valor normalizado es el que se sustituye y se persiste. |
| Override `dynamic_text` vacío o ausente | Backend | Sigue el camino actual del campo faltante: no se valida el largo. |
| Área de texto | Frontend | `<textarea>` de 3 filas, `maxLength={500}` y contador «N / 500». La instrucción va encima; los ejemplos, debajo, precedidos de «Ejemplos:». |
| Mensajes | Backend y frontend | En español (`es-CL`). El error de largo usa el `label` del catálogo. |
