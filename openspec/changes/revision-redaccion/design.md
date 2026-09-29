## Context

Quien completa un contrato redacta los textos dinámicos (`servicios_entregables`, `cuentas_publicacion`) y ese texto queda impreso en el PDF. `texto-dinamico-base` ya los pide, los normaliza y los sustituye. `texto-dinamico-plantillas` ya los dejó en las cláusulas. No hay revisión de redacción ni evidencia de qué se vio antes de generar.

`generateAndPersist` valida, preprocesa y, si faltan variables, devuelve 422 `MISSING_PLACEHOLDERS`. Con `dryRun: true` corta ahí y no persiste. Sin `dryRun` resuelve duplicados, sustituye con `applySubstitutionsToTipTapDoc`, arma el PDF y inserta `draft_document`. El Constructor llama a ese `dryRun` al elegir plantilla y deja los campos faltantes en pantalla hasta generar. El botón sigue diciendo «Generar PDF y guardar». El MCP llama al mismo servicio: `validar_contrato` con `dryRun`, `generar_contrato` sin él. `backend/test/mcpServer.test.js` exige la frase `confirmación explícita` en la descripción de `generar_contrato` y no se puede editar ese texto.

El dominio está en `docs/disenos/texto-dinamico.md`, sección 3.3, con la decisión (d): se puede «Generar igual» dejando motivo, y no se puede generar sin una revisión de los valores actuales. El `system` que usa el revisor es el texto exacto de la sección 3 del encargo, no la lista más larga del diseño (ítems de evento y de fechas). Esos ítems pertenecen a `contrato-por-evento`.

## Goals / Non-Goals

**Goals:**

- Revisar la sección SEGUNDO ya sustituida con Claude y devolver `ok` u `observaciones` con una sugerencia por problema.
- Guardar cada revisión y apuntar el borrador a la que se usó, con el motivo si se generó igual.
- Exigir esa revisión al generar solo cuando la plantilla tiene al menos un `dynamic_text`. El `dryRun` y las plantillas sin ese tipo no cambian.
- Ofrecer el mismo paso en el Constructor y en el MCP, incluida la prohibición de aplicar una sugerencia o de redactar el motivo sin la persona.

**Non-Goals:**

- `contrato-por-evento`, el anexo de entregables, y ampliar el `system` con los ítems 4 y 5 de la sección 3.3 del diseño (evento completo y fechas coherentes).
- Correr la migración, llamar a Claude desde una prueba, o conectarse a una base desde las pruebas nuevas.
- Modificar un archivo de prueba existente, o las frases ya escritas en las descripciones de `validar_contrato` y `generar_contrato`.
- Tocar `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`, `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`, `.agent-orchestrator/**`.
- Otra dependencia que no sea `@anthropic-ai/sdk`.

## Decisions

### 1. Un cliente inyectable, y la clave no se construye en el mensaje

`backend/lib/contractReviewer.js` exporta `createContractReviewer({ apiKey, client } = {})`, `isReviewerConfigured()` y `ContractReviewerError`.

Sin argumentos, `apiKey` sale de `ANTHROPIC_API_KEY` en `backend/config.js` (el archivo no se edita) y el cliente es `new Anthropic({ apiKey })` de `@anthropic-ai/sdk`. Construir el cliente sin clave no lanza: `isReviewerConfigured()` queda en falso y `review()` lanza `ContractReviewerError` con `code: 'REVIEW_UNAVAILABLE'`. `client` se inyecta en las pruebas y, si viene, el revisor está configurado.

`review({ sectionText, dynamicTexts, datos })` llama a `client.messages.parse` con:

- `model: 'claude-opus-5'`
- `max_tokens: 16000`
- el `system` exacto de la sección 3 del encargo
- un mensaje `user` cuyo texto es `JSON.stringify` de `{ sectionText, dynamicTexts, datos }`
- `output_config: { format: zodOutputFormat(ReviewSchema) }`, con `zodOutputFormat` de `@anthropic-ai/sdk/helpers/zod` y el `zod` que ya usa el backend

