## Context

Quien completa un contrato redacta los textos dinámicos (`servicios_entregables`, `cuentas_publicacion`) y ese texto queda impreso en el PDF. `texto-dinamico-base` ya normaliza el valor, lo pide en el Constructor y le prohíbe al agente del MCP redactarlo por su cuenta. `texto-dinamico-plantillas` mete esos huecos en las cláusulas. Falta la revisión de la sección SEGUNDO antes de generar, decidida por David el 29-sep (decisión (d) y sección 3.3 de `docs/disenos/texto-dinamico.md`): sin una revisión de los valores actuales no se genera; con observaciones se puede «Generar igual» dejando un motivo.

`generateAndPersist` en `backend/services/documentBuilderService.js` valida, preprocesa, sustituye con `applySubstitutionsToTipTapDoc` y después arma el PDF. El `dryRun` retorna en cuanto no faltan placeholders, sin sustituir ni persistir. El Constructor (`DocumentBuilderPage.jsx`) deja los campos faltantes en pantalla y habilita «Generar PDF y guardar» cuando todos tienen valor. `validar_contrato` y `generar_contrato` comparten el cuerpo de generar; `mcpServer.test.js` busca frases exactas de esas descripciones.

La clave `ANTHROPIC_API_KEY` ya está en `backend/config.js`. Este cambio no toca ese archivo.

## Goals / Non-Goals

**Goals:**

- Revisar la sección SEGUNDO ya sustituida con Claude (`claude-opus-5`) y devolver `ok` u `observaciones` con una sugerencia por problema, solo del texto dinámico.
- Guardar cada revisión y exigir, al generar, la revisión de los valores actuales. Con observaciones, exigir un motivo de al menos 10 caracteres y guardarlo en el borrador.
- Ofrecer el mismo paso en el Constructor y en el MCP, sin que el agente aplique una sugerencia o redacte el motivo por su cuenta.
- Dejar igual el `dryRun` y la generación de plantillas sin `dynamic_text`.

**Non-Goals:**

- `evento_servicio`, `formato_periodo_publicacion` y las reglas de evento o de fechas que el diseño deja para `contrato-por-evento`. El `system` de este recorte es el de la sección 3 del encargo, no la lista de siete puntos de la sección 3.3.
- Correr la migración, abrir una conexión a la base, o llamar a Claude desde una prueba.
- Editar frases ya presentes en las descripciones de `validar_contrato` y `generar_contrato`. Solo se agrega texto al final de `generar_contrato`.
- Tocar `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`, `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`, `.agent-orchestrator/**`.
- Modificar cualquier archivo de prueba existente. Renombrar el botón «Generar PDF y guardar».

## Decisions

### 1. Cliente inyectable, sin red en las pruebas

`backend/lib/contractReviewer.js` exporta `createContractReviewer({ apiKey, client } = {})`, `isReviewerConfigured()` y `ContractReviewerError`.

- Sin argumentos, `apiKey` sale de `config.js` (`ANTHROPIC_API_KEY`) y `client` es `new Anthropic({ apiKey })` de `@anthropic-ai/sdk`. Construir el revisor no llama a la red. Sin clave, `isReviewerConfigured()` es falso y `review` lanza `ContractReviewerError` con `code: 'REVIEW_UNAVAILABLE'`.
- `client` se inyecta en las pruebas. La única dependencia nueva es `@anthropic-ai/sdk`. El esquema usa el `zod` que ya está en el backend y `zodOutputFormat` de `@anthropic-ai/sdk/helpers/zod`.
- `review({ sectionText, dynamicTexts, datos })` llama a `client.messages.parse` con `model: 'claude-opus-5'`, `max_tokens: 16000`, el `system` de abajo (texto exacto, en una constante), un mensaje `user` cuyo texto es el JSON `{ sectionText, dynamicTexts, datos }`, y `output_config: { format: zodOutputFormat(ReviewSchema) }`.
- `ReviewSchema` es `{ verdict: 'ok' | 'observaciones', observations: [{ dynamicTextId, clause, problem, suggestion }] }`. Los cinco campos de cada observación son string.
- El resultado es `parsed_output`, más `model`: el `model` de la respuesta si viene como string no vacío; si no, `claude-opus-5`.
- Si `stop_reason` es `'refusal'`, si `parsed_output` es `null` o si el SDK lanza, se lanza `ContractReviewerError` con `code: 'REVIEW_UNAVAILABLE'`. El mensaje de ese error es fijo y no incluye la clave, el cuerpo ni el error crudo del SDK.
- Reconciliación, para que veredicto y lista no se contradigan: si `observations` tiene al menos un elemento, `verdict` queda `'observaciones'`; si no tiene ninguno, `verdict` queda `'ok'` y `observations` queda `[]`. Un `ok` que trae observaciones pasa a `'observaciones'` y conserva la lista.

