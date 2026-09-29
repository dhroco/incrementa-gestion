## 1. Cliente de Claude

- [x] 1.1 Agregar `@anthropic-ai/sdk` en `backend/package.json`. Es la única dependencia nueva.
- [x] 1.2 Crear `backend/lib/contractReviewer.js` con `createContractReviewer({ apiKey, client } = {})`, `isReviewerConfigured()` y `ContractReviewerError`. Sin argumentos, la clave sale de `ANTHROPIC_API_KEY` en `config.js` y el cliente es `new Anthropic({ apiKey })`. Construir no llama a la red. Sin clave, `isReviewerConfigured()` es falso y `review` lanza `ContractReviewerError` con `code: 'REVIEW_UNAVAILABLE'` sin tocar la red.
- [x] 1.3 `review({ sectionText, dynamicTexts, datos })` llama a `client.messages.parse` con `model: 'claude-opus-5'`, `max_tokens: 16000`, el `system` exacto de la sección 3 del encargo, un mensaje `user` con el JSON `{ sectionText, dynamicTexts, datos }`, y `output_config: { format: zodOutputFormat(ReviewSchema) }` (`@anthropic-ai/sdk/helpers/zod` y el `zod` del backend). `ReviewSchema` es `{ verdict: 'ok' | 'observaciones', observations: [{ dynamicTextId, clause, problem, suggestion }] }`, todos string.
- [x] 1.4 Devolver `parsed_output` reconciliado: si hay observaciones, `verdict` queda `'observaciones'` y se conserva la lista; si no hay, `verdict` queda `'ok'` y `observations` queda `[]`. `model` es el de la respuesta si es un string no vacío; si no, `claude-opus-5`. Si `stop_reason` es `'refusal'`, si `parsed_output` es `null` o si el SDK lanza, lanzar `ContractReviewerError` con `code: 'REVIEW_UNAVAILABLE'`. El mensaje no incluye la clave ni el error crudo.

## 2. Entrada y hash

- [x] 2.1 Extraer funciones puras, sin knex ni red, para la sección SEGUNDO, `dynamicTexts`, `datos` y el hash. Las usan `reviewDraft` y la verificación de `generateAndPersist`.
- [x] 2.2 `sectionText` es el texto plano del documento ya sustituido, desde el bloque de primer nivel cuyo texto recortado empieza por `SEGUNDO` hasta el anterior al que empieza por `TERCERO`. El texto de cada bloque sigue a `tipTapDocToPlainTextAsync`. Si falta alguno de los dos, usar los párrafos cuyo texto recortado empieza por `2.` seguido de un dígito.
- [x] 2.3 `dynamicTexts`: una entrada por id con `getVariableMeta(id).type === 'dynamic_text'`, en orden de primera aparición, como `{ id, label, instruccion, value }` con el catálogo y el valor ya normalizado. `datos` es solo `{ redesDelProveedor, mes_ejecucion, fecha_contrato }`. Las redes salen de `supplier.social_networks` en el orden guardado, `{ red: name o null, cuenta: account_name o null }`, o `[]` si no hay. `mes_ejecucion` y `fecha_contrato` salen de los overrides preprocesados, o `null` si no están. No va RUT, dirección ni precio.
- [x] 2.4 `input_hash` es el sha256 en hex del JSON UTF-8 de `{ sectionText, dynamicTexts, datos }` con las claves en ese orden (`datos`: `redesDelProveedor`, `mes_ejecucion`, `fecha_contrato`; cada texto: `id`, `label`, `instruccion`, `value`; cada red: `red`, `cuenta`).

## 3. Migración

- [x] 3.1 Crear `backend/migrations/202609290002_contract_review.js`. Tabla `contract_review`: `id` uuid PK default `gen_random_uuid()`; `company_id`, `supplier_id` y `template_id` con los mismos tipos y `ON DELETE` que en `draft_document`; `created_by` uuid NOT NULL → `user_profile.id` `ON DELETE RESTRICT`; `input_hash` text NOT NULL; `verdict` text NOT NULL con check `IN ('ok','observaciones')`; `observations` jsonb NOT NULL default `'[]'`; `reviewed_text` text NOT NULL; `model` text NOT NULL; `created_at` timestamptz NOT NULL default `now()`.
- [x] 3.2 En `draft_document`, columnas nulables `review_id` (FK a `contract_review.id`, `ON DELETE NO ACTION`, aprobado en C-0P8JHYZ) y `review_override_reason` text. `down` quita primero esas dos columnas y después la tabla. No correr la migración.

