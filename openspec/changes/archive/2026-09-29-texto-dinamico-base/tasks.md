## 1. Catálogo

- [x] 1.1 Crear `backend/services/dynamicTextCatalog.js` que exporte `DYNAMIC_TEXT_CATALOG` y `getDynamicTextDefinition(id)`. Las dos entradas, con `label`, `instruccion` y `ejemplos` en el orden del encargo: `servicios_entregables` y `cuentas_publicacion`. Un id desconocido devuelve `undefined`. Este archivo es la única fuente de instrucción y ejemplos en el backend.

## 2. Metadatos y contexto

- [x] 2.1 En `VARIABLE_META` (`documentBuilderService.js`), agregar una entrada por id del catálogo con `type: 'dynamic_text'`, `source: 'contract'` y `label` tomado del catálogo (no copiar el texto). `getVariableMeta` de esos ids devuelve `dynamic_text` aunque no estén en una plantilla. Un id desconocido sigue en `{ label: key, type: 'text' }`.
- [x] 2.2 Hacer que `resolveFieldDefinition` y `buildMissingFields` acepten `templateDoc` opcional junto a `clientRow` y `supplierRow`. Si el tipo es `dynamic_text`, agregar `instruccion`, `ejemplos` y `contexto`. Sin `templateDoc`, `contexto` es `null`. Los demás tipos no ganan esas propiedades.
- [x] 2.3 Calcular `contexto` con el recorrido de `tipTapDocToPlainTextAsync` sobre el primer nodo `paragraph` (orden en profundidad) que tenga un nodo `variable` con ese id. Esa variable se escribe `⟨…⟩`; las otras, `{{id}}`. Sin el `\n\n` entre bloques y con el espacio final del párrafo recortado. Si está en más de un párrafo, queda el primero. Un `heading` no cuenta. No modificar `tipTapPlainText.js`.
- [x] 2.4 En `generateAndPersist`, pasar `templateDoc: mergedDoc` a `buildMissingFields`.

## 3. Validación al generar

- [x] 3.1 En `generateAndPersist`, después del rechazo del precio y antes de `preprocessMissingFieldOverrides`: para cada override no vacío cuyo tipo sea `dynamic_text`, normalizar con `String(value).trim().replace(/\s+/g, ' ')`. Si el largo es mayor que 500, devolver `{ ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'El texto de «<label>» no puede superar los 500 caracteres.' }` con el `label` del catálogo. Vale con `dryRun` y sin él, y no persiste ni sube nada. 500 caracteres pasan. Un override ausente o `''` no se valida.
- [x] 3.2 El texto normalizado es el que sigue al preproceso, a la sustitución y a `contract_overrides`. El preproceso no lo reformatea. Comas y paréntesis se conservan.

## 4. MCP

- [x] 4.1 En la descripción de `validar_contrato` (`backend/mcpTools.mjs`), cambiar solo la lista a `type (text/date/select/number/dynamic_text)`. No editar las demás frases. Al final, agregar el párrafo: `Para type='dynamic_text' el campo trae instruccion, ejemplos y contexto. Muéstrale a la persona la instrucción, los ejemplos y el contexto, y pídele el texto literal. Está PROHIBIDO redactarlo, completarlo, corregirlo o inferirlo por cuenta propia, aunque la conversación lo sugiera. Si la persona pide ayuda, puedes proponer un texto, pero solo lo usas si la persona lo aprueba de forma explícita. El texto se pasa en missingFieldOverrides tal como quedó aprobado.` No tocar la descripción de `generar_contrato`.

## 5. Frontend

- [x] 5.1 En el grupo `contrato` de `frontend/src/data/variableCatalog.js`, agregar `servicios_entregables` y `cuentas_publicacion` con `type: 'dynamic_text'`, el mismo `id` y `label` del catálogo, y `description` igual a la `instruccion`. Las demás entradas no ganan `type`.
- [x] 5.2 En `VariableRenderer.jsx`, poner `data-kind="dynamic_text"` cuando el catálogo tenga ese `type`. En `styles.module.css`, después de las reglas de `data-group`, pintar ese chip con fondo `var(--color-form-field-readonly-bg)`, borde y texto `var(--color-selection)`, y en hover borde y texto `var(--color-main-headerbar)`. Sin hex nuevos.
- [x] 5.3 En `VariableCatalog.jsx`, mostrar la etiqueta `Texto dinámico` en esas entradas.
- [x] 5.4 Exportar `MissingFieldInput` sin cambiar select, date, number ni text. Para `dynamic_text`: `instruccion` arriba; `<textarea rows={3} className="clause-input" maxLength={500}>`; contador `N / 500` con el largo del valor del control; `Ejemplos:` y la lista, sin clic que copie; si `contexto` es string, vista previa que reemplaza `⟨…⟩` por lo escrito (span con `var(--color-selection)` y peso 600) o por `…` si está vacío. El resaltado va en `DocumentBuilderPage.css`.

## 6. Pruebas nuevas