`system`, carácter por carácter:

```
Eres revisor de redacción de contratos de prestación de servicios de influencers, en español formal de Chile o México.
Recibes la sección SEGUNDO de un contrato ya completada (sectionText), los textos dinámicos que escribió una persona al crearlo (dynamicTexts, con su instrucción) y datos del contrato para contrastar (datos).
Revisa SOLO los textos dinámicos y cómo encajan en su cláusula. No opines sobre el resto del contrato.
Verifica:
1. Gramática y concordancia de la cláusula completa con el texto dinámico puesto: número, género y conectores.
2. Que las cantidades vayan en palabras y en cifra entre paréntesis, como "cinco (5)".
3. Que cada red social nombrada en los entregables esté entre datos.redesDelProveedor, y que la cláusula de cuentas nombre una cuenta para cada red de los entregables, y ninguna red que no esté en ellos.
4. Que el texto dinámico no agregue obligaciones, montos, plazos ni condiciones que no correspondan a lo que pide su instrucción.
5. Registro formal: sin abreviaturas, emojis ni lenguaje coloquial.
No inventes datos. Si falta información para decidir, dilo como observación.
Responde con verdict "ok" y observations vacía si no hay nada que corregir. Si hay algo, verdict "observaciones" y una observación por problema: dynamicTextId, clause (el número de cláusula, como "2.3"), problem (en una frase) y suggestion (el texto dinámico completo reescrito, listo para reemplazar al actual; nunca otra parte de la cláusula).
```

**Alternativa descartada:** revisar con el agente del MCP. El Constructor no lo tiene, y quien redacta no debe ser quien revisa.

### 2. La entrada y el hash son funciones puras, compartidas

Un módulo nuevo (funciones puras, sin knex ni red) arma la entrada y la usan `reviewDraft` y la verificación de `generateAndPersist`. Si cada camino la arma distinto, el hash no calza.

- `sectionText`: texto plano del documento ya sustituido. Se toman los bloques de primer nivel, en orden, desde el primero cuyo texto (recortado) empieza por `SEGUNDO` hasta el anterior al primero que empieza por `TERCERO`, inclusive el de `SEGUNDO` y exclusive el de `TERCERO`. El texto de cada bloque es el de `tipTapDocToPlainTextAsync` sobre ese nodo, y se unen como ese walker une el documento (`\n\n`). Si falta `SEGUNDO` o falta `TERCERO`, `sectionText` es el texto de los párrafos cuyo texto recortado empieza por `2.` seguido de un dígito, unidos igual.
- `dynamicTexts`: una entrada por cada id con `getVariableMeta(id).type === 'dynamic_text'` presente en la plantilla, en orden de primera aparición (profundidad). Cada una es `{ id, label, instruccion, value }` con `label` e `instruccion` del catálogo y `value` ya normalizado (`trim` y espacios internos colapsados).
- `datos`: `{ redesDelProveedor, mes_ejecucion, fecha_contrato }`. `redesDelProveedor` recorre `supplier.social_networks` en el orden en que vienen y mapea `{ red: name o null, cuenta: account_name o null }`. Sin redes, el arreglo va vacío. `mes_ejecucion` y `fecha_contrato` salen de los overrides ya preprocesados; si el valor no está o queda en blanco, van `null`.
- No se envía ninguna otra clave. En particular no van RUT, dirección ni precio.
- `input_hash`: hex sha256 (UTF-8) de `JSON.stringify` de `{ sectionText, dynamicTexts, datos }` construido con las claves en ese orden, y dentro de `datos` el orden `redesDelProveedor`, `mes_ejecucion`, `fecha_contrato`. Cada texto dinámico usa el orden `id`, `label`, `instruccion`, `value`. Cada red usa `red`, `cuenta`.

