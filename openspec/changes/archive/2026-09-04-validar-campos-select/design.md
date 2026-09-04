## Context

`generateAndPersist` toma `missingFieldOverrides` tal cual (~línea 352), los pasa por `preprocessMissingFieldOverrides` (formato de fechas, precio, `formato_reel` → minúsculas/plural) y los imprime. `buildMissingFields` ya calcula `type: 'select'` y `options` para `client_product_campaign`, `formato_reel` y `proveedor_red_social`, pero nadie exige que el valor recibido esté en esa lista.

En pre-prod, Laboratorio Chile tiene campañas `DRYOFF` y `Solbiot`. El agente MCP eligió `DRYOFF` para un contrato de Solbiot. `DRYOFF` **sí** está en catálogo: este change no habría bloqueado ese PDF concreto. Sí bloquea el caso de fondo — un string que no es opción — y el mismo patrón (select declarado, backend permisivo) que `proveedor-datos-contacto`.

REST (`POST /api/document-builder/generate`) y MCP (`validar_contrato`, `generar_contrato`) entran por el mismo servicio. `signContract` re-renderiza `content_snapshot`; no vuelve a generar.

Este diseño no reabre D1–D4 del brief.

## Goals / Non-Goals

**Goals:**

- Rechazar en generación (y dry-run) cualquier override cuyo campo resuelva a `type: 'select'` con opciones no vacías y cuyo valor no coincida exactamente con una opción.
- Derivar tipo y opciones de la misma función que alimenta `missingFields` (I2).
- Para `proveedor_red_social`, exigir un par `(red, cuenta)` que exista en el proveedor, no una combinación cruzada.
- Mensaje es-CL con campo y opciones válidas, sin el valor rechazado.
- REST y MCP iguales. Firma y descarga de borradores existentes intactas.

**Non-Goals:**

- Cambiar catálogo de productos, UI de clientes o el `<select>` del constructor.
- Normalizar, fuzzy-match o autocorregir el valor.
- Sustituir la validación por un cambio de prompt MCP.
- Validar campos que no resuelvan a select (texto, fecha, número).
- Reescribir `contract_overrides` ya persistidos ni migrar datos.
- Impedir elegir el producto *equivocado* cuando ese nombre sí está en catálogo.

## Decisions

### D1 — Validación en `generateAndPersist`, no en MCP ni solo en UI (cerrada)

Un POST, un tool call o un cliente externo no pueden inyectar un valor fuera de catálogo. `validar_contrato` (dry-run) y `generar_contrato` / REST pasan por la misma función; el rechazo es idéntico.

**Descartado:** validar en `mcpTools.mjs` o en `DocumentBuilderPage`. Eso deja el hueco en el otro canal.

### D2 — Tipo y opciones resueltos, no cableados a un campo (cerrada)

Extraer de `buildMissingFields` una función `resolveFieldDefinition(key, { clientRow, supplierRow })` que devuelve `{ key, label, type, options?, pairField?, source }`. `buildMissingFields` mapea claves faltantes a esa función. El validador la llama para cada override no vacío (secundarios → primario vía `SECONDARY_FIELDS`).

Validar **si y solo si** el tipo resuelto es `'select'` **y** `options` es un array con length > 0. Consecuencias:

| Campo hoy | Condición | Efecto |
| --- | --- | --- |
| `formato_reel` | siempre select con `FORMATO_REEL_OPTIONS` | siempre se valida si viene no vacío |
| `client_product_campaign` | select + options solo si el cliente tiene campañas | sin campañas / sin cliente → no hay lista cerrada → no se rechaza (I3) |
| `proveedor_red_social` | select con `{label,values}` si hay redes; si no, `type: 'text'` | sin redes → texto libre, no se valida como select |
| cualquier otro | text/date/number | no se toca |

Un select futuro que `resolveFieldDefinition` empiece a poblar queda cubierto sin otro change.

**Descartado:** `if (key === 'client_product_campaign')` suelto. Se desincroniza de `missingFields`.