`ReviewSchema` es `{ verdict: 'ok' | 'observaciones', observations: [{ dynamicTextId, clause, problem, suggestion }] }`, todos string. La función devuelve `{ verdict, observations, model }` desde `parsed_output`, con `model: 'claude-opus-5'`.

Si `stop_reason` es `'refusal'`, si `parsed_output` es `null`, o si el SDK lanza, lanza `ContractReviewerError` con `code: 'REVIEW_UNAVAILABLE'`. El mensaje de ese error no contiene la clave. Ningún `console` ni el mensaje de la API la incluyen.

Si `verdict` es `'ok'`, `observations` queda `[]`. Si `observations` trae al menos un elemento, `verdict` queda `'observaciones'`. Así las dos cosas no se contradicen.

**Alternativa descartada:** revisar con el mismo agente del MCP. El Constructor no lo tiene, y quien redacta no debe ser quien revisa.

### 2. La entrada y el hash son funciones puras, compartidas

`backend/services/contractReviewInput.js` exporta funciones puras. `reviewDraft` y la verificación de `generateAndPersist` usan las mismas. Si cada camino armara el JSON por su cuenta, el hash no calzaría.

La entrada es `{ sectionText, dynamicTexts, datos }`, con las claves en ese orden:

- **`sectionText`.** Texto plano del documento ya sustituido. Se recorren los bloques `paragraph` y `heading` en orden de documento. El texto de cada bloque sale del mismo recorrido que `tipTapDocToPlainTextAsync` (sin el separador entre bloques). Se toma desde el bloque cuyo texto, ya recortado, empieza con `SEGUNDO`, inclusive, hasta el bloque anterior al que empieza con `TERCERO`. Esos bloques se unen con `\n\n`. Si falta `SEGUNDO` o falta `TERCERO`, `sectionText` pasa a ser solo los `paragraph` cuyo texto recortado empieza con `2.` seguido de un dígito, unidos igual.
- **`dynamicTexts`.** Un ítem por cada variable de la plantilla cuyo tipo es `dynamic_text`, en orden de primera aparición: `{ id, label, instruccion, value }`. `label` e `instruccion` salen del catálogo. `value` es el valor ya normalizado. Claves en ese orden.
- **`datos`.** `{ redesDelProveedor, mes_ejecucion, fecha_contrato }`. `redesDelProveedor` es `[{ red, cuenta }]` desde `supplier.social_networks` (`name` → `red`, `account_name` → `cuenta`), en el orden del proveedor. Si no hay redes, es `null`. `mes_ejecucion` y `fecha_contrato` salen de los overrides ya normalizados; si el dato no está, es `null`. No se envía ninguna otra clave. No van RUT, direcciones ni precio.

`input_hash` es el hex de sha256 de `JSON.stringify` de ese objeto, con las claves en el orden de arriba y sin espacios agregados.

`reviewed_text` de la fila es ese `sectionText`.

**Alternativa descartada:** hashear los overrides crudos. Un espacio colapsado por la normalización cambiaría el hash sin cambiar lo que el revisor vio.

### 3. `reviewDraft` es el `dryRun` más la sustitución, y no genera PDF

`createDocumentBuilderService` recibe `contractReviewer`. `app.js` y `mcpServer.mjs` se lo pasan como al resto de los servicios. Las pruebas pasan uno falso.

`reviewDraft({ userId, requestedCompanyId, body })` recibe el mismo `body` que `generateAndPersist` y recorre el mismo camino hasta la sustitución: empresa, proveedor, plantilla, perfil, precio, textos dinámicos, preproceso, coherencia de país y el 422 `MISSING_PLACEHOLDERS`. No busca duplicados, no sube a GCS y no escribe `draft_document`.

- Si la plantilla no tiene ningún `dynamic_text`, devuelve 400 `REVIEW_NOT_NEEDED` con el mensaje «Esta plantilla no tiene textos dinámicos que revisar.».
- Si el revisor no está configurado o `review()` lanza, devuelve 503 `REVIEW_UNAVAILABLE` con el mensaje «No se pudo revisar la redacción en este momento. Intenta de nuevo en unos minutos.».
- Si no, inserta una fila en `contract_review` y devuelve `{ ok: true, data: { reviewId, verdict, observations } }`.