La plantilla «tiene texto dinámico» cuando ese recorrido encuentra al menos un id `dynamic_text`. Esa misma función decide `REVIEW_NOT_NEEDED` y si generar exige revisión.

### 3. `reviewDraft` sigue el camino del dry run y se detiene antes del PDF

`createDocumentBuilderService({ ..., contractReviewer })` recibe el revisor. Si no se pasa, usa `createContractReviewer()`. Las pruebas existentes no lo pasan y no deben llamarlo: solo `reviewDraft` lo invoca.

`reviewDraft({ userId, requestedCompanyId, body })` recorre las mismas validaciones, el mismo preproceso y la misma sustitución que `generateAndPersist` hasta tener el documento sustituido. No detecta duplicados, no sube a GCS y no inserta en `draft_document`.

- Si faltan placeholders, la misma respuesta 422 `MISSING_PLACEHOLDERS` que el `dryRun`.
- Si la plantilla no tiene ningún `dynamic_text`, `{ ok: false, status: 400, code: 'REVIEW_NOT_NEEDED', message: 'Esta plantilla no tiene textos dinámicos que revisar.' }`.
- Si `isReviewerConfigured()` es falso, o `review` lanza, `{ ok: false, status: 503, code: 'REVIEW_UNAVAILABLE', message: 'No se pudo revisar la redacción en este momento. Intenta de nuevo en unos minutos.' }`. No se inserta fila.
- Si no, inserta en `contract_review` y devuelve `{ ok: true, data: { reviewId, verdict, observations } }`.

La fila guarda `company_id`, `supplier_id`, `template_id`, `created_by` (el mismo perfil que el borrador), `input_hash`, `verdict`, `observations`, `reviewed_text` (el `sectionText`), `model` y `created_at`.

Para que el tramo no se copie y diverja, la preparación común (hasta el documento sustituido, o hasta el 422) vive en una función interna. En `generateAndPersist` el `dryRun` sigue retornando donde retorna hoy, antes de sustituir y antes de revisar. `reviewDraft` llama a esa preparación con `dryRun: false`: un cuerpo de revisión con `dryRun: true` igual sustituye, llama al revisor e inserta la fila.

### 4. Generar exige la revisión de este hash, en un solo punto

En `generateAndPersist`, sin `dryRun` y solo si la plantilla tiene al menos un `dynamic_text`, la verificación ocurre después de sustituir y antes de `buildPdfBytesFromTipTapWithReactPdf`, sobre ese mismo documento. Ahí se recalcula el hash con las funciones de la decisión 2.

El reemplazo del borrador duplicado (borrar en GCS y borrar la fila) queda después de que esa verificación pasa. Un 409 no destruye el borrador anterior. En una plantilla sin `dynamic_text` ese bloque no corre y el orden actual se mantiene. El `dryRun` tampoco entra.

- Sin `body.reviewId`, o si no existe una fila de esa empresa, ese proveedor y esa plantilla con el `input_hash` recalculado: `{ ok: false, status: 409, code: 'REVIEW_REQUIRED', message: 'Revisa la redacción antes de generar: no hay una revisión de los textos actuales.' }`. No se genera el PDF ni se sube nada.
- Si esa fila tiene `verdict: 'observaciones'` y `String(body.generarIgual?.motivo ?? '').trim()` tiene menos de 10 caracteres: `{ ok: false, status: 409, code: 'REVIEW_HAS_OBSERVATIONS', message: 'La revisión tiene observaciones. Corrige el texto o usa «Generar igual» indicando el motivo.' }`.
- Si pasa, el `INSERT` de `draft_document` incluye `review_id` y, cuando hubo motivo válido, `review_override_reason` con el motivo ya recortado. Con veredicto `ok`, `review_override_reason` queda `null`.

