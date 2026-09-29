## Context

Las cláusulas 2.3 y 2.5 necesitan una frase libre («cinco (5) reels en TikTok y cuatro (4) reels en Facebook», y la cuenta en cada red). Hoy una variable del contrato es `text`, `date`, `select` o `number`: el Constructor y `validar_contrato` la piden con ese tipo, y el valor entra por `missingFieldOverrides`, se preprocesa y se guarda en `contract_overrides`. Ninguna de esas formas acepta una frase con varias cantidades y varias redes.

El dominio está cerrado en `docs/disenos/texto-dinamico.md`. Este recorte es solo el primero: el tipo `dynamic_text` y los dos textos `servicios_entregables` y `cuentas_publicacion`. No migra plantillas, no revisa la redacción y no agrega los textos de evento.

`VARIABLE_META` y `getVariableMeta` viven en `backend/services/documentBuilderService.js`. Un id que no está en el mapa cae a `{ label: key, type: 'text' }`. `resolveFieldDefinition` arma el campo faltante; `buildMissingFields` lo llama sin el documento de la plantilla. `generateAndPersist` ya rechaza el precio inválido después de cargar la plantilla y antes de `preprocessMissingFieldOverrides`, y en ese mismo tramo arma `mergedDoc` con `materializeTemplateMergedDoc`. El texto plano sale de `tipTapDocToPlainTextAsync`, que escribe cada nodo `variable` como `{{id}}`.

En el frontend, el grupo `contrato` de `variableCatalog.js` no tiene `type`. El chip del editor se pinta por `data-group`. `MissingFieldInput` no está exportado y cae a un `<input type="text">` para cualquier tipo distinto de select, date o number. La descripción de `validar_contrato` es un solo string; `backend/test/mcpServer.test.js` busca frases exactas de ese string y de `generar_contrato`.

## Goals / Non-Goals

**Goals:**

- Catalogar `servicios_entregables` y `cuentas_publicacion` con la instrucción y los ejemplos del encargo, y resolverlos como `dynamic_text` aunque ninguna plantilla los use todavía.
- Entregar en el campo faltante `instruccion`, `ejemplos` y `contexto` (el primer párrafo, con el hueco en `⟨…⟩`). Los tipos actuales no ganan propiedades.
- Normalizar el valor (extremos recortados, todo espacio interno a un espacio) y rechazar más de 500 caracteres antes de preprocesar, en `dryRun` y en la generación real. El valor normalizado es el que se sustituye y el que queda en `contract_overrides`.
- Pedirlo en el Constructor con área de texto, instrucción, ejemplos, vista previa y contador, y distinguirlo en el editor con un color del sistema de diseño.
- Decirle al agente, al final de la descripción de `validar_contrato`, que no redacte ese texto por su cuenta.

**Non-Goals:**

- Cambiar plantillas, cláusulas, `cantidad_reels`, `formato_reel` o `proveedor_cuenta_social`. Ningún contrato existente cambia.
- La revisión de redacción, «Generar igual», `evento_servicio`, `formato_periodo_publicacion` y la herramienta `revisar_redaccion`.
- Migraciones, seeds, dependencias, endpoints o columnas nuevas.
- Editar las frases ya presentes en las descripciones de `validar_contrato` y `generar_contrato`, salvo insertar `dynamic_text` en la lista `type (text/date/select/number)`.
- Tocar `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`, `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`, `.agent-orchestrator/**`.
- Modificar cualquier archivo de prueba existente.

## Decisions

### 1. Un catálogo, y el mapa lo referencia

`backend/services/dynamicTextCatalog.js` exporta `DYNAMIC_TEXT_CATALOG` y `getDynamicTextDefinition(id)`. Cada entrada es `{ label, instruccion, ejemplos }`. `getDynamicTextDefinition` devuelve la entrada o `undefined`.

| id | label | instruccion | ejemplos |
| --- | --- | --- | --- |
| `servicios_entregables` | `Entregables (cláusula 2.3)` | `Escribe qué publicará el influencer: cantidad en palabras y en cifra, formato y red social de cada entregable.` | `un (1) reel en Instagram` · `cinco (5) reels en TikTok y cuatro (4) reels en Facebook` · `dos (2) stories y un (1) reel en Instagram` |
| `cuentas_publicacion` | `Cuentas de publicación (cláusula 2.5)` | `Escribe la cuenta del influencer en cada red social nombrada en los entregables.` | `su cuenta de Instagram @danarebolledo` · `su cuenta de TikTok @danarebolledo y su cuenta de Facebook Dana Rebolledo` |