### 4. La puerta de generación queda entre la sustitución y el PDF

En `generateAndPersist`, sin `dryRun` y solo si la plantilla tiene al menos un `dynamic_text`, un solo bloque verifica la revisión. Corre sobre el documento ya sustituido, el mismo con el que se calcula el hash, y antes de `buildPdfBytesFromTipTapWithReactPdf`.

Para no borrar el borrador anterior si la revisión no sirve, la sustitución y ese bloque quedan antes del delete de GCS y de la fila que hace `overwrite`. El retorno `DUPLICATE_DRAFT` (cuando `overwrite` no es `true`) sigue donde está: no exige revisión, porque todavía no se genera. Las plantillas sin `dynamic_text` no entran al bloque, así que sus pruebas siguen sin `reviewId`.

La revisión tiene que existir y coincidir en `company_id`, `supplier_id`, `template_id` e `input_hash` recalculado ahora. Si no, 409 `REVIEW_REQUIRED`: «Revisa la redacción antes de generar: no hay una revisión de los textos actuales.».

Si `verdict` es `'observaciones'`, hace falta `body.generarIgual.motivo` con al menos 10 caracteres después de `trim`. Si falta o es más corto, 409 `REVIEW_HAS_OBSERVATIONS`: «La revisión tiene observaciones. Corrige el texto o usa «Generar igual» indicando el motivo.».

El `insert` de `draft_document` guarda `review_id`. Guarda `review_override_reason` solo cuando el veredicto es `'observaciones'` y el motivo pasó el corte. Con `'ok'`, `review_override_reason` queda `null` aunque el body traiga `generarIgual`.

**Alternativa descartada:** exigir la revisión también en el `dryRun`. `validar_contrato` dejaría de servir para completar campos.

### 5. Tabla `contract_review` y dos columnas en el borrador

Migración `backend/migrations/202609290002_contract_review.js`. No se corre en este change.

`contract_review`, con los mismos tipos y FK que `draft_document`:

| Columna | Tipo |
| --- | --- |
| `id` | uuid PK, `gen_random_uuid()` |
| `company_id` | uuid not null, FK `company`, `ON DELETE CASCADE` |
| `supplier_id` | uuid not null, FK `supplier`, `ON DELETE CASCADE` |
| `template_id` | uuid not null, FK `template`, `ON DELETE RESTRICT` |
| `created_by` | uuid not null, FK `user_profile`, `ON DELETE RESTRICT` |
| `input_hash` | text not null |
| `verdict` | text not null, check `IN ('ok','observaciones')` |
| `observations` | jsonb not null, default `'[]'` |
| `reviewed_text` | text not null |
| `model` | text not null |
| `created_at` | timestamptz not null, default `now()` |

En `draft_document`, nulables: `review_id` (uuid, FK a `contract_review`, `ON DELETE RESTRICT`) y `review_override_reason` (text).

`down` saca primero las dos columnas y después la tabla.

### 6. La ruta espeja `generate`

`POST /api/document-builder/review`, con `authorize('use', 'DocumentBuilder')`. El controlador vive en `documentBuilderController.js` y llama a `reviewDraft` como `postGenerate` llama a `generateAndPersist`, con `companyId` en el query. `POST /api/document-builder/generate` acepta además `reviewId` y `generarIgual: { motivo }` y los reenvía en el body. No hay un parser nuevo: el servicio los lee del body.

### 7. El Constructor agrega un paso sin cambiar el botón de hoy

En `DocumentBuilderPage.jsx`, si algún campo de `missingFieldDefs` tiene `type === 'dynamic_text'`, entre esos campos y «Generar PDF y guardar» aparece «Revisar redacción». Si no hay ninguno, la sección queda igual, incluido el texto del botón.

El paso usa `.btn` y `clause-input`. No hay color nuevo ni otro radio.

