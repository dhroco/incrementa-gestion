## Why

En pre-prod se generó un contrato para el producto «Solbiot» y el PDF salió con «DRYOFF», otro producto del mismo cliente. El borrador guardó `contract_overrides.client_product_campaign = "DRYOFF"`: el valor equivocado entró **al generar**, no al renderizar. El campo está declarado `type: 'select'` con lista cerrada, pero `documentBuilderService` acepta cualquier string en `missingFieldOverrides` y lo imprime. Es el mismo patrón que cerró `proveedor-datos-contacto`: validación declarada para la interfaz, no exigida en el backend. Lo disparó el actor MCP (`mcp@incrementa.la`); un agente, un dedazo o un cliente REST pueden repetirlo.

## What Changes

- En `generateAndPersist` (generación real y dry-run): todo override cuyo campo **resuelva** a `type: 'select'` con opciones no vacías debe coincidir **exactamente** con una de esas opciones. Si no, error de validación. No se normaliza, no se corrige, no se elige «la más parecida».
- La lista de opciones sale de la **misma** fuente que `buildMissingFields` (hoy: `client_product_campaign` desde campañas del cliente, `formato_reel` desde `FORMATO_REEL_OPTIONS`, `proveedor_red_social` desde redes del proveedor). No se cablea un campo suelto.
- Para `proveedor_red_social` (opciones `{ label, values }`): validar el valor de la variable primaria **y** que el par `(proveedor_red_social, proveedor_cuenta_social)` sea uno de los pares del proveedor — no una combinación cruzada.
- Mensaje en español (es-CL) con el campo y las opciones válidas; **sin** el valor rechazado. Mismo camino de error existente (`VALIDATION_ERROR` / HTTP 400). REST y MCP, porque ambos entran por el servicio.
- Tests: fuera de catálogo, mayúsculas distintas, par cruzado de red social, y camino feliz de cada select.
- Al cerrar: listado de borradores activos cuyos overrides de select estén fuera del catálogo **actual**. Puede ser vacío; el dato importa igual.
- **Parte 2 (complementaria, no sustituto):** endurecer las descripciones de `validar_contrato` y `generar_contrato` para prohibir que el agente elija un select de varias opciones por su cuenta y para exigir confirmación explícita de los overrides antes de generar. Es mitigación de prompt, no un control: el backend no ve la conversación. La defensa real de «valor válido, elección equivocada» sigue siendo borrador → firma.

**No entra:** cambiar el catálogo de productos ni la UI de clientes; normalizar o autocorregir; sustituir la validación de catálogo por el prompt MCP; cambiar schemas Zod ni el comportamiento del servicio por la Parte 2; endurecer campos que no sean select; validar al firmar o al descargar un borrador ya persistido.

**BREAKING** para clientes de la API/MCP que hoy envían un select con un valor que no está exactamente en el catálogo (p. ej. `"videos"` en vez de `"Video"`, o un producto inventado). Esos requests pasan a 400. Quien envía el label de las `options` de `missingFields` no se ve afectado.

## Capabilities

### New Capabilities

_(ninguna)_

### Modified Capabilities

- `document-builder-client-context`: `client_product_campaign` en overrides debe pertenecer exactamente a las campañas del cliente cuando el campo resuelve a select con opciones; si no, validación en generación y dry-run.
- `document-builder-supplier-context`: `formato_reel` y `proveedor_red_social` (con su par `proveedor_cuenta_social`) se validan contra las mismas opciones que `buildMissingFields`; par cruzado de red social rechazado.
- `backend-mcp-server`: descripciones de `validar_contrato` y `generar_contrato` taxativas (prohibido elegir un select de varias opciones; confirmación previa al generar). Mitigación, no garantía.

## Impact

**Backend:** `documentBuilderService.js` — extraer la resolución de tipo/opciones que hoy vive dentro de `buildMissingFields` y usarla tanto para `missingFields` como para validar overrides **antes** de `preprocessMissingFieldOverrides` (si se valida después, `formato_reel` ya está en minúsculas y el match exacto contra `FORMATO_REEL_OPTIONS` falla). `validar_contrato` / `generar_contrato` (MCP) y `POST /api/document-builder/generate` no cambian de firma; cambian el rechazo.

**Frontend:** sin cambio de UI. El constructor ya presenta un `<select>` cerrado; el hueco es el backend (MCP y cualquier cliente que ignore las options).

**Firma / regeneración de borradores existentes:** `signContract` usa `content_snapshot`, no re-entra a `generateAndPersist`. La validación **solo** corre al generar (incluido dry-run y overwrite con un body nuevo). Un PDF ya emitido con un valor de catálogo (aunque fuera el producto equivocado) sigue firmable.

**Datos:** no hay migración. Los `contract_overrides` ya persistidos no se reescriben. Al cerrar se entrega un listado operativo de borradores activos con algún select fuera de catálogo.

## Consideraciones de seguridad

Un contrato con el producto equivocado es un documento con efectos legales y comerciales, no un typo cosmático. Quien genera (humano o agente) no debe poder inyectar un valor fuera de catálogo por REST ni por MCP.

- La validación vive en el servicio compartido (D1). Cerrar solo el prompt MCP o solo la UI no impide un POST directo.
- El mensaje de error **nombra el campo y las opciones válidas** (el receptor necesita saber qué puede elegir) y **no interpola el valor rechazado**, igual que `proveedor-datos-contacto` con el email. Evita filtrar en logs/respuestas un string arbitrario que el cliente mandó.
- Comparación exacta (D3): no hay match fuzzy que «corrija» `Dryoff` → `DRYOFF` y esconda el error.
- No se adivina la opción más parecida (D4): un agente que alucina un producto no debe ver su alucinación impresa.
- No se toca autorización CASL ni se exponen datos nuevos. Las opciones ya viajan en `missingFields` a quien puede generar.
- El MCP HTTP de pre-prod sigue sin autenticación (riesgo asumido de otro change). Esta validación igual aplica a ese camino porque entra por el mismo servicio.
