## Context

Hoy `contractSigningService.appendSignaturePage` descarga el PDF del borrador y le anexa una hoja de texto con pdf-lib. Las líneas de firma del contrato quedan vacías. `documentBuilderTipTapReactPdf.js` no importa `Image` de `@react-pdf/renderer`. En las 17 plantillas activas el bloque de firma son párrafos sueltos (guiones bajos + `{{company_legal_rep1_name}}` / `{{proveedor_nombre}}` + `p.p. …`). `company` ya tiene `name_legal_representative_1` y `_2` (y sus RUT). `draft_document` no guarda el Tiptap con el que se renderizó el PDF.

La usuaria de pre-prod pidió que «la firma quede escrita», con una muestra de Acrobat Sign. El análisis está en `docs/firma-electronica-arquitectura.html` (caps. 1, 4, 5, 9). Lo pedido tiene dos mitades; este change es solo la de la **empresa** (imagen registrada). La de la contraparte es un change posterior.

Este diseño **no reabre** D1–D4 del brief. El diagrama de `docs/firma-electronica-arquitectura.html` §7.3 estampa al generar; D4 lo corrige: se estampa al firmar.

## Goals / Non-Goals

**Goals:**

- Que al firmar, la rúbrica de la empresa aparezca sobre la línea del representante en el cuerpo del contrato.
- Que un borrador sin rúbrica no se confunda con un contrato ejecutado (D4).
- Que re-renderizar no firme un texto distinto del revisado (`content_snapshot`, D2).
- Que firmar no se rompa por rúbrica ausente, snapshot nulo o GCS caído (I2).
- Que la constancia no atribuya firma al proveedor (I3).
- Migrar las 17 plantillas activas envolviendo párrafos, sin reescribir su texto (D3).

**Non-Goals:**

- Adobe / Acrobat Sign / portal de firma remota.
- Email o teléfono del proveedor.
- Estados `sent` / `viewed` / `expired` (ni `partially_signed`).
- Sellado criptográfico (PAdES) ni `change:no`.
- Que el proveedor firme: su `signatureBlock` queda con la línea vacía.
- Estampar por coordenadas (pdf-lib) o cazar la línea con pdfjs-dist en producción.

## Decisions

### D1 — Re-renderizar, no estampar por coordenadas (cerrada)

Al firmar, si hay `content_snapshot`, el servicio vuelve a llamar `buildPdfBytesFromTipTapWithReactPdf` con el snapshot y un mapa de buffers de imagen. El renderizador ya maquetó el bloque; no hay que adivinar página ni (x, y).

**Descartado:** `pdf-lib` + coordenadas (el bloque se mueve con el largo del contrato). **Descartado:** pdfjs-dist en el pipeline de firma (dependencia pesada, dos motores). El mismo pipeline servirá a la firma remota después.

**Consecuencia:** el PDF firmado no es byte a byte el borrador. La constancia declara ambos hashes (ver D-hashes).

### D2 — `draft_document.content_snapshot` jsonb nullable (cerrada)

Al generar, **después** de `applySubstitutionsToTipTapDoc` y **antes** de renderizar, se persiste el doc Tiptap materializado (variables ya sustituidas). El snapshot es autosuficiente: firmar no re-resuelve proveedor, empresa ni overrides.

La ruta de overwrite borra el `draft_document` activo y inserta uno nuevo; el INSERT nuevo **debe** llevar el snapshot de **ese** render. Queda prohibido persistir un PDF nuevo sin snapshot de ese mismo doc.

Borradores ya existentes quedan con `content_snapshot` NULL → ruta legacy (I2).

El snapshot no se devuelve en la respuesta de generate (sigue `id`, `file_name`, `gcs_path`, `status`).

### D3 — El nodo envuelve, no reemplaza (cerrada)

Nodo Tiptap `signatureBlock`:

| Attr | Valores | Default |
|------|---------|---------|
| `party` | `"company"` \| `"supplier"` | obligatorio |
| `repIndex` | `1` \| `2` \| `null` | `null` |

`content`: los mismos `paragraph` (y solo párrafos) que ya existían. No hay attrs `name`/`subtitle`. La sustitución de variables no cambia: sigue recorriendo nodos `variable` en el interior.

Asignación en la migración de plantillas:

- El wrap que contiene `company_legal_rep1_name` → `party: "company"`, `repIndex: 1`.
- El que contiene `company_legal_rep2_name` → `party: "company"`, `repIndex: 2`.
- El que contiene `proveedor_nombre` → `party: "supplier"`, `repIndex: null`.

