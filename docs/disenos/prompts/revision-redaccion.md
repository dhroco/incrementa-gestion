# Recorte · revision-redaccion

> Encargo de Ignacio (arquitecto), 29-sep-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/texto-dinamico.md`, sección 3.3 y decisión (d). Depende de `texto-dinamico-base` y
> `texto-dinamico-plantillas`.

## 1. Objetivo

Los textos dinámicos (`dynamic_text`) los redacta quien completa el contrato. Antes de generar el PDF,
**un agente (Claude) revisa la redacción** de la sección SEGUNDO completa y devuelve un veredicto:
`ok`, o `observaciones` con una sugerencia para cada una. Al terminar:
- **En el Constructor y en el MCP** se puede pedir la revisión, ver las observaciones, aceptar una
  sugerencia y volver a revisar.
- **Generar exige una revisión de los valores actuales.** Si esa revisión tiene observaciones, se
  puede **«Generar igual»** escribiendo un motivo, y queda registrado.
- **Cada revisión se guarda** como evidencia, y el borrador apunta a la que se usó.
- **Las plantillas sin textos dinámicos se generan igual que hoy**, sin revisión.

## 2. Arquitectura

### 2.1 Cliente de Claude: `backend/lib/contractReviewer.js`

- **Dependencia nueva** `@anthropic-ai/sdk` en `backend/package.json`.
- `createContractReviewer({ apiKey, client } = {})`. Sin argumentos, toma `ANTHROPIC_API_KEY` de
  `backend/config.js` (ya existe) y crea `new Anthropic({ apiKey })`. `client` se inyecta en las
  pruebas. También exporta `isReviewerConfigured()`.
- `review({ sectionText, dynamicTexts, datos })` → `{ verdict, observations, model }`:
  - llama a `client.messages.parse` con `model: 'claude-opus-5'`, `max_tokens: 16000`, el `system`
    de la sección 3, un mensaje `user` con el JSON `{ sectionText, dynamicTexts, datos }`, y
    `output_config: { format: zodOutputFormat(ReviewSchema) }` (`zodOutputFormat` de
    `@anthropic-ai/sdk/helpers/zod`, con el `zod` que ya usa el backend);
  - `ReviewSchema` = `{ verdict: 'ok' | 'observaciones', observations: [{ dynamicTextId, clause, problem, suggestion }] }`,
    todo string;
  - devuelve `parsed_output`. Si `stop_reason` es `'refusal'`, si `parsed_output` es `null` o si el
    SDK lanza, lanza un `ContractReviewerError` con `code: 'REVIEW_UNAVAILABLE'`;
  - si `verdict` es `'ok'`, fuerza `observations: []`, y si hay observaciones, fuerza
    `'observaciones'`, para que las dos cosas no se contradigan;
  - **nunca** escribe la clave en un mensaje ni en un log.

### 2.2 Modelo de datos: migración nueva `backend/migrations/202609290002_contract_review.js`

- Tabla **`contract_review`**, con los tipos y las FK como en `draft_document`:
  - `id` uuid;
  - `company_id`, `supplier_id`, `template_id`;
  - `created_by`, igual que en `draft_document`;
  - `input_hash` text not null;
  - `verdict` text not null, con check `IN ('ok','observaciones')`;
  - `observations` jsonb not null, default `'[]'`;
  - `reviewed_text` text not null;
  - `model` text not null;
  - `created_at` timestamptz, default `now()`.
- En **`draft_document`**, dos columnas nulables: `review_id` (FK a `contract_review`) y
  `review_override_reason` text.
- `down` revierte las dos cosas. **No la corras**: la aplica Ignacio.

### 2.3 Servicio (`documentBuilderService.js`)

- **`reviewDraft({ userId, requestedCompanyId, body })`**, nuevo. Recibe el mismo `body` que
  `generateAndPersist` y recorre el mismo camino que el `dryRun`: validaciones, preproceso y
  sustitución.
  - Si faltan campos, devuelve el mismo 422 `MISSING_PLACEHOLDERS`.
  - Si la plantilla no tiene ninguna variable `dynamic_text`, devuelve 400 `REVIEW_NOT_NEEDED`:
    «Esta plantilla no tiene textos dinámicos que revisar.».
  - Si no, arma la entrada (sección 2.4), llama al revisor y guarda una fila en `contract_review`.
    Devuelve `{ ok: true, data: { reviewId, verdict, observations } }`.
  - Si el revisor no está configurado o falla, devuelve 503 `REVIEW_UNAVAILABLE`: «No se pudo
    revisar la redacción en este momento. Intenta de nuevo en unos minutos.».
- **`generateAndPersist`** sin `dryRun`, y solo si la plantilla tiene al menos un `dynamic_text`:
  - Requiere `body.reviewId`. La revisión tiene que existir, ser de la misma empresa, proveedor y
    plantilla, y tener el `input_hash` que se recalcula ahora. Si no se cumple, devuelve 409
    `REVIEW_REQUIRED`: «Revisa la redacción antes de generar: no hay una revisión de los textos
    actuales.».
  - Si la revisión tiene `verdict: 'observaciones'`, requiere `body.generarIgual.motivo` con al
    menos 10 caracteres después de `trim`. Si falta, devuelve 409 `REVIEW_HAS_OBSERVATIONS`: «La
    revisión tiene observaciones. Corrige el texto o usa «Generar igual» indicando el motivo.».
  - Guarda `review_id` y, si hubo, `review_override_reason` en el `draft_document`.
  - El `dryRun`, y todo lo de las plantillas sin texto dinámico, no cambia.

### 2.4 Entrada de la revisión

- **`sectionText`**: el texto plano del documento **ya sustituido**, desde el bloque cuyo texto
  empieza con `SEGUNDO` hasta el bloque anterior al que empieza con `TERCERO`. Las 21 plantillas de
  hoy los tienen (verificado el 29-sep). Si falta alguno de los dos, usa todos los párrafos que
  empiezan con `2.` seguido de un número.
- **`dynamicTexts`**: por cada `dynamic_text` de la plantilla, `{ id, label, instruccion, value }`,
  con el `value` normalizado.
- **`datos`**: `{ redesDelProveedor: [{ red, cuenta }], mes_ejecucion, fecha_contrato }`, tomados
  del proveedor y de los overrides. Si un dato no existe, va `null`.
- **Sin RUT, direcciones ni precio**: no se envía nada más.
- **`input_hash`**: sha256 del JSON de `{ sectionText, dynamicTexts, datos }`, con las claves en
  orden fijo.

### 2.5 Rutas

`POST /api/document-builder/review`, con `authorize('use', 'DocumentBuilder')` y el controlador en
`documentBuilderController.js`, como `generate`. `POST /api/document-builder/generate` acepta además
`reviewId` y `generarIgual: { motivo }`.

### 2.6 Constructor (`DocumentBuilderPage.jsx`)

Si alguno de los campos faltantes es `dynamic_text`, entre los campos y «Generar» aparece un paso
**«Revisar redacción»**:
- mientras revisa, el botón muestra «Revisando…» y queda desactivado;
- con `ok`: «Sin observaciones», y «Generar» se habilita;
- con `observaciones`: una lista con el texto dinámico (por su `label`), la cláusula, el problema y
  la sugerencia, y un botón **«Usar sugerencia»** que pone la sugerencia como valor de ese texto
  dinámico. Debajo, **«Generar igual»**, que despliega un área de texto para el motivo (mínimo 10
  caracteres) y genera con `generarIgual`;
- **cualquier cambio en un campo borra la revisión** mostrada, y hay que revisar de nuevo;
- los errores `REVIEW_REQUIRED`, `REVIEW_HAS_OBSERVATIONS` y `REVIEW_UNAVAILABLE` se muestran con
  su mensaje;
- si no hay campos `dynamic_text`, el Constructor queda igual que hoy.

### 2.7 MCP (`backend/mcpTools.mjs`)

- **Herramienta nueva `revisar_redaccion`**, con los mismos parámetros que `validar_contrato`, que
  llama a `reviewDraft`. Su descripción dice:
  - que se usa cuando `validar_contrato` devuelve campos `dynamic_text`, con todos los campos
    completos y antes de `generar_contrato`;
  - que devuelve `reviewId`, `verdict` y `observations`;
  - que el agente **le muestra a la persona cada observación con su sugerencia**, y que **está
    PROHIBIDO aplicar una sugerencia sin que la persona la acepte de forma explícita**;
  - que si la persona acepta, el agente pasa la sugerencia como nuevo valor del texto dinámico y
    vuelve a llamar a `revisar_redaccion`.
- **`generar_contrato`** acepta `reviewId` (string, opcional) y `generarIgual`
  (`{ motivo: string }`, opcional). Al final de su descripción se agrega, **sin editar las frases
  existentes**:
  - que con textos dinámicos exige el `reviewId` de la última revisión;
  - que `generarIgual` **solo se usa si la persona lo pide**, y que el motivo **lo dicta la
    persona**: está PROHIBIDO decidirlo o redactarlo por cuenta propia.

## 3. `system` del revisor (texto exacto)

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

## 4. Recomendaciones

- Extrae en funciones puras la sección SEGUNDO, `dynamicTexts`, `datos` y el hash, y úsalas igual en
  `reviewDraft` y en la verificación de `generateAndPersist`. Si no, el hash no calza.
- Inyecta el revisor en `createDocumentBuilderService` (`contractReviewer`), y en `app.js` y
  `mcpServer.mjs` como los demás servicios, para que las pruebas pasen uno falso.

## 5. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`,
  `.agent-orchestrator/**`.