- El botón dice «Revisar redacción». Mientras la petición está en curso, dice «Revisando…» y queda desactivado.
- Con `ok`: el texto «Sin observaciones». «Generar PDF y guardar» se habilita y envía `reviewId`.
- Con `observaciones`: una lista con el `label` del texto dinámico, la cláusula, el problema y la sugerencia, y un botón «Usar sugerencia» por ítem. Ese botón copia `suggestion` al valor de ese `dynamicTextId` y borra la revisión mostrada.
- Debajo, «Generar igual» abre un área de texto. Genera solo si el motivo, tras `trim`, tiene al menos 10 caracteres, y entonces envía `reviewId` y `generarIgual: { motivo }`.
- Cualquier cambio de un campo faltante borra la revisión mostrada. Hay que revisar de nuevo. Con observaciones, «Generar PDF y guardar» sigue desactivado.
- `REVIEW_REQUIRED`, `REVIEW_HAS_OBSERVATIONS` y `REVIEW_UNAVAILABLE` se muestran con `message`, en el mismo lugar que el resto de los errores de generación.

`frontend/src/api/documentBuilderApi.js` gana `postDocumentBuilderReview`, al lado de `postDocumentBuilderGenerate`.

### 8. El MCP solo agrega texto y dos parámetros

`revisar_redaccion` usa el mismo esquema de parámetros que `validar_contrato` y llama a `reviewDraft`. Su descripción dice que se usa cuando `validar_contrato` devuelve campos `dynamic_text`, con todos los campos completos y antes de `generar_contrato`; que devuelve `reviewId`, `verdict` y `observations`; que el agente le muestra a la persona cada observación con su sugerencia; que está `PROHIBIDO aplicar una sugerencia sin que la persona la acepte`; y que, si la acepta, el agente pasa esa sugerencia como valor del texto dinámico y vuelve a llamar a `revisar_redaccion`.

`generar_contrato` suma `reviewId` (string, opcional) y `generarIgual` (`{ motivo: string }`, opcional) y los reenvía. Al final de la descripción, sin tocar las frases existentes, se agrega que con textos dinámicos hace falta el `reviewId` de la última revisión, y que `generarIgual` solo se usa si la persona lo pide: el motivo lo dicta la persona y está `PROHIBIDO decidirlo o redactarlo por cuenta propia`.

Esas frases son mitigación de prompt. El rechazo lo hace el servicio.

## Risks / Trade-offs

- [La sección SEGUNDO sale a Anthropic] → La entrada está acotada: textos dinámicos, la sección ya sustituida y tres datos de contraste. No van RUT, direcciones ni precio. La clave no entra en logs ni en errores.
- [Claude no responde, se niega o el JSON no parsea] → 503 `REVIEW_UNAVAILABLE` con el mensaje fijo. No se guarda una revisión a medias.
- [El hash de la revisión y el de la generación se arman distinto] → Una sola función pura para los dos caminos.
- [`overwrite` borra el borrador y después la revisión falla] → La sustitución y la puerta quedan antes del delete. El retorno de duplicado sin `overwrite` no cambia.
- [Una prueba vieja de `generar_contrato` busca una frase exacta] → Solo se concatena texto al final. `confirmación explícita` sigue estando.
- [Costo por revisión] → El diseño lo estima en unos US$0,10. No hay reintento automático.

## Migration Plan

1. Dejar el archivo de migración en el change. No ejecutarlo: lo aplica Ignacio después de fusionar.
2. Desplegar el backend con `ANTHROPIC_API_KEY` ya presente en el ambiente. Sin la clave, revisar responde 503 y generar un contrato con texto dinámico responde 409, porque no puede haber una revisión vigente.
3. El frontend nuevo habla con ese backend. Un frontend viejo que genere una plantilla con texto dinámico recibe `REVIEW_REQUIRED`.
4. Rollback de esquema: `down` quita `review_id` y `review_override_reason`, y después `contract_review`. Los PDF ya emitidos no se reescriben.

## Open Questions

Ninguna. La decisión (d) —«Generar igual» con motivo, y prohibido generar sin revisión— y la decisión (e) —API de Claude, modelo `claude-opus-5`— quedaron cerradas el 29-sep. El `system` es el de la sección 3 del encargo, literal.