**Editor:** registrar `SignatureBlock` en `frontend/src/components/RichTextEditor/index.jsx`. Si no, un guardado del editor **borra** el wrap (Tiptap descarta nodos desconocidos). No hace falta UI para insertar bloques: la migración los crea; el editor solo debe round-trippearlos (NodeView mínimo o `atom: false` con content `"block+"`). `TextAlign` no necesita extenderse al wrap: la alineación vive en el primer párrafo hijo.

### D4 — Estampar al firmar, no al generar (cerrada, seguridad)

`generateAndPersist` renderiza **sin** buffers de imagen. `signContract` es el único que pasa buffers. Un borrador con rúbrica es indistinguible de un contrato ejecutado y los borradores se envían por correo.

Esto **desvía** el diagrama §7.3 del doc de arquitectura, a propósito.

### D-render — Ranura de imagen, no nodo Image en Tiptap

La imagen no entra al JSON Tiptap. El renderer, si recibe un buffer para `party`+`repIndex` de ese wrap, dibuja un `Image` **encima del primer hijo** (mismo eje de alineación que `blockAlign` del primer párrafo):

- Alto fijo **38 pt** (se reserva solo si hay buffer).
- `objectFit: 'contain'`.
- Ancho máximo **160 pt**.
- Sin buffer: no se monta `Image` y el `View` **no reserva esos 38 pt** (I1).

El wrap es un `View` con `wrap={false}` (I5). Los hijos se renderizan con el mismo `renderBlock` de siempre.

Firma de la API de render:

```js
buildPdfBytesFromTipTapWithReactPdf(doc, { signatureImages } = {})
```

`signatureImages`: mapa `{ 'company:1': Buffer, 'company:2': Buffer, 'supplier': Buffer }`. El renderer **no** llama a GCS ni a `fetch` (I6). Quien firma descarga antes y pasa buffers.

### D-hashes — Qué se hashea y qué se imprime

Chicken-and-egg: no se puede imprimir en la constancia el hash de un PDF que **incluye** esa constancia.

| Campo | Valor |
|-------|--------|
| `document.draft_sha256` | SHA-256 hex del PDF en `draft.gcs_path` (lo revisado). |
| `document.signed_sha256` | SHA-256 hex del **cuerpo** re-renderizado **antes** de anexar la constancia. Si no hubo re-render (legacy), igual a `draft_sha256`. |

La constancia imprime exactamente esos dos valores. El objeto GCS `contratos-firmados/...` es cuerpo + constancia; su hash de archivo no se guarda (se puede recalcular desde GCS).

### D-sign-flow — Orquestación de `signContract`

1. Cargar draft, firmante, company, template (igual que hoy). Fallar igual si no hay PDF en GCS.
2. `draft_sha256` = SHA-256 del buffer del borrador.
3. **Rama snapshot presente:**
   - Intentar cargar `legal_rep_signature` de la empresa (`rep_index` que aparezcan en el snapshot). Descargar cada PNG. Cualquier fallo (fila ausente, GCS) → log, buffer omitido, **seguir**.
   - Re-render del snapshot con los buffers que sí se obtuvieron. Si `renderToBuffer` lanza → log, **no abortar la firma**: caer a la rama legacy sobre el PDF original.
   - `signed_sha256` = SHA-256 del cuerpo re-renderizado.
   - Anexar constancia (con ambos hashes y si se estampó o no).
4. **Rama snapshot null (o re-render falló):** no re-render. `signed_sha256 = draft_sha256`. Anexar constancia declarando que no se pudo estampar ni re-renderizar.
5. Subir, INSERT `document` (incluir ambos hashes), UPDATE draft `signed`, email (igual: email fallido no revierte).

Firmar **nunca** devuelve 5xx porque falte rúbrica, snapshot o un PNG (I2). Sigue pudiendo fallar por draft inexistente, ya firmado, o GCS del **PDF del borrador**.

### D-constancia — Redacción (I3)

Título: `CONSTANCIA DE FIRMA ELECTRÓNICA SIMPLE`. Subtítulo de ley igual que hoy.

Debe nombrar **solo** al usuario de la plataforma (`user_profile.full_name`) y a la empresa (`business_name`, RUT formateado, `short_name` opcional). Fecha/hora en `America/Santiago`, locale `es-CL`.

Prohibido: «firmado por las partes», «ambas partes», «el proveedor firmó», «las firmas de».

Si se estampó al menos un PNG: una frase del tipo *«La rúbrica reproducida sobre la línea del representante de la empresa es una imagen registrada por la empresa en el sistema. No constituye un evento de firma electrónica del representante legal.»*