### D3 — Comparación exacta, sobre el valor crudo, antes del preprocess (cerrada)

`"DRYOFF"` y `"Dryoff"` son entradas distintas. Nada de `toLowerCase`, NFD, trim de match ni «la más parecida».

`preprocessMissingFieldOverrides` reescribe `formato_reel` a `"reel"` / `"videos"`. Si se valida **después**, `"Video"` (opción válida) deja de coincidir con `FORMATO_REEL_OPTIONS`. Por eso el validador corre sobre `overridesRaw`, **antes** del preprocess, y solo entonces se formatea para el PDF.

`formatFormatoReel` conserva su lookup laxo para **renderizar** un label ya validado (`"Video"` + cantidad 3 → `"videos"`). Su fallback genérico (`"Publicación"` → `"publicaciones"`) sigue existiendo en el util; generación ya no le pasa valores fuera de catálogo.

Un override vacío (`''` / `null` / ausente) no se valida como select: sigue el camino `MISSING_PLACEHOLDERS`. Un valor que es solo espacios no está en el catálogo → se rechaza (no se recorta para «vaciarlo»).

**Descartado:** reusar el `lookupKey` de `formatReels.js` en la validación. Esconde justo el error que queremos atrapar.

### D4 — Rechazar, no corregir (cerrada)

HTTP 400, `code: 'VALIDATION_ERROR'`, `message` en es-CL. Primer campo inválido (no se acumulan). El PDF no se sube, el draft no se inserta.

Forma del mensaje (label del campo, no la key; opciones en el mismo orden que `missingFields`):

- Options string: `El valor de Producto/Campaña no es una opción válida. Opciones: DRYOFF, Solbiot.`
- Options `{ label, values }`: `El valor de Red Social no es una opción válida. Opciones: Instagram — @marca, TikTok — @otra.`

**Sin** interpolar el valor rechazado. Sin `data` extra: el mensaje basta para UI y para el agente.

### D-par — Red social: variable primaria y par completo

Las options de `proveedor_red_social` son objetos. Validar:

1. `proveedor_red_social` (si no vacío) es igual a algún `option.values.proveedor_red_social`.
2. Si **ambos** `proveedor_red_social` y `proveedor_cuenta_social` vienen no vacíos, el par exacto debe ser uno de los `option.values`. Instagram + handle de TikTok → rechazo, aunque cada pieza exista por separado.

Si solo llega la red y la cuenta falta, (1) basta; la cuenta pendiente sigue siendo `MISSING_PLACEHOLDERS`. Si solo llega la cuenta, se resuelve el primario y se exige que esa cuenta aparezca en algún `values.proveedor_cuenta_social` del mismo proveedor; si además hay red, aplica (2).

### D-ciclo — Solo al generar, no al firmar

`signContract` usa `content_snapshot` (y el PDF de GCS como fallback). No llama `generateAndPersist`. Overwrite de un duplicado **sí** es una generación nueva: el body trae los overrides del formulario/MCP (labels de catálogo), no el JSONB ya preprocesado.

Los `contract_overrides` persistidos de `formato_reel` quedan en forma renderizada (`"videos"`). Eso **no** se revalida al firmar. El listado de cierre (tarea operativa) no debe comparar `formato_reel` persistido contra `FORMATO_REEL_OPTIONS` (daría falsos positivos en todos los contratos bien generados); ver Risks.

### D-mcp — Descripciones taxativas, mitigación no garantía (Parte 2)

La validación de catálogo (Parte 1) no habría evitado Solbiot/DRYOFF: ambos están en la lista. El agente eligió mal con la instrucción tibia («muestra las opciones numeradas y espera elección»).

Solo se cambia el **texto** de las descripciones en `mcpTools.mjs`. Ni Zod ni el servicio. El formulario web no se toca: ahí el usuario ya elige de un desplegable.

`validar_contrato`, en el bloque de select:

- Más de una opción → **prohibido** elegir por cuenta propia. Mostrar numeradas y esperar respuesta explícita.
- Prohibido inferir del contexto (producto, marca o campaña mencionados antes).
- Si la respuesta no coincide exactamente con una opción, volver a preguntar. Prohibido mapear a la más parecida.
- Una sola opción → se puede usar sin preguntar.

`generar_contrato`, requisito previo: listar al usuario todos los valores de `missingFieldOverrides` y esperar confirmación explícita antes de llamar la tool.

**Límite escrito:** esto es mitigación de prompt, no un control efectivo. El backend recibe un valor, no la conversación; no puede verificar que se preguntó. Quien lea el spec más adelante no debe tratarlo como defensa. La defensa real de esta familia de errores (valor válido, elección equivocada) es la separación borrador → firma, donde una persona revisa antes de que el documento tenga efecto.

Parte 1 y Parte 2 son complementarias: una cubre «valor inexistente», la otra «elección no confirmada».

## Risks / Trade-offs

- **[I1] Valor fuera de catálogo llega al PDF** → validar en el servicio compartido, antes de sustituir y de persistir. Tests REST-equivalentes vía servicio (dry-run y generate) cubren MCP.
- **[I2] Catálogo de validación ≠ catálogo de missingFields** → una sola `resolveFieldDefinition`.
- **[I3] Se endurece un campo que no es select** → el validador no entra si el tipo resuelto no es select con options. Tests de camino feliz de text/date/number no se tocan.
- **[Firma / regeneración de borradores existentes]** → no validar en `signContract` ni al descargar. Test de no-regresión: `signContract` con snapshot cuyo override, leído hoy, no pasaría el select (p. ej. `formato_reel: "videos"` persistido).
- **[Overwrite reenvía JSONB preprocesado]** → hoy el front y el MCP reenvían el estado de missing fields (labels), no `draft.contract_overrides`. Documentado; no hay flujo que rehidrate el JSONB hacia generate.
- **[Listado de cierre marca todos los `formato_reel` como inválidos]** → el audit compara campañas y pares de red contra catálogo actual; para `formato_reel` compara contra singular+plural del catálogo `FORMATOS`, no contra los labels. `DRYOFF` en un contrato de Solbiot **no** aparece: está en catálogo.
- **[Este change no habría evitado el incidente Solbiot/DRYOFF con solo Parte 1]** → aceptado para el catálogo. La Parte 2 endurece la instrucción del agente (prohibido elegir; confirmación previa). Sigue siendo mitigación: el modelo puede ignorar el prompt. La defensa real es que el PDF es un borrador hasta que una persona firma.
- **[BREAKING: `"videos"` / `"Vídeo"` como override de formato]** → pasa a 400. El UI y `missingFields` ya ofrecen `"Video"`. Aceptado por D3.
- **[Cliente sin campañas: producto libre]** → D2, options vacías = no hay lista. Sigue como hoy.
- **[MCP HTTP pre-prod sin auth]** → no se mitiga aquí; la validación igual corre en ese proceso.

**Trade-off D4 primer-error:** un request con dos selects inválidos solo reporta el primero. El agente corrige y reintenta. Más simple que un array de errores que hoy no existe en `VALIDATION_ERROR`.

## Migration Plan

1. Desplegar backend. Sin migración de BD. Frontend no cambia: un front viejo contra un back nuevo sigue funcionando si envía labels de `options`.
2. Dry-run y generate empiezan a devolver 400 en valores fuera de catálogo.
3. Al cerrar: query operativa de borradores activos (`draft_document.status` no in `signed`/`rejected`) cuyos overrides de select no pertenezcan al catálogo **actual** del cliente/proveedor (con la salvedad de `formato_reel` en D-ciclo). Entregar el listado; no backfillear.
4. Rollback: revertir el commit del servicio. Los PDF ya emitidos no se tocan.

## Open Questions

Ninguna. D1–D4 están cerradas. D-par / D-ciclo / D-mcp son consecuencias de implementación, no reaperturas.