Ningún archivo de prueba existente se modifica. Si una prueba que ya existía falla, no se ajusta: se consulta a la mesa. El andamiaje de `generateAndPersist` se copia; no se importa ni se edita el archivo de origen.

- [x] 6.1 Crear `backend/test/dynamicText.test.js`. Con un `dryRun` sin overrides y un párrafo cuya lectura plana es `En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}} en el perfil oficial {{client_product_campaign}}.`, y `servicios_entregables` como nodo `variable`, el campo faltante tiene `type: 'dynamic_text'`, la instrucción y los ejemplos del catálogo, y `contexto` `En concreto, los Servicios comprenden la generación y publicación de ⟨…⟩ en el perfil oficial {{client_product_campaign}}.`.
- [x] 6.2 En el mismo archivo: un valor con saltos de línea y espacios dobles queda normalizado en `contract_overrides`; 501 caracteres dan `VALIDATION_ERROR` con el mensaje `El texto de «Entregables (cláusula 2.3)» no puede superar los 500 caracteres.` y sin persistir; 500 pasan; el valor sustituido conserva comas y paréntesis (`cinco (5) reels en TikTok y cuatro (4) reels en Facebook`).
- [x] 6.3 Crear `backend/test/mcpDynamicText.test.js`: la descripción de `validar_contrato` incluye `dynamic_text` y la frase `PROHIBIDO redactarlo, completarlo, corregirlo o inferirlo por cuenta propia`.
- [x] 6.4 Crear `frontend/src/pages/DocumentBuilderPage.dynamicText.test.jsx`: `MissingFieldInput` con un campo `dynamic_text` muestra el textarea, la instrucción, los ejemplos y el contexto con `…`. Al escribir, la vista previa muestra lo escrito y el contador cambia. Al hacer clic en un ejemplo, el valor del textarea no cambia (escenario «An example is not inserted on click»).
- [x] 6.5 En `backend/test/dynamicText.test.js`, agregar:
  - `getDynamicTextDefinition('servicios_entregables')` y `getDynamicTextDefinition('cuentas_publicacion')` devuelven el `label`, la `instruccion` y los `ejemplos` exactos del catálogo; `getDynamicTextDefinition('evento_servicio')` (id desconocido) devuelve `undefined` (escenarios «Known id returns the catalog entry» y «Unknown id is undefined»).
  - `getVariableMeta('servicios_entregables')` y `getVariableMeta('cuentas_publicacion')`, llamados directamente sin que ninguna plantilla contenga el id, devuelven `type: 'dynamic_text'` con el `label` del catálogo (escenario «Dynamic text ids resolve before they appear in a template»).
  - `resolveFieldDefinition('cuentas_publicacion', {})`, sin `templateDoc`, devuelve `instruccion` y `ejemplos` del catálogo y `contexto: null` (escenario «Context is null without a template document»).
  - con el id en dos párrafos del documento, `contexto` es el texto plano solo del primero (escenario «A second paragraph is ignored»).
  - en un `dryRun` con `servicios_entregables` (`dynamic_text`) y `fecha_contrato` (`text`) faltantes, el campo de `fecha_contrato` NO incluye `instruccion`, `ejemplos` ni `contexto` (escenario «Missing fields include metadata»).
- [x] 6.6 Crear `frontend/src/data/variableCatalog.dynamicText.test.js`: el grupo `contrato` incluye `servicios_entregables` y `cuentas_publicacion` con su `label`, `type: 'dynamic_text'` y `description` igual a la `instruccion` del catálogo backend; `fecha_contrato` sigue sin `type` (escenarios «Entregables listed under contrato», «Cuentas de publicación listed under contrato» y «Existing contrato variables stay untyped»).
- [x] 6.7 Crear `frontend/src/components/RichTextEditor/styles.module.css.dynamicText.test.js` (mismo patrón de lectura de texto que `styles.module.css.test.js`): el CSS trae una regla para `[data-kind="dynamic_text"]` con fondo `var(--color-form-field-readonly-bg)`, borde y texto `var(--color-selection)`, y hover con borde y texto `var(--color-main-headerbar)` (parte de color del escenario «Editor chip is marked dynamic text»).
- [x] 6.8 Crear `frontend/src/components/RichTextEditor/VariableCatalog.dynamicText.test.jsx`: con el catálogo abierto (`isOpen=true`), la fila de `cuentas_publicacion` muestra la etiqueta `Texto dinámico` y su descripción es la `instruccion` del catálogo (escenario «Catalog modal labels the type»).

## 7. Verificación

- [x] 7.1 Correr `cd backend && env -u DATABASE_URL npm test`, `cd frontend && npm test` y `cd frontend && npm run lint`. Las tres en verde; el lint, con 0 errores. Sin migraciones y sin escribir en la base.
- [x] 7.2 Sin dependencias nuevas, sin endpoints nuevos y sin tocar `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`, `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`, `.agent-orchestrator/**`. Ninguna plantilla cambia.