Si no se estampó: *«No se pudo reproducir una rúbrica registrada de la empresa en el cuerpo del contrato.»* Si además no hubo re-render: *«El cuerpo del documento no fue re-renderizado.»*

Cerrar con los dos hashes etiquetados: «Hash SHA-256 del borrador revisado» y «Hash SHA-256 del contrato re-renderizado (cuerpo, sin esta constancia)». En rama legacy, el segundo es igual al primero y se aclara que no hubo re-render.

### D-table — `legal_rep_signature`

```
id              uuid PK default gen_random_uuid()
company_id      uuid NOT NULL FK company ON DELETE CASCADE
rep_index       smallint NOT NULL CHECK (rep_index IN (1, 2))
gcs_path        text NOT NULL
uploaded_by     uuid NULL FK user_profile ON DELETE SET NULL
created_at      timestamptz NOT NULL default now()
updated_at      timestamptz NOT NULL default now()
UNIQUE (company_id, rep_index)
```

Sin `full_name`: el nombre vive en `company.name_legal_representative_*`. El ER del cap. 9 del doc de arquitectura no aplica.

GCS: `firmas-representantes/{company_id}/{rep_index}/{uuid}.png`.

### D-api — Subida y borrado

Patrón de `meController.postAvatar` (multer memoryStorage) **más estricto**:

- `POST /api/companies/:id/legal-rep-signatures/:repIndex` — multipart campo `signature`.
- `DELETE /api/companies/:id/legal-rep-signatures/:repIndex`.
- Ambos: `authorize('update', 'Company')` **en backend**. `repIndex` ∈ {1,2} o 400.

Validación del buffer, en este orden:

1. Tamaño ≤ 500 KB.
2. Magic bytes PNG: `89 50 4E 47 0D 0A 1A 0A`. Ignorar `Content-Type` declarado.
3. Decodificar con `pngjs` (dependencia nueva, solo validación): debe existir canal alfa (color type 4 o 6, o type 3/0/2 con `tRNS`). Rechazar PNG opaco. No se exige que *todos* los píxeles sean transparentes; se exige que el formato *pueda* no tapar la línea.
4. Mensajes es-CL vía `sendError` (`VALIDATION_ERROR`, 400). Ejemplos: «El archivo debe ser un PNG.», «La imagen no puede superar 500 KB.», «El PNG debe tener fondo transparente.»

Reemplazo: subir el nuevo objeto, UPDATE `gcs_path`, borrar el anterior (best-effort, como el avatar).

`GET /api/companies/:id` (ya `authorize('read', 'Company')`) agrega `legal_rep_signatures: [{ rep_index, url }]` con URL V4, **sin** `gcs_path`. TTL **60 minutos** (más corto que el avatar de 24 h: la rúbrica es más sensible). Si no hay fila, se omite ese índice.

### D-ui — Ficha de empresa

En `CompaniesEditForm` / `CompaniesViewPage`, junto a cada representante: vista previa de la URL firmada, input file, botón `.btn` «Subir firma» / «Reemplazar», `.btn` danger «Eliminar». Texto de ayuda: «PNG con fondo transparente, máximo 500 KB.» Controles de mutación solo si `can('update', 'Company')`; la vista previa también en solo lectura. Responsive: apilar bajo 900 px. Sin sombras, sin botones de color sólido.

### D-migration-templates

1. Migración knex: crear `template_content_backup` **si no existe** (`id`, `template_id` FK, `content_json` jsonb NOT NULL, `note` text, `backed_up_at` timestamptz default now()). Hoy no está en `backend/migrations/` aunque se usó a mano.
2. Script idempotente (se puede invocar desde un seed/script, no reescribir a ciegas):
   - Seleccionar plantillas **activas** (las 17; no tocar PL0001–PL0004 inactivas, mismo criterio que `formato-reel-clausula-2-3`).
   - INSERT backup con `note = 'pre-firma-escrita-bloque-firma'` si aún no hay backup con esa note para esa plantilla.
   - Recorrer `content` de nivel `doc`: detectar **grupos consecutivos** de párrafos que formen un bloque de firma.
   - **Patrón canónico:** (a) un párrafo cuyo texto extraído es solo guiones bajos / espacios / `_`; (b) el siguiente contiene nodo `variable` `company_legal_rep1_name` | `company_legal_rep2_name` | `proveedor_nombre` (o el placeholder `{{…}}` en texto); (c) opcionalmente un párrafo siguiente que empieza por `p.p.` (con o sin variable de empresa).
   - Envolver (a)+(b)+[c] en `signatureBlock` con attrs según la variable de (b). Si el grupo ya es un `signatureBlock`, no-op.
   - **No adivinar** grupos que no calzan (p. ej. una sola línea, nombre sin raya, raya sin variable, variables distintas, bloques mexicanos/persona natural con otra forma). **Reportar** `template.code` + motivo y dejar el `content_json` intacto. Esas se migran a mano; el informe es entregable de la tarea.