`VARIABLE_META` gana una entrada por id, armada desde el catálogo: `{ label: def.label, type: 'dynamic_text', source: 'contract' }`. El `label` no se vuelve a escribir. `getVariableMeta('servicios_entregables')` y `getVariableMeta('cuentas_publicacion')` devuelven ese tipo aunque el id no esté en una plantilla. Un id desconocido sigue en `{ label: key, type: 'text' }`.

La instrucción y los ejemplos del backend salen solo de ese archivo. El editor repite `label` e `instruccion` (como `description`) en `variableCatalog.js`; los ejemplos no se copian ahí: llegan en el campo faltante.

**Alternativa descartada:** guardar instrucción y ejemplos dentro de `VARIABLE_META`. Duplica el texto y el encargo pide una sola fuente en el backend.

### 2. `contexto` es el primer párrafo, con el mismo recorrido de nodos

`resolveFieldDefinition(key, { clientRow, supplierRow, templateDoc })` y `buildMissingFields(missingKeys, { clientRow, supplierRow, templateDoc })` aceptan `templateDoc` opcional. Si `getVariableMeta(key).type === 'dynamic_text'`, el campo suma:

- `instruccion` y `ejemplos`, copiados del catálogo;
- `contexto`: el texto plano del primer nodo `paragraph` (orden del documento, en profundidad) que contiene un nodo `variable` con ese `variableId`. Dentro de ese párrafo el recorrido es el de `tipTapDocToPlainTextAsync`: el texto se copia, un `hardBreak` es un salto de línea, las otras variables quedan `{{id}}`, y esta variable queda `⟨…⟩` (U+27E8, U+2026, U+27E9). No se le agrega el `\n\n` con el que el documento completo separa párrafos; sí se recorta el espacio final del párrafo, como ya hace ese walker. Si el id está en varios párrafos, se usa el primero. Sin `templateDoc`, o si ningún párrafo lo contiene, `contexto` es `null`.

Un encabezado no es un párrafo: si el id solo aparece en un `heading`, `contexto` es `null`. No se modifica `tipTapPlainText.js`.

`generateAndPersist` ya tiene `mergedDoc` antes de armar los campos faltantes. Esa llamada pasa `templateDoc: mergedDoc`. Las demás llamadas a `resolveFieldDefinition` (la validación de selects) pueden omitirlo: no leen `contexto`.

Los campos que no son `dynamic_text` no reciben `instruccion`, `ejemplos` ni `contexto`. `documentBuilderService.dryRun.test.js` y `documentBuilderApi.test.js` comparan esos objetos con `deepEqual`.

**Alternativa descartada:** reemplazar `{{id}}` con una expresión regular sobre el texto plano del documento entero. Mezcla párrafos y no distingue la variable objetivo si el token está escrito a mano en un nodo de texto. El hueco se marca solo en el nodo `variable`.

### 3. Normalizar y cortar en 500 antes de preprocesar

En `generateAndPersist`, en el mismo tramo que el precio: después de encontrar la plantilla y antes de `preprocessMissingFieldOverrides`. El rechazo del precio sigue primero. Después, para cada override cuyo `getVariableMeta(key).type` es `dynamic_text` y cuyo valor no está vacío (`!= null` y `String(value) !== ''`):

1. `String(value).trim().replace(/\s+/g, ' ')`.
2. Si `length` es mayor que 500, devolver `{ ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'El texto de «<label>» no puede superar los 500 caracteres.' }`. El `label` es el del catálogo. Si hay más de uno, gana el primero en el orden de las claves del objeto. No se persiste ni se sube nada. Vale con `dryRun` y sin él.
3. Si no, esa clave queda con el texto normalizado. Ese valor entra al preproceso, a la sustitución y a `contract_overrides`.

El preproceso no formatea este tipo: no hay palabras, miles ni fecha. Comas y paréntesis se conservan. Un override ausente o `''` no entra a la validación. 500 caracteres pasan; 501 no.

