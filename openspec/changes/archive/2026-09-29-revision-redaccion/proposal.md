## Why

Los textos dinámicos los redacta quien completa el contrato, y un error de concordancia, de cantidad o de redes queda impreso en un PDF con efectos legales. Antes de generarlo, un revisor (Claude) tiene que mirar la sección SEGUNDO completa y devolver un veredicto. David decidió el 29-sep (decisión (d) de `docs/disenos/texto-dinamico.md`) que generar sin una revisión de los valores actuales no se permite, y que con observaciones abiertas se puede «Generar igual» dejando un motivo registrado. Las plantillas sin textos dinámicos siguen generándose como hoy. Este recorte depende de `texto-dinamico-base` y `texto-dinamico-plantillas`, y en producción va junto con el de plantillas para que ningún contrato real salga con texto dinámico sin revisar.

## What Changes

- Un cliente de Claude en el backend (`backend/lib/contractReviewer.js`, dependencia `@anthropic-ai/sdk`) revisa la sección SEGUNDO ya sustituida y devuelve `ok` u `observaciones`, cada una con el texto dinámico, la cláusula, el problema y una sugerencia de reescritura solo de ese texto.
- Cada revisión se guarda en `contract_review` (hash de la entrada, veredicto, observaciones, texto revisado, modelo). El borrador apunta a la revisión usada (`draft_document.review_id`) y, si se generó igual, al motivo (`review_override_reason`).
- `POST /api/document-builder/review` pide la revisión con el mismo cuerpo que generar. Si faltan campos, responde 422 `MISSING_PLACEHOLDERS`. Si la plantilla no tiene `dynamic_text`, responde 400 `REVIEW_NOT_NEEDED`. Si el revisor no está configurado o falla, responde 503 `REVIEW_UNAVAILABLE`.
- Generar un contrato cuya plantilla tiene al menos un `dynamic_text` exige `reviewId` de una revisión de la misma empresa, proveedor, plantilla y de los valores actuales (`input_hash`). Si no, 409 `REVIEW_REQUIRED`. Con veredicto `observaciones`, hace falta `generarIgual.motivo` de al menos 10 caracteres; si no, 409 `REVIEW_HAS_OBSERVATIONS`. El `dryRun` y las plantillas sin texto dinámico no cambian.
- En el Constructor, si hay un campo `dynamic_text`, aparece el paso «Revisar redacción»: veredicto, «Usar sugerencia», «Generar igual» con motivo, y cualquier cambio de campo borra la revisión mostrada.
- El MCP gana `revisar_redaccion` (mismos parámetros que `validar_contrato`) y `generar_contrato` acepta `reviewId` y `generarIgual`. Las descripciones prohíben aplicar una sugerencia o redactar el motivo sin que la persona lo pida. El rechazo en el servidor no depende de que el agente cumpla el prompt.

## Capabilities

### New Capabilities

- `contract-review`: cliente de revisión, persistencia de la evidencia, puerta de generación, endpoint de revisión y paso «Revisar redacción» / «Generar igual» en el Constructor.

### Modified Capabilities

- `backend-mcp-server`: herramienta nueva `revisar_redaccion` y parámetros `reviewId` y `generarIgual` en `generar_contrato`, con texto agregado al final de su descripción. La regla de que esa descripción no cambia queda reemplazada por «se agrega texto al final, sin editar las frases que ya existen».

## Impact

**Backend:** `backend/lib/contractReviewer.js` (nuevo), `backend/package.json` (`@anthropic-ai/sdk`), migración `backend/migrations/202609290002_contract_review.js` (no se corre en este cambio), `backend/services/documentBuilderService.js` (`reviewDraft` y la verificación en `generateAndPersist`), `backend/controllers/documentBuilderController.js`, `backend/app.js` y `backend/mcpServer.mjs` (inyección del revisor), `backend/mcpTools.mjs`. `backend/config.js` no se toca: `ANTHROPIC_API_KEY` ya existe.

**Frontend:** `frontend/src/pages/DocumentBuilderPage.jsx`. Sin textos dinámicos, la pantalla queda igual.