## 4. Servicio

- [x] 4.1 `createDocumentBuilderService` acepta `contractReviewer`. Si no se pasa, usa `createContractReviewer()`. Las pruebas que ya existen no lo pasan y no deben invocarlo.
- [x] 4.2 `reviewDraft({ userId, requestedCompanyId, body })` recibe el mismo `body` que `generateAndPersist` y recorre las mismas validaciones, el mismo preproceso y la misma sustitución, en una función interna compartida para que el hash no diverja. El `dryRun` sigue retornando donde retorna hoy, antes de sustituir. `reviewDraft` no detecta duplicados, no sube a GCS y no inserta en `draft_document`.
- [x] 4.3 Si faltan placeholders, el mismo 422 `MISSING_PLACEHOLDERS`. Si la plantilla no tiene ningún `dynamic_text`, 400 `REVIEW_NOT_NEEDED` con «Esta plantilla no tiene textos dinámicos que revisar.» y sin llamar al revisor. Si el revisor no está configurado o falla, 503 `REVIEW_UNAVAILABLE` con «No se pudo revisar la redacción en este momento. Intenta de nuevo en unos minutos.» y sin insertar.
- [x] 4.4 Si la revisión sale, insertar en `contract_review` (`input_hash`, `verdict`, `observations`, `reviewed_text` = `sectionText`, `model`, y la misma empresa, proveedor, plantilla y `created_by` del borrador) y devolver `{ ok: true, data: { reviewId, verdict, observations } }`.
- [x] 4.5 En `generateAndPersist`, sin `dryRun` y solo si la plantilla tiene al menos un `dynamic_text`: después de sustituir y antes de `buildPdfBytesFromTipTapWithReactPdf`, recalcular el hash con las funciones de la sección 2 sobre ese documento. El reemplazo del duplicado queda después de que esta verificación pasa. Sin un `reviewId` de la misma empresa, proveedor y plantilla con ese `input_hash`, devolver 409 `REVIEW_REQUIRED` con «Revisa la redacción antes de generar: no hay una revisión de los textos actuales.» Sin PDF, sin subida y sin insert.
- [x] 4.6 Si el veredicto es `observaciones` y el `trim` de `body.generarIgual.motivo` tiene menos de 10 caracteres, 409 `REVIEW_HAS_OBSERVATIONS` con «La revisión tiene observaciones. Corrige el texto o usa «Generar igual» indicando el motivo.» Con motivo válido, el insert guarda `review_id` y `review_override_reason` ya recortado. Con `ok`, guarda `review_id` y `review_override_reason` null. El `dryRun` y las plantillas sin texto dinámico no exigen `reviewId` y no cambian de camino.

## 5. Ruta e inyección

- [x] 5.1 En `documentBuilderController.js`, un handler como `postGenerate` que llama a `reviewDraft` con `req.auth.userId`, `req.query.companyId` y `req.body`. Un 422 `MISSING_PLACEHOLDERS` usa el mismo cuerpo que generar.
- [x] 5.2 En `app.js`, `POST /api/document-builder/review` con `authorize('use', 'DocumentBuilder')`. Inyectar `createContractReviewer()` en `createDocumentBuilderService`, igual que los demás servicios. `POST /api/document-builder/generate` acepta `reviewId` y `generarIgual` porque el servicio los lee del body; no hace falta otra ruta.
- [x] 5.3 En `mcpServer.mjs`, inyectar el mismo revisor en `createDocumentBuilderService`.

## 6. MCP

- [x] 6.1 En `backend/mcpTools.mjs`, herramienta `revisar_redaccion` con los mismos parámetros que `validar_contrato` (`companyId`, `supplierId`, `templateId`, `missingFieldOverrides` opcional, `clientId` opcional). El handler llama a `reviewDraft` y no genera PDF. No agregar `reviewId` ni `generarIgual` al esquema compartido con `validar_contrato`.
- [x] 6.2 La descripción de `revisar_redaccion` dice que se usa cuando `validar_contrato` devuelve campos `dynamic_text`, con todos los campos completos y antes de `generar_contrato`; que devuelve `reviewId`, `verdict` y `observations`; que el agente muestra cada observación con su sugerencia; que está `PROHIBIDO aplicar una sugerencia sin que la persona la acepte` de forma explícita; y que, si la persona acepta, pasa la sugerencia como nuevo valor y vuelve a llamar a `revisar_redaccion`.
- [x] 6.3 `generar_contrato` acepta `reviewId` (string, opcional) y `generarIgual` (`{ motivo: string }`, opcional) y los reenvía en el body. Al final de la descripción, sin editar las frases existentes, agregar que con textos dinámicos exige el `reviewId` de la última revisión, y que `generarIgual` solo se usa si la persona lo pide y el motivo lo dicta la persona: está `PROHIBIDO decidirlo o redactarlo por cuenta propia`. No editar la descripción de `validar_contrato`. El texto agregado debe decir «textos dinámicos» (como en el encargo) y **no** debe incluir la cadena literal `dynamic_text`: `backend/test/mcpDynamicText.test.js` ya verifica que esa cadena está ausente de la descripción de `generar_contrato`, y esa prueba no se toca.

