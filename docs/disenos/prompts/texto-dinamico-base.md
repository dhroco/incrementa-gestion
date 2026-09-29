# Recorte · texto-dinamico-base

> Encargo de Ignacio (arquitecto), 29-sep-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/texto-dinamico.md`.

## 1. Objetivo

Las cláusulas del objeto del contrato (2.3 y 2.5) necesitan un texto que no cabe en variables fijas:
«cinco (5) reels en TikTok y cuatro (4) reels en Facebook». Por eso existirá un tipo nuevo de
variable, el **texto dinámico** (`dynamic_text`). Lo redacta quien completa el contrato, en el
momento de crearlo, y queda incrustado en la cláusula.

Este recorte construye **solo el mecanismo** y define los dos primeros textos. Al terminar:
- el catálogo del backend tiene el tipo `dynamic_text`, con instrucción y ejemplos para cada texto;
- el Constructor lo pide en un **área de texto** que muestra la instrucción, los ejemplos y la
  cláusula de la plantilla con el hueco resaltado, y una vista previa en vivo;
- el editor de plantillas lo muestra con un color propio para distinguirlo;
- el MCP lo entrega con su instrucción, y las reglas le **prohíben** al agente redactarlo por su
  cuenta.

**Ninguna plantilla cambia en este recorte**, así que ningún contrato cambia.

## 2. Arquitectura

### Backend

- **Catálogo nuevo** `backend/services/dynamicTextCatalog.js`, que exporta
  `DYNAMIC_TEXT_CATALOG` (objeto por id) y `getDynamicTextDefinition(id)`. Cada entrada tiene
  `{ label, instruccion, ejemplos: string[] }`. Contenido exacto en la sección 3.
- **`VARIABLE_META`** (`documentBuilderService.js`): una entrada por cada id del catálogo, con
  `type: 'dynamic_text'` y `source: 'contract'`, y el `label` tomado del catálogo nuevo (no se
  duplica el texto).
- **`resolveFieldDefinition`**: cuando el `type` es `dynamic_text`, agrega al campo `instruccion`,
  `ejemplos` y `contexto`. `contexto` es el texto plano del **párrafo de la plantilla** que contiene
  la variable. En ese texto la propia variable aparece como `⟨…⟩` y las demás quedan como
  `{{id}}`. Si la variable aparece en más de un párrafo, se toma el primero. Para calcularlo,
  `buildMissingFields` y `resolveFieldDefinition` aceptan una opción nueva y opcional, `templateDoc`
  (el documento materializado que `generateAndPersist` ya tiene), junto a `clientRow` y `supplierRow`.
  Sin `templateDoc`, `contexto` es `null`.
- **Validación en `generateAndPersist`**, antes de preprocesar y en el mismo lugar que la del precio:
  para cada override cuyo id sea `dynamic_text` y tenga valor:
  - se recortan los extremos y se colapsa todo espacio en blanco interno (incluidos los saltos de
    línea) a un espacio;
  - si después de eso el texto tiene **más de 500 caracteres**, se devuelve
    `{ ok: false, status: 400, code: 'VALIDATION_ERROR', message }` con el mensaje
    «El texto de «<label>» no puede superar los 500 caracteres.».
  - El valor normalizado es el que sigue, se sustituye en el documento y se guarda en
    `contract_overrides`.
- Nada más cambia en la sustitución: el texto dinámico se reemplaza como cualquier variable.

### Frontend

- **`frontend/src/data/variableCatalog.js`**: en el grupo `contrato`, dos entradas nuevas con
  `type: 'dynamic_text'` (las demás no tienen `type` y siguen igual). Sus `id` y `label` coinciden
  con el catálogo del backend, y su `description` es la `instruccion`.
- **Editor de plantillas**: `VariableRenderer.jsx` agrega `data-kind="dynamic_text"` al chip cuando
  la entrada del catálogo tiene ese `type`, y `styles.module.css` le da un color propio del sistema
  de diseño de `openspec/config.yaml` (no inventes colores). En el modal `VariableCatalog.jsx`,
  esas entradas llevan una etiqueta «Texto dinámico».
- **Constructor** (`MissingFieldInput` en `DocumentBuilderPage.jsx`): una rama nueva para
  `field.type === 'dynamic_text'`, con:
  - un `<textarea>` de 3 filas, con la clase de los inputs actuales y `maxLength={500}`, y un
    contador «N / 500»;
  - la `instruccion` encima, y los `ejemplos` debajo como lista, precedidos de «Ejemplos:»;
  - el `contexto` como vista previa: el párrafo con `⟨…⟩` reemplazado por lo que se va escribiendo,
    resaltado, o por «…» si el campo está vacío.

  Los ejemplos se muestran pero **no se insertan con un clic**, para no invitar a copiarlos sin
  adaptarlos.

### MCP

- En la descripción de `validar_contrato` (`backend/mcpTools.mjs`), **agrega al final** (no edites
  las frases existentes) un párrafo con las reglas para `dynamic_text`:
  - el campo trae `instruccion`, `ejemplos` y `contexto`;
  - el agente le muestra a la persona la instrucción, los ejemplos y el contexto, y le pide el texto
    **literal**;
  - **está PROHIBIDO redactarlo, completarlo, corregirlo o inferirlo por cuenta propia**, aunque la
    conversación lo sugiera;
  - si la persona le pide ayuda, el agente puede proponer un texto, pero solo lo usa si la persona lo
    aprueba de forma explícita;
  - el texto se pasa en `missingFieldOverrides` tal como quedó aprobado.
- La lista de tipos de esa descripción (`type (text/date/select/number)`) pasa a incluir
  `dynamic_text`.

## 3. Catálogo inicial (contenido exacto)

| id | label | instruccion | ejemplos |
|---|---|---|---|
| `servicios_entregables` | `Entregables (cláusula 2.3)` | `Escribe qué publicará el influencer: cantidad en palabras y en cifra, formato y red social de cada entregable.` | `un (1) reel en Instagram` · `cinco (5) reels en TikTok y cuatro (4) reels en Facebook` · `dos (2) stories y un (1) reel en Instagram` |
| `cuentas_publicacion` | `Cuentas de publicación (cláusula 2.5)` | `Escribe la cuenta del influencer en cada red social nombrada en los entregables.` | `su cuenta de Instagram @danarebolledo` · `su cuenta de TikTok @danarebolledo y su cuenta de Facebook Dana Rebolledo` |

## 4. Recomendaciones

- Calcula `contexto` con el mismo recorrido que ya usa `tipTapDocToPlainTextAsync`, pero sobre un
  solo párrafo.
- Mantén `dynamicTextCatalog.js` como la única fuente del texto de instrucción y ejemplos en el
  backend. El frontend los recibe en el campo faltante, salvo el `label` y la `description` del
  editor.

## 5. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`,
  `.agent-orchestrator/**`.
