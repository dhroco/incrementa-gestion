## 1. Resolver compartido

- [x] 1.1 Extraer `resolveFieldDefinition(key, { clientRow, supplierRow })` en `documentBuilderService.js` con la lógica que hoy vive dentro de `buildMissingFields` (`formato_reel` → `FORMATO_REEL_OPTIONS`; `client_product_campaign` → nombres de campaña si hay; `proveedor_red_social` → `{label,values}` o fallback `text`). `buildMissingFields` debe mapear las claves normalizadas a esa función. Sin cambiar el shape de `missingFields`.
- [x] 1.2 Confirmar que los tests existentes de `missingFields` (`documentBuilderService.dryRun.test.js`: campañas, redes, fallback texto) siguen verdes sin ajustar aserciones.

## 2. Validador de selects

- [x] 2.1 Implementar `validateSelectOverrides(overridesRaw, { clientRow, supplierRow })`: recorrer overrides no vacíos; mapear secundarios con `SECONDARY_FIELDS`; si el campo resuelto es `type === 'select'` y `options.length > 0`, exigir match exacto (strings vs `option.values[primary]`). Par de red social: si ambos valores vienen, el par debe ser uno de los `option.values` (D-par). Primer error: `{ ok: false, status: 400, code: 'VALIDATION_ERROR', message }` en es-CL con label + opciones (labels si son objetos), **sin** el valor rechazado.
- [x] 2.2 Llamar el validador en `generateAndPersist` sobre `overridesRaw` **antes** de `preprocessMissingFieldOverrides`, con `clientRow` y `supplier` ya cargados. Si falla, return inmediato (cubre generate y dry-run). No llamar el validador desde `signContract` ni desde download.

## 3. Tests de catálogo

- [x] 3.1 `client_product_campaign`: cliente con `["DRYOFF", "Solbiot"]` — `"Solbiot"` ok; `"Producto Inventado"` → 400 sin eco del valor, mensaje lista las dos opciones; `"Dryoff"` → 400; dry-run igual; sin cliente / sin campañas → `"Campaña Libre"` no se rechaza. Generate inválido no llama `uploadBuffer` ni inserta draft.
- [x] 3.2 `formato_reel`: `"Video"` + `cantidad_reels: "3"` ok y el map queda `"videos"`; `"Publicación"` → 400 listando `FORMATO_REEL_OPTIONS`; `"video"` → 400. `lugar_contrato` con cualquier string no dispara este código.
- [x] 3.3 `proveedor_red_social`: par Instagram/@marca ok; cruzado Instagram/@otra → 400 listando ambos labels; `"Facebook"` → 400; proveedor sin redes → texto libre no se rechaza.

## 4. No-regresión de borradores y firma

- [x] 4.1 Test: `signContract` con `content_snapshot` y `contract_overrides.formato_reel: "videos"` (valor ya renderizado, no label de catálogo) completa sin `VALIDATION_ERROR`. No rehidratar overrides hacia `generateAndPersist`.
- [x] 4.2 Recorrer tests de generate/overwrite existentes; si alguno manda `formato_reel` fuera del label exacto, ajustar el payload al label de catálogo (no relajar el validador).

## 5. MCP — Parte 2 (descripciones; no sustituye la validación)

- [x] 5.1 En `validar_contrato` (`mcpTools.mjs`), reemplazar «muestra las opciones numeradas y espera elección» por instrucción taxativa: si `type='select'` tiene más de una opción, prohibido elegir por cuenta propia; mostrar numeradas y esperar respuesta explícita; prohibido inferir del contexto; si no coincide exactamente, volver a preguntar (Dryoff ≠ DRYOFF); una sola opción se puede usar sin preguntar; option con `values` exige el par completo. Solo texto. Ni Zod ni el handler.
- [x] 5.2 En `generar_contrato`, agregar requisito previo: antes de llamar la tool, listar al usuario TODOS los valores de `missingFieldOverrides` y esperar confirmación explícita (última oportunidad antes de un PDF con efectos legales). Solo texto.
- [x] 5.3 Test MCP: la descripción de `validar_contrato` contiene la prohibición de elegir por cuenta propia y la espera de respuesta explícita; la de `generar_contrato` contiene el requisito de confirmación previa. No afirmar que el backend verifica la conversación.

## 6. Cierre

- [x] 6.1 `npm test` en `backend/` y `frontend/` en verde. No cambiar catálogo de productos, UI de clientes, ni `formatFormatoReel` (el fallback genérico del util puede quedarse).
- [x] 6.2 Query operativa contra la BD de dev (proxy): borradores activos (`draft_document.status` not in `signed`,`rejected`) cuyos overrides de select no estén en el catálogo **actual**. Campañas vs `client_product_campaign.name` del `client_id`; redes vs pares de `supplier` social networks; `formato_reel` vs singular+plural de `FORMATOS` (nunca vs los labels, que darían falsos positivos). Entregar id, file_name, cliente, campo y valor persistido. Puede ser lista vacía. No backfillear ni reescribir JSONB.
