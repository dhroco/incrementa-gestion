## Why

En pre-prod la firma electrónica deja las dos líneas del contrato en blanco y anexa una hoja de texto. La usuaria pidió que la rúbrica quede **escrita sobre la línea**, como en la muestra de Acrobat Sign. Este change cubre solo la mitad de la empresa: incrustar la imagen registrada del representante legal al firmar. La firma remota de la contraparte queda fuera (change posterior, bloqueado por definición comercial).

## What Changes

- Nodo Tiptap `signatureBlock` que **envuelve** los párrafos de firma ya existentes (no los reemplaza). Atributos `party` (`company` | `supplier`) y `repIndex` (`1` | `2` | `null`).
- Render PDF: `View` con `wrap={false}`, ranura de imagen opcional sobre el primer hijo (alto fijo 38 pt, `objectFit: contain`, ancho máx. 160 pt, alineación heredada del primer hijo). Sin imagen, el View **no reserva altura**.
- Tabla `legal_rep_signature` (`company_id`, `rep_index` CHECK 1|2, `gcs_path`, `uploaded_by`, timestamps; único `(company_id, rep_index)`). API de subida/borrado y UI en ficha de empresa (patrón de avatar).
- `draft_document.content_snapshot` (jsonb, nullable): documento Tiptap **ya materializado** (variables sustituidas) con el que se generó el borrador. Se escribe al generar y se renueva en la ruta de sobreescritura.
- `signContract` re-renderiza desde el snapshot inyectando la imagen del representante; la hoja anexa se reescribe como **constancia** con hash del borrador y hash del cuerpo re-renderizado. El proveedor **no firma**: su bloque queda con la línea vacía.
- Columnas `document.draft_sha256` y `document.signed_sha256`.
- Migración del `content_json` de las 17 plantillas activas (respaldo previo; las que no calcen con el patrón se reportan y se migran a mano).
- **No entra:** Adobe / Acrobat Sign / firma remota, email o teléfono del proveedor, estados nuevos de `draft_document`, sellado PAdES, firma del proveedor.

**No es un cambio de contrato HTTP de firma** (`POST /api/contracts/:id/sign` sigue igual). **Sí cambia el PDF firmado:** deja de ser el borrador más una hoja; se re-renderiza (D1). Borradores anteriores a este change (sin snapshot) siguen la ruta actual.

## Capabilities

### New Capabilities

- `contract-signature-block`: Nodo Tiptap `signatureBlock`, su round-trip en el editor de plantillas, render PDF (imagen opcional, `wrap={false}`, I1/I4/I5/I6) y migración de las 17 plantillas activas.
- `legal-rep-signature`: Persistencia, validación y API/UI de la imagen de rúbrica del representante legal (GCS, autorización `update`/`Company`, nunca `gcs_path` al cliente).

### Modified Capabilities

- `contract-signing`: Al firmar, re-render desde `content_snapshot` con la imagen; degradación obligatoria (I2); constancia con ambos hashes y redacción que no atribuye firma al proveedor (I3); persistencia de `draft_sha256` / `signed_sha256`.
- `draft-document-gcs`: Columna `content_snapshot`; escritura al generar y al sobreescribir un borrador activo (el snapshot no puede quedar rancio).

## Impact

**Backend:** migraciones (`legal_rep_signature`, `draft_document.content_snapshot`, `document.draft_sha256`/`signed_sha256`); `documentBuilderTipTapReactPdf.js` (importar `Image`, nodo `signatureBlock`); `documentBuilderService.js` (persistir snapshot); `contractSigningService.js` (re-render + constancia); nuevo controlador/servicio de rúbrica; `companyController` (URLs firmadas en el detalle, sin `gcs_path`); `app.js` (rutas); tests de I1, I2, I4, I5 e I6.

**Frontend:** extensión Tiptap `signatureBlock` en el editor de plantillas (si no se registra, un guardado borra el wrap); ficha de empresa — subida/reemplazo/eliminación de PNG transparente; mensajes en es-CL.

**Datos:** 17 `template.content_json` migrados; respaldo en `template_content_backup` (crear la tabla si no existe). Las inactivas no se tocan.

**Dependencias:** `@react-pdf/renderer` ya está; `Image` no se usa hoy. Parser PNG (p. ej. `pngjs`) solo para validar magia, tamaño y canal alfa — el renderizador no accede a la red (I6).

**Desviación explícita de** `docs/firma-electronica-arquitectura.html` **§7.3:** ese diagrama estampa la rúbrica al **generar**. Este change estampa al **firmar** (D4). El §7.3 describe el destino de dos etapas; D4 es la decisión de seguridad de la etapa 1.

## Consideraciones de seguridad

La imagen reproduce la rúbrica de una persona real. No va al repositorio ni a PostgreSQL: solo a GCS en `firmas-representantes/{company_id}/{rep_index}/{uuid}.png`. El cliente **nunca** recibe `gcs_path`; solo una URL firmada V4 de corta duración, igual que los avatares.

**D4 es una decisión de seguridad, no de comodidad.** Un borrador con la rúbrica del representante es indistinguible de un contrato ejecutado, y los borradores circulan por correo. Por eso la imagen se inyecta solo en `signContract`, nunca en `generateAndPersist`.

Validación en backend (no basta con esconder el control en la UI):

- `authorize('update', 'Company')` en POST y DELETE de la rúbrica.
- PNG por **magic bytes** (`89 50 4E 47 0D 0A 1A 0A`), no por `Content-Type` declarado. Solo `image/png`. Máximo 500 KB.
- Canal alfa obligatorio (fondo transparente). Un PNG opaco con fondo blanco taparía la línea de firma. El mismo requisito se declara en la UI de subida.
- Mensajes de error en español (es-CL) vía `http/responses.js`.

La constancia nombra solo al usuario de la plataforma y a la empresa. Si se estampó imagen, declara que la rúbrica es una **imagen registrada por la empresa**, no un acto de e-firma del representante. Nunca insinúa que el proveedor firmó (I3). Firmar **nunca falla** por culpa de la rúbrica: snapshot nulo, GCS ilegible o empresa sin imagen degradan, loguean y siguen (I2), para no romper lo ya generado en pre-prod.