- **Sin migraciones**: ninguna plantilla ni tabla cambia. Nada que se conecte a la base.
- Sin dependencias nuevas.
- Mensajes, textos de interfaz, documentación y commits en español.

## 6. Pruebas existentes

Ninguna prueba existente cambia. **No modifiques ningún archivo de prueba existente.** Ten en cuenta:
- `backend/test/mcpServer.test.js` busca frases exactas en la descripción de `validar_contrato` y de
  `generar_contrato`, así que no edites las frases existentes: solo agrega.
- `documentBuilderService.dryRun.test.js` y `documentBuilderApi.test.js` comparan campos faltantes
  con `deepEqual`, así que los campos de los tipos actuales no pueden ganar propiedades nuevas.

Si cualquier prueba existente falla, **no la ajustes: consulta a la mesa.**

## 7. Pruebas nuevas

**Todas en archivos nuevos**:
- **`backend/test/dynamicText.test.js`:**
  - con una plantilla mock cuyo párrafo es
    `En concreto, los Servicios comprenden la generación y publicación de {{servicios_entregables}} en el perfil oficial {{client_product_campaign}}.`
    y un `dryRun` sin overrides, el campo faltante tiene `type: 'dynamic_text'`, la `instruccion` y
    los `ejemplos` exactos de la sección 3, y
    `contexto: 'En concreto, los Servicios comprenden la generación y publicación de ⟨…⟩ en el perfil oficial {{client_product_campaign}}.'`;
  - un valor con saltos de línea y espacios dobles se guarda en `contract_overrides` normalizado;
  - 501 caracteres dan `VALIDATION_ERROR` con el mensaje exacto; 500 pasan;
  - el valor aparece tal cual en el documento sustituido, con comas y paréntesis.
- **`backend/test/mcpDynamicText.test.js`:** la descripción de `validar_contrato` incluye
  `dynamic_text` y la frase `PROHIBIDO redactarlo, completarlo, corregirlo o inferirlo por cuenta propia`.
- **`frontend/src/pages/DocumentBuilderPage.dynamicText.test.jsx`:** `MissingFieldInput` con un
  campo `dynamic_text` muestra el textarea, la instrucción, los ejemplos y el contexto con «…».
  Al escribir, la vista previa muestra lo escrito y el contador cambia. Si `MissingFieldInput` no
  está exportado, expórtalo sin cambiar su comportamiento.

## 8. Puntos de atención

- `getVariableMeta` devuelve `type: 'text'` para ids desconocidos. Los ids del catálogo nuevo tienen
  que resolverse como `dynamic_text` aunque aún no estén en ninguna plantilla.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test`, `cd frontend && npm test` y
  `cd frontend && npm run lint`. Las tres en verde; el lint, con 0 errores.