La normalización de espacios del texto dinámico no se mueve: sigue antes del preproceso. Un valor `'  cinco (5) reels\n\nen   TikTok  '` se guarda en `contract_overrides` como `'cinco (5) reels en TikTok'`, y una frase con comas y paréntesis aparece tal cual en `content_snapshot`. Esas dos comprobaciones viven en la prueba nueva, porque las de `dynamicText.test.js` ahora esperan `REVIEW_REQUIRED` y no se tocan.

### 5. Tabla `contract_review`

Migración `backend/migrations/202609290002_contract_review.js`. No se ejecuta en este cambio.

`contract_review`, con los mismos tipos y `ON DELETE` que las columnas homónimas de `draft_document`:

| Columna | Tipo |
| --- | --- |
| `id` | uuid PK, default `gen_random_uuid()` |
| `company_id` | uuid NOT NULL → `company.id`, `ON DELETE CASCADE` |
| `supplier_id` | uuid NOT NULL → `supplier.id`, `ON DELETE CASCADE` |
| `template_id` | uuid NOT NULL → `template.id`, `ON DELETE RESTRICT` |
| `created_by` | uuid NOT NULL → `user_profile.id`, `ON DELETE RESTRICT` |
| `input_hash` | text NOT NULL |
| `verdict` | text NOT NULL, check `IN ('ok','observaciones')` |
| `observations` | jsonb NOT NULL, default `'[]'` |
| `reviewed_text` | text NOT NULL |
| `model` | text NOT NULL |
| `created_at` | timestamptz NOT NULL, default `now()` |

En `draft_document`, nulables: `review_id` uuid → `contract_review.id` con `ON DELETE NO ACTION`, y `review_override_reason` text. Lo aprobó el humano en C-0P8JHYZ.

`down` saca primero las dos columnas de `draft_document` y después la tabla. `ON DELETE NO ACTION` impide borrar una revisión suelta mientras un borrador la cita, y se comprueba al final de la sentencia. Así el borrado en cascada de la empresa o del proveedor puede eliminar la revisión y el borrador juntos.

### 6. HTTP

`POST /api/document-builder/review`, con `authorize('use', 'DocumentBuilder')`, al lado de `generate`. El controlador sigue a `postGenerate`: `userId` de `req.auth.userId`, `requestedCompanyId` de `req.query.companyId`, `body` de `req.body`. Un 422 `MISSING_PLACEHOLDERS` usa el mismo cuerpo que generar. El resto de errores pasa por `sendError`.

`POST /api/document-builder/generate` no cambia de ruta. El cuerpo acepta además `reviewId` y `generarIgual: { motivo }`.

En `app.js` y en `mcpServer.mjs` el revisor se construye y se inyecta en `createDocumentBuilderService`, igual que `gcsService`. Las pruebas del servidor MCP y de la app pueden pasar un revisor falso.

### 7. Constructor

El paso aparece solo cuando algún campo de `missingFieldDefs` tiene `type === 'dynamic_text'`, entre esos campos y el botón que hoy dice «Generar PDF y guardar». Sin un campo así, la pantalla no cambia: el mismo botón, la misma regla de `canGenerate`.

Controles con la clase `btn` ya usada. El motivo usa un `<textarea class="clause-input">`. Sin colores nuevos.

- El botón «Revisar redacción» llama a `POST /api/document-builder/review` con el mismo cuerpo que generar (proveedor, plantilla, overrides, cliente). Mientras la petición está en curso, el texto es «Revisando…» y el botón queda desactivado.
- Con `ok`: se muestra «Sin observaciones» y «Generar PDF y guardar» se habilita. El generate envía `reviewId`.
- Con `observaciones`: una lista con el `label` del texto dinámico, la cláusula, el problema y la sugerencia. «Usar sugerencia» escribe la sugerencia en ese campo. «Generar igual» muestra el área del motivo; generar con ese camino exige al menos 10 caracteres tras `trim` y envía `generarIgual: { motivo }` junto con `reviewId`. El botón «Generar PDF y guardar» no se habilita con observaciones abiertas. Si esa generación responde `DUPLICATE_DRAFT`, «Reemplazar» reenvía `overwrite`, el mismo `reviewId` y `generarIgual.motivo`.
- Cualquier cambio de un campo faltante borra la revisión mostrada (`reviewId`, veredicto, observaciones). Hay que revisar de nuevo. Si el cambio ocurre con una revisión en curso, la respuesta de esa petición se descarta.
- `REVIEW_REQUIRED`, `REVIEW_HAS_OBSERVATIONS` y `REVIEW_UNAVAILABLE` se muestran con el `message` de la respuesta.

