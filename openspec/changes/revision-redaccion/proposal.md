## Why

Los textos dinámicos los redacta quien completa el contrato, y un error de concordancia, de redes o de registro queda impreso en un PDF con efectos legales. Hoy no hay revisión de esa redacción antes de generar. Este recorte la agrega, en el Constructor y en el MCP, y deja evidencia de la revisión que se usó. Depende de `texto-dinamico-base` y `texto-dinamico-plantillas`.

## What Changes

- Antes de generar el PDF, un revisor (Claude, desde el backend) lee la sección SEGUNDO ya sustituida y devuelve `ok` o `observaciones`, con una sugerencia por cada problema.
- El Constructor muestra el paso «Revisar redacción» cuando hay campos `dynamic_text`. Se puede aceptar una sugerencia y volver a revisar. «Generar» exige una revisión de los valores actuales. Si hay observaciones, «Generar igual» pide un motivo de al menos 10 caracteres y lo registra.
- El MCP gana `revisar_redaccion`. `generar_contrato` acepta `reviewId` y `generarIgual`. Las descripciones prohíben aplicar una sugerencia o redactar el motivo sin que la persona lo pida.
- Cada revisión se guarda. El borrador apunta a la que se usó y, si hubo, al motivo de «Generar igual».
- Las plantillas sin textos dinámicos, y el `dryRun`, se generan igual que hoy, sin revisión.

## Capabilities

### New Capabilities

- `contract-redaction-review`: cliente del revisor, persistencia de cada revisión, `POST /api/document-builder/review`, exigencia de revisión al generar cuando hay `dynamic_text`, y el paso «Revisar redacción» en el Constructor.

### Modified Capabilities

- `backend-mcp-server`: herramienta nueva `revisar_redaccion`. `generar_contrato` acepta `reviewId` y `generarIgual: { motivo }` y agrega, al final de su descripción y sin editar las frases existentes, la exigencia del `reviewId` y la prohibición de decidir o redactar el motivo.

## Impact

**Backend:** `backend/lib/contractReviewer.js` (nuevo), dependencia `@anthropic-ai/sdk`, migración `backend/migrations/202609290002_contract_review.js` (tabla `contract_review`; `draft_document.review_id` y `review_override_reason`). `documentBuilderService.js` gana `reviewDraft` y, en `generateAndPersist` sin `dryRun` y solo si hay `dynamic_text`, la verificación de la revisión. Ruta `POST /api/document-builder/review`. El revisor se inyecta en el servicio, en `app.js` y en `mcpServer.mjs`. La migración no se corre en este change.

**Frontend:** `DocumentBuilderPage.jsx`. El paso aparece solo si hay campos `dynamic_text`. Un cambio de campo borra la revisión mostrada.

**APIs:** `POST /api/document-builder/review` con `authorize('use', 'DocumentBuilder')`. `POST /api/document-builder/generate` acepta `reviewId` y `generarIgual: { motivo }`. Códigos nuevos: 400 `REVIEW_NOT_NEEDED`, 503 `REVIEW_UNAVAILABLE`, 409 `REVIEW_REQUIRED`, 409 `REVIEW_HAS_OBSERVATIONS`. Mensajes en español.

**Datos:** cada revisión guarda hash de la entrada, veredicto, observaciones, texto revisado y modelo. El borrador guarda `review_id` y, si corresponde, `review_override_reason`. A Anthropic sale la sección SEGUNDO sustituida, los textos dinámicos y `{ redesDelProveedor, mes_ejecucion, fecha_contrato }`. No salen RUT, direcciones ni precio.

**Dependencias:** `@anthropic-ai/sdk` es la única dependencia nueva. `ANTHROPIC_API_KEY` ya está en `config.js` y no se toca ese archivo. Sin cambios en `docs/**`, `openspec/config.yaml`, reglas, infra ni `.agent-orchestrator/**`.

**Pruebas:** ningún archivo de prueba existente se modifica. Pruebas nuevas con un cliente falso, sin llamadas reales a Claude ni escrituras a la base: `backend/test/contractReviewer.test.js`, `backend/test/documentBuilderService.review.test.js`, `backend/test/mcpRevision.test.js` y `frontend/src/pages/DocumentBuilderPage.review.test.jsx`.

## Consideraciones de seguridad

La sección SEGUNDO sale del perímetro hacia la API de Claude. Incluye el nombre de la marca y las cuentas del influencer. No incluye RUT, direcciones ni precio. La clave `ANTHROPIC_API_KEY` no se escribe en mensajes ni en logs.

La revisión es evidencia de lo que se vio antes de generar. El servidor exige un `reviewId` cuyo hash coincida con los valores actuales; un cambio de texto invalida la revisión anterior. «Generar igual» no borra las observaciones: guarda el motivo junto al borrador.

En el MCP, mostrar la sugerencia y no aplicarla, y no inventar el motivo, son mitigación de prompt. El control está en el servicio: sin revisión vigente no genera, y un motivo de menos de 10 caracteres se rechaza. El agente no puede saltarse esa puerta.

**Validación:**

| Campo | Dónde | Regla |
| --- | --- | --- |
| Plantilla sin `dynamic_text` | Backend, `reviewDraft` | 400 `REVIEW_NOT_NEEDED`: «Esta plantilla no tiene textos dinámicos que revisar.» La generación sigue sin `reviewId`. |
| Campos faltantes | Backend, `reviewDraft` | El mismo 422 `MISSING_PLACEHOLDERS` que el `dryRun`. |
| Revisor ausente o fallido | Backend | 503 `REVIEW_UNAVAILABLE`: «No se pudo revisar la redacción en este momento. Intenta de nuevo en unos minutos.» |
| `reviewId` ausente, de otra empresa, proveedor o plantilla, o con hash distinto | Backend, `generateAndPersist` | 409 `REVIEW_REQUIRED`: «Revisa la redacción antes de generar: no hay una revisión de los textos actuales.» |
| Veredicto `observaciones` sin motivo válido | Backend | 409 `REVIEW_HAS_OBSERVATIONS`: «La revisión tiene observaciones. Corrige el texto o usa «Generar igual» indicando el motivo.» El motivo, tras `trim`, tiene al menos 10 caracteres. |
| Sugerencia | Constructor | «Usar sugerencia» copia la sugerencia al texto dinámico y borra la revisión mostrada. No genera sola. |
| Motivo de «Generar igual» | Constructor y MCP | Lo escribe o lo dicta la persona. Mínimo 10 caracteres. Se envía en `generarIgual.motivo`. |
| Mensajes de error | API y Constructor | En español (`es-CL`). Se muestran `REVIEW_REQUIRED`, `REVIEW_HAS_OBSERVATIONS` y `REVIEW_UNAVAILABLE`. |