## 7. Constructor

- [x] 7.1 En `frontend/src/api/documentBuilderApi.js`, una función para `POST /api/document-builder/review` con el mismo cuerpo que generar.
- [x] 7.2 En `DocumentBuilderPage.jsx`, si algún campo faltante es `dynamic_text`, mostrar entre los campos y «Generar PDF y guardar» el paso «Revisar redacción». El botón usa la clase `btn`. Mientras revisa, dice «Revisando…» y queda desactivado. Sin campos `dynamic_text`, la pantalla y `canGenerate` quedan igual, y el botón no se renombra.
- [x] 7.3 Con `ok`: mostrar «Sin observaciones» y habilitar «Generar PDF y guardar», que envía `reviewId`. Con `observaciones`: listar el `label`, la cláusula, el problema y la sugerencia, y un botón «Usar sugerencia» que pone la sugerencia como valor de ese texto. «Generar igual» despliega un `<textarea class="clause-input">`; solo genera si el motivo tiene al menos 10 caracteres tras `trim`, y envía `generarIgual`. «Generar PDF y guardar» sigue desactivado mientras haya observaciones. Sin hex nuevos.
- [x] 7.4 Cualquier cambio de un campo faltante borra la revisión mostrada. Los errores `REVIEW_REQUIRED`, `REVIEW_HAS_OBSERVATIONS` y `REVIEW_UNAVAILABLE` se muestran con su mensaje.

## 8. Pruebas nuevas

Ningún archivo de prueba existente se modifica. Si una prueba que ya existía falla, no se ajusta: se consulta a la mesa. El andamiaje de `generateAndPersist` se copia; no se importa ni se edita el archivo de origen. Ninguna prueba llama a Claude ni abre una base. No correr la migración.

- [x] 8.1 Crear `backend/test/contractReviewer.test.js` con un `client` falso: la llamada usa `claude-opus-5`, el `system` exacto y el JSON de entrada; un `ok` con observaciones pasa a `observaciones`; una lista de observaciones vacía con `verdict: 'observaciones'` pasa a `ok` con `observations: []` (escenario «An empty list forces ok»); `refusal`, `parsed_output` nulo y una excepción del SDK dan `REVIEW_UNAVAILABLE`; la clave no aparece en ningún error.
- [x] 8.2 Crear `backend/test/documentBuilderService.review.test.js` con una plantilla mock que tiene la sección SEGUNDO con `{{servicios_entregables}}` y `{{cuentas_publicacion}}`, y un revisor falso. `reviewDraft` guarda la fila y devuelve el veredicto. La entrada al revisor no tiene RUT, dirección ni precio. `REVIEW_NOT_NEEDED` sin textos dinámicos. `REVIEW_UNAVAILABLE` sin revisor.
- [x] 8.3 En ese mismo archivo: `generateAndPersist` sin `reviewId` da `REVIEW_REQUIRED`; un `reviewId` de valores distintos da `REVIEW_REQUIRED`; un `dryRun: true` sobre una plantilla con `dynamic_text` y sin `reviewId` NO da `REVIEW_REQUIRED` (escenario «Dry run does not require a review»); con observaciones y sin motivo, `REVIEW_HAS_OBSERVATIONS`; con motivo de 9 caracteres, igual; con motivo válido, genera y guarda `review_id` y `review_override_reason`; con `ok`, genera y guarda `review_id`; una plantilla sin textos dinámicos genera sin `reviewId`.
- [x] 8.4 En ese mismo archivo, con una revisión `ok`: el valor `'  cinco (5) reels\n\nen   TikTok  '` se guarda en `contract_overrides` como `'cinco (5) reels en TikTok'`, y una frase con comas y paréntesis aparece tal cual en `content_snapshot`.
- [x] 8.5 Crear `backend/test/mcpRevision.test.js`: `revisar_redaccion` existe y su descripción incluye `PROHIBIDO aplicar una sugerencia sin que la persona la acepte`. Invocar su handler con un `documentBuilderService` falso que expone `reviewDraft` y `generateAndPersist`, y comprobar que llama a `reviewDraft` y no a `generateAndPersist` (escenario «The handler reviews and does not generate»). `generar_contrato` acepta `reviewId` y `generarIgual`, y su descripción incluye `PROHIBIDO decidirlo o redactarlo por cuenta propia`.
- [x] 8.6 Crear `frontend/src/pages/DocumentBuilderPage.review.test.jsx` con la API simulada y un campo `dynamic_text`: «Revisar redacción» con `ok` habilita «Generar PDF y guardar»; con observaciones las muestra, y «Usar sugerencia» cambia el valor y borra la revisión; «Generar igual» exige el motivo y lo envía; sin `dynamic_text`, no aparece el paso.
- [x] 8.7 Crear `backend/test/documentBuilderApi.review.test.js`, con el mismo patrón que `documentBuilderApi.test.js` (`createApp` + `supertest` + `attachAbilityWithRules`): `POST /api/document-builder/review` responde 403 sin el grant `use:DocumentBuilder` (escenario «The review route uses the document builder ability»).
- [x] 8.8 Crear `backend/test/contractReviewMigration.test.js`, con un knex falso que graba operaciones de schema (mismo patrón que `templateCurrencyMigrationClosure.test.js`, sin abrir una conexión real ni correr la migración contra la base): correr `up` y luego `down` de `202609290002_contract_review` y comprobar que `down` elimina `review_id` y `review_override_reason` de `draft_document` y elimina la tabla `contract_review` (escenario «down reverses both changes»).