`frontend/src/api/documentBuilderApi.js` gana la función del POST de revisión. El botón de generar no se renombra.

### 8. MCP: se agrega texto, no se reescriben las frases

`revisar_redaccion` usa los mismos parámetros que `validar_contrato` (`companyId`, `supplierId`, `templateId`, `missingFieldOverrides` opcional, `clientId` opcional) y llama a `reviewDraft`. No se le agregan `reviewId` ni `generarIgual`. Esos dos van solo en el esquema de `generar_contrato`, no en el objeto compartido `contractParams`, para no cambiárselos a `validar_contrato`.

La descripción de `revisar_redaccion` dice que se usa cuando `validar_contrato` devuelve campos `dynamic_text`, con todos los campos completos y antes de `generar_contrato`; que devuelve `reviewId`, `verdict` y `observations`; que el agente le muestra a la persona cada observación con su sugerencia; que está `PROHIBIDO aplicar una sugerencia sin que la persona la acepte` de forma explícita; y que, si la persona acepta, el agente pasa la sugerencia como nuevo valor del texto dinámico y vuelve a llamar a `revisar_redaccion`.

Al final de la descripción actual de `generar_contrato`, sin editar las frases que ya están, se agrega que con textos dinámicos exige el `reviewId` de la última revisión, y que `generarIgual` solo se usa si la persona lo pide y el motivo lo dicta la persona: está `PROHIBIDO decidirlo o redactarlo por cuenta propia`. El handler reenvía `reviewId` y `generarIgual` a `generateAndPersist`. No verifica la conversación: el 409 lo pone el servicio.

## Risks / Trade-offs

- [El hash de la revisión y el de generar se calculan en dos sitios] → Las dos llamadas usan las mismas funciones puras y el mismo documento sustituido.
- [Un 409 después de borrar el duplicado deja al usuario sin el PDF anterior] → La verificación corre antes del reemplazo del duplicado y antes del PDF.
- [La sección SEGUNDO sale a Anthropic] → El JSON solo lleva `sectionText`, `dynamicTexts` y `datos`. Sin RUT, dirección ni precio. David lo aceptó el 29-sep.
- [La clave termina en un log o en un mensaje de error] → `ContractReviewerError` no la incluye, y el 503 usa un mensaje fijo.
- [El modelo devuelve `ok` y observaciones a la vez] → Si hay observaciones, el veredicto queda `observaciones`.
- [`generateAndPersist` ya es largo] → Un solo bloque nuevo, después de sustituir y antes del PDF. El `dryRun` y las plantillas sin texto dinámico no entran.
- [Las pruebas de `mcpServer.test.js` comparan frases exactas] → Solo se agrega texto al final de `generar_contrato`. `validar_contrato` no se edita.
- [Costo y latencia de `claude-opus-5`] → Aceptados con la decisión (e). Un fallo o un `refusal` es 503 y se puede reintentar; no se guarda una revisión a medias.

## Migration Plan

1. Queda el archivo `202609290002_contract_review.js`. La corre Ignacio; este cambio no la ejecuta.
2. El backend nuevo convive con la tabla: sin la migración, `reviewDraft` y el generate con `dynamic_text` fallan al leer o escribir. Por eso este recorte sale a producción junto con `texto-dinamico-plantillas`, como indica el diseño.
3. `ANTHROPIC_API_KEY` ya está prevista en la config. Sin ella, revisar responde 503 y generar un contrato con texto dinámico responde 409 hasta que exista una revisión. Generar una plantilla sin texto dinámico no la necesita.
4. Rollback: `down` quita `review_id` y `review_override_reason` y después `contract_review`. Los borradores generados con revisión pierden ese vínculo.

## Open Questions

Ninguna. El modelo, el `system`, los códigos HTTP, los mensajes y el umbral de 10 caracteres los fija el encargo.