**APIs:** `POST /api/document-builder/review` (nuevo, `authorize('use', 'DocumentBuilder')`). `POST /api/document-builder/generate` acepta además `reviewId` y `generarIgual: { motivo }`.

**Datos:** tabla `contract_review` y columnas nulables `draft_document.review_id` y `draft_document.review_override_reason`. La migración la aplica Ignacio; este cambio no escribe en la base.

**MCP:** herramienta `revisar_redaccion`; `generar_contrato` gana `reviewId` y `generarIgual`.

**Pruebas:** archivos nuevos `backend/test/contractReviewer.test.js`, `backend/test/documentBuilderService.review.test.js`, `backend/test/mcpRevision.test.js` y `frontend/src/pages/DocumentBuilderPage.review.test.jsx`. Ningún archivo de prueba existente se modifica. Ninguna prueba llama a Claude de verdad. `dynamicText.test.js` ya espera `409 REVIEW_REQUIRED` en dos casos y este recorte los deja en verde.

**Dependencias:** solo `@anthropic-ai/sdk`.

## Consideraciones de seguridad

La sección SEGUNDO ya sustituida sale a la API de Claude. Incluye el nombre de la marca y la cuenta del influencer. No incluye RUT, direcciones ni precio: la entrada se arma con la sección, los textos dinámicos y `{ redesDelProveedor, mes_ejecucion, fecha_contrato }`. David aceptó ese envío el 29-sep.

- La clave `ANTHROPIC_API_KEY` no se escribe en mensajes ni en logs. Un fallo del revisor responde 503 con un mensaje fijo en español, sin el detalle del SDK.
- Generar sin una revisión de los valores actuales lo rechaza el servidor (409), en la API y en el MCP. La descripción de la herramienta es una mitigación de prompt, no el control.
- Una sugerencia no se aplica sola: en el Constructor hace falta «Usar sugerencia»; en el MCP está prohibido pasarla sin aceptación explícita de la persona. Aplicarla borra la revisión y hay que volver a revisar.
- «Generar igual» exige un motivo de al menos 10 caracteres que dicta la persona. Queda en `review_override_reason` junto con `review_id`, de modo que se sabe qué revisión (fecha, modelo, textos, veredicto y observaciones) se usó y por qué se generó con observaciones abiertas.
- El `dryRun` no llama al revisor ni exige `reviewId`.

**Validación:**

| Campo | Dónde | Regla |
| --- | --- | --- |
| Revisión | Backend, al generar si la plantilla tiene `dynamic_text` | `reviewId` obligatorio, de la misma empresa, proveedor y plantilla, con el `input_hash` de los valores actuales. Si no, 409 `REVIEW_REQUIRED`: «Revisa la redacción antes de generar: no hay una revisión de los textos actuales.» |
| `generarIgual.motivo` | Backend, si el veredicto es `observaciones` | Tras `trim`, al menos 10 caracteres. Si falta o es más corto, 409 `REVIEW_HAS_OBSERVATIONS`: «La revisión tiene observaciones. Corrige el texto o usa «Generar igual» indicando el motivo.» |
| Plantilla sin `dynamic_text` | Backend, en `reviewDraft` | 400 `REVIEW_NOT_NEEDED`: «Esta plantilla no tiene textos dinámicos que revisar.» Generar sigue sin `reviewId`. |
| Revisor no configurado o fallo | Backend | 503 `REVIEW_UNAVAILABLE`: «No se pudo revisar la redacción en este momento. Intenta de nuevo en unos minutos.» |
| Campos faltantes | Backend, en `reviewDraft` | El mismo 422 `MISSING_PLACEHOLDERS` que el `dryRun`. |
| Paso «Revisar redacción» | Frontend | Solo si hay un campo `dynamic_text`. «Generar» se habilita con veredicto `ok`. «Generar igual» exige el motivo de al menos 10 caracteres y lo envía. Un cambio de campo borra la revisión mostrada. |
| Mensajes | Backend y frontend | En español (`es-CL`). Los códigos `REVIEW_REQUIRED`, `REVIEW_HAS_OBSERVATIONS` y `REVIEW_UNAVAILABLE` se muestran con su mensaje. |