**Alternativa descartada:** validar dentro de `preprocessMissingFieldOverrides`. Ese camino no puede devolver el 400, y las pruebas del preproceso comparan el objeto de salida de los tipos actuales.

### 4. El Constructor muestra el párrafo y no inserta los ejemplos

`MissingFieldInput` se exporta sin cambiar lo que ya hace con select, date, number y text. La rama `field.type === 'dynamic_text'` renderiza:

- la `instruccion` encima del control;
- un `<textarea rows={3} className="clause-input" maxLength={500}>`;
- el contador `N / 500`, con `N` igual a `value.length` de lo que hay en el control (no el texto ya normalizado);
- debajo, el texto `Ejemplos:` y los `ejemplos` en una lista. No hay clic que los copie al área de texto;
- si `contexto` es un string, la vista previa reemplaza `⟨…⟩` por lo escrito, dentro de un `span` resaltado, o por `…` si el campo está vacío.

El resaltado usa color `var(--color-selection)` y peso 600. No usa `<mark>`: el amarillo del navegador no está en el sistema de diseño.

### 5. El chip usa tokens que ya existen

`VariableRenderer` pone `data-kind="dynamic_text"` cuando `getVariableById(variableId)` tiene `type: 'dynamic_text'`. En `styles.module.css`, después de las reglas de `data-group`, ese atributo pinta el chip con fondo `var(--color-form-field-readonly-bg)`, borde y texto `var(--color-selection)`. El hover pasa borde y texto a `var(--color-main-headerbar)`, que es el par de hover ya definido para `--color-selection`. Esas variables están en `frontend/src/styles/variables.css`. No se agregan hex.

En `VariableCatalog.jsx`, esas entradas muestran además la etiqueta `Texto dinámico`.

**Alternativa descartada:** un naranja, azul o verde nuevo, del estilo de los chips por grupo. Esos hex no están en `openspec/config.yaml`.

### 6. La descripción del MCP solo se alarga

En el string de `validar_contrato`, la lista pasa a `type (text/date/select/number/dynamic_text)`. El resto de las frases queda igual. Al final se agrega:

`Para type='dynamic_text' el campo trae instruccion, ejemplos y contexto. Muéstrale a la persona la instrucción, los ejemplos y el contexto, y pídele el texto literal. Está PROHIBIDO redactarlo, completarlo, corregirlo o inferirlo por cuenta propia, aunque la conversación lo sugiera. Si la persona pide ayuda, puedes proponer un texto, pero solo lo usas si la persona lo aprueba de forma explícita. El texto se pasa en missingFieldOverrides tal como quedó aprobado.`

`generar_contrato` no se edita. Igual que en los `select`, esto es una mitigación de prompt: el backend no comprueba que haya habido una conversación.

## Risks / Trade-offs

- [Un campo faltante de tipo actual gana `instruccion` y rompe un `deepEqual`] → Esas claves se agregan solo cuando `type === 'dynamic_text'`. Si una prueba existente falla, no se ajusta: se consulta a la mesa.
- [La descripción de `validar_contrato` pierde una frase que `mcpServer.test.js` busca] → El único cambio dentro del texto actual es la lista de tipos. Lo demás se agrega al final. `generar_contrato` no se toca.
- [El contador cuenta saltos de línea que el backend va a colapsar] → El tope de la interfaz es `maxLength`. El que vale es el de después de normalizar, en el backend.
- [El id está solo en un encabezado y `contexto` llega `null`] → El encargo pide el párrafo. La vista previa se omite si `contexto` no es un string.
- [El agente redacta el texto igual] → La descripción se lo prohíbe y le exige aprobación explícita. El servidor guarda el valor recibido, ya normalizado. No hay un control de conversación, igual que hoy con los `select`.

## Migration Plan

No hay migración ni cambio de datos. Ninguna plantilla pasa a usar estos ids en este recorte. El despliegue es el del backend y el del frontend. Rollback: revertir el cambio. No hay filas que deshacer.

## Open Questions

Ninguna. El catálogo, el tope de 500, el mensaje y el texto que se agrega al MCP quedan cerrados en el encargo.