3. Revisión visual de las 17 (las migradas por script y las manuales) antes de cerrar.

### D-tests

Extractor de texto **solo en tests** (p. ej. `pdf-parse` o pdfjs como devDependency). Producción no lo usa.

- **I1:** mismo fixture de párrafos sueltos vs envueltos en `signatureBlock` sin `signatureImages` → mismo texto extraído, mismo `PDFDocument.load().getPageCount()`, y el wrap no añade página ni líneas vacías medibles.
- **I4:** mismo snapshot + mismos buffers, dos `buildPdfBytesFromTipTapWithReactPdf` → mismo texto y mismo número de páginas (no se exige igualdad binaria).
- **I5:** fixture que empuja el bloque al pie (párrafos de relleno hasta que el wrap caería partido) → el texto del primer y del último hijo del bloque salen en la **misma** página.
- **I6:** el módulo del renderer no importa `gcsService` ni `https`; el test de firma pasa un buffer y mockea GCS **fuera** del renderer.
- **I2:** tres casos de `signContract`: snapshot null; GCS de rúbrica lanza; empresa sin fila → `ok: true`, constancia con la frase de no estampado.
- **I3:** el texto extraído de la última página no contiene «partes», «proveedor firm», ni equivalentes; si hubo stamp, contiene «imagen registrada».
- PNG: magic bytes, >500 KB, JPEG con Content-Type png, PNG sin alfa → 400.

## Risks / Trade-offs

- **[I1 vs I5]** `wrap={false}` puede **aumentar** el número de páginas si un bloque que hoy se parte al pie salta entero. I1 se prueba con un fixture que no está al corte. I5 cubre el corte a propósito. Tras migrar plantillas, un contrato recién generado puede tener una página más que el mismo texto sin wrap. Mitigación: revisión visual de las 17; I1 no promete igualdad con PDFs **ya** generados en GCS (esos no se reescriben).
- **[Plantillas heterogéneas]** Chilenas, mexicanas, persona natural y empresa. Mitigación: script que reporta y no adivina; migración manual de las que queden fuera; el informe lista códigos.
- **[PNG blanco opaco]** Taparía la raya. Mitigación: exigir canal alfa + copy en la UI. No se inspecciona píxel a píxel un fondo blanco en un PNG *con* alfa (un usuario puede subir blanco opaco en RGBA). Aceptable; la UI lo dice.
- **[Re-render ≠ bytes del borrador]** Operadores que comparen archivos lo notarán. Mitigación: constancia con ambos hashes, texto explícito.
- **[Editor sin extensión]** Un save destruye el wrap. Mitigación: registrar el nodo en el mismo change; test de round-trip JSON.
- **[Borradores pre-change]** Sin snapshot no hay stamp. Mitigación: I2, ruta legacy, constancia honesta. No backfill de snapshots (haría falta re-resolver plantilla actual → viola D2).
- **[Firmar no falla por rúbrica]** Se puede «firmar» un contrato sin imagen si nadie la subió. Mitigación: es el comportamiento pedido (I2); la constancia lo declara. La UI de empresa debe hacer obvia la subida.

## Migration Plan

1. Migraciones knex (schema): `template_content_backup` si falta; `legal_rep_signature`; `draft_document.content_snapshot`; `document.draft_sha256` / `signed_sha256` (text nullable).
2. Deploy de código (renderer, generate, sign, API, UI). Orden: schema → backend → frontend. Compatible hacia atrás: generate sin snapshot en filas viejas; sign con I2.
3. Script de wrap de plantillas **después** de que el renderer y el editor entiendan el nodo (si se envuelve antes, el editor viejo las pisa).
4. Subida de PNG de representantes en pre-prod (dato, no código).
5. Revisión visual de las 17.
6. Rollback schema: columnas nuevas nullable / tabla nueva se pueden dejar; el script de plantillas se revierte desde `template_content_backup` (`note = 'pre-firma-escrita-bloque-firma'`). No reescribir PDFs ya firmados.

## Open Questions

Ninguna que bloquee implementación. Las D1–D4 están cerradas. Residual, no bloqueante: TTL de la URL firmada queda en 60 min; se puede alinear a 15 o 1440 sin cambiar el resto.