## 9. Verificación

- [x] 9.1 Correr `cd backend && env -u DATABASE_URL npm test`, `cd frontend && npm test` y `cd frontend && npm run lint`. Las tres en verde; el lint, con 0 errores. Sin migraciones y sin escribir en la base.
- [x] 9.2 No tocar `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`, `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`, `.agent-orchestrator/**`. Ningún archivo de prueba existente cambia.

## 10. Veredicto final

- [x] 10.1 El insert de `contract_review.observations` guarda `JSON.stringify(reviewed.observations)`, para que pg no lo envíe como arreglo de Postgres. `backend/test/documentBuilderService.reviewPersistence.test.js` comprueba que el valor, pasado por `prepareValue` de pg, parsea a la lista (`[]` y con observaciones).
- [x] 10.2 `requireCurrentReview` rechaza un `reviewId` que no tiene forma de uuid con 409 `REVIEW_REQUIRED`, antes de consultar. La misma prueba nueva usa `reviewId: 'no-es-uuid'` y un stub que lanza como Postgres si la query llega a ejecutarse.
- [x] 10.3 Los cinco ids de `ablaciones-revisor.yaml` que el validador rechazó por camelCase quedaron en kebab-case.

## 11. Veredicto rojo

- [x] 11.1 «Reemplazar» un borrador duplicado reenvía el `generarIgual` y el motivo de la generación que recibió `DUPLICATE_DRAFT`. `frontend/src/pages/DocumentBuilderPage.reviewFollowup.test.jsx` cubre observaciones + motivo → `DUPLICATE_DRAFT` → reemplazar envía `overwrite`, `reviewId` y `generarIgual.motivo`.
- [x] 11.2 `draft_document.review_id` usa `ON DELETE NO ACTION` (C-0P8JHYZ). `backend/test/contractReviewOnDelete.test.js` lo comprueba, y `company_id` y `supplier_id` siguen en `CASCADE`. La migración no se corre.
- [x] 11.3 `reviewDraft` llama a la preparación con `dryRun: false`. `backend/test/documentBuilderService.reviewDryRun.test.js` comprueba que un cuerpo con `dryRun: true` igual llama al revisor e inserta la fila.
- [x] 11.4 Un cambio de campo faltante mientras la revisión está en curso descarta esa respuesta. La misma prueba de interfaz lo cubre: no aparece «Sin observaciones» y «Generar PDF y guardar» sigue desactivado.
- [x] 11.5 `ablaciones.md` no tiene ablaciones que sobrevivan. Las cinco que el veredicto marcó como no corridas ya tienen prueba en los archivos nuevos de las tareas 6, 7, 10.1 y 10.2.