- **Ninguna prueba llama a Claude de verdad**: todo con un `client` falso. Nada que se conecte a la
  base; la migración no se corre.
- La única dependencia nueva es `@anthropic-ai/sdk`.
- Mensajes, textos de interfaz, documentación y commits en español.

## 6. Pruebas existentes

Ninguna prueba existente cambia. **No modifiques ningún archivo de prueba existente.** Las pruebas
de `generateAndPersist` usan plantillas sin textos dinámicos, así que tienen que seguir pasando sin
revisión. `mcpServer.test.js` busca frases exactas en las descripciones: solo agrega texto. Si
cualquier prueba existente falla, **no la ajustes: consulta a la mesa.**

## 7. Pruebas nuevas

**Todas en archivos nuevos**:
- **`backend/test/contractReviewer.test.js`**, con un `client` falso:
  - llama con `claude-opus-5`, el `system` exacto y el JSON de entrada;
  - `ok` con observaciones pasa a `observaciones`;
  - `refusal`, `parsed_output` nulo y una excepción del SDK dan `REVIEW_UNAVAILABLE`;
  - la clave no aparece en ningún error.
- **`backend/test/documentBuilderService.review.test.js`**, con una plantilla mock que tiene la
  sección SEGUNDO con `{{servicios_entregables}}` y `{{cuentas_publicacion}}`, y un revisor falso:
  - `reviewDraft` guarda la fila y devuelve el veredicto;
  - la entrada al revisor no tiene RUT, dirección ni precio;
  - `REVIEW_NOT_NEEDED` sin textos dinámicos; `REVIEW_UNAVAILABLE` sin revisor;
  - `generateAndPersist` sin `reviewId` da `REVIEW_REQUIRED`;
  - con un `reviewId` de valores distintos (cambió el texto), `REVIEW_REQUIRED`;
  - con observaciones y sin motivo, `REVIEW_HAS_OBSERVATIONS`; con motivo de 9 caracteres, igual;
  - con motivo válido, genera y guarda `review_id` y `review_override_reason`; con `ok`, genera y
    guarda `review_id`;
  - una plantilla sin textos dinámicos genera sin `reviewId`.
- **`backend/test/mcpRevision.test.js`**: `revisar_redaccion` existe y su descripción incluye
  `PROHIBIDO aplicar una sugerencia sin que la persona la acepte`. `generar_contrato` acepta
  `reviewId` y `generarIgual`, y su descripción incluye `PROHIBIDO decidirlo o redactarlo por cuenta propia`.
- **`frontend/src/pages/DocumentBuilderPage.review.test.jsx`**: con un campo `dynamic_text` y la API
  simulada:
  - «Revisar redacción» con `ok` habilita «Generar»;
  - con observaciones las muestra, y «Usar sugerencia» cambia el valor y borra la revisión;
  - «Generar igual» exige el motivo y lo envía;
  - sin `dynamic_text`, no aparece el paso.

## 8. Puntos de atención

- `generateAndPersist` es largo. Agrega la verificación de la revisión en un solo lugar: después de
  la sustitución y antes de generar el PDF, con el mismo documento sustituido que usa el hash.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test`, `cd frontend && npm test` y
  `cd frontend && npm run lint`. Las tres en verde; el lint, con 0 errores.
