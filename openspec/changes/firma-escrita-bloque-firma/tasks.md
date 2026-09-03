## 1. Schema y dependencias

- [x] 1.1 Migración knex: crear `template_content_backup` si no existe (`id` UUID PK, `template_id` FK → `template`, `content_json` jsonb NOT NULL, `note` text, `backed_up_at` timestamptz default now())
- [x] 1.2 Migración knex: tabla `legal_rep_signature` (`company_id`, `rep_index` CHECK 1|2, `gcs_path`, `uploaded_by`, timestamps, UNIQUE `(company_id, rep_index)`)
- [x] 1.3 Migración knex: `draft_document.content_snapshot` jsonb nullable
- [x] 1.4 Migración knex: `document.draft_sha256` y `document.signed_sha256` text nullable
- [x] 1.5 Agregar `pngjs` en backend (validación de PNG/alfa). Extractor de texto PDF solo como devDependency de tests (no en el renderer de producción)

## 2. Nodo y render PDF

- [x] 2.1 `documentBuilderTipTapReactPdf.js`: importar `Image`; manejar `signatureBlock`; `View` con `wrap={false}`; API `signatureImages`; ranura 38 pt / contain / máx. 160 pt / alineación del primer hijo; sin buffer no reservar altura; no I/O de red
- [x] 2.2 Test I1: párrafos sueltos vs wrap sin imagen → mismo texto extraído y mismo número de páginas
- [x] 2.3 Test I4: mismo snapshot + mismos buffers, dos renders → mismo texto y mismas páginas
- [x] 2.4 Test I5: bloque empujado al pie de página → primer y último hijo en la misma página
- [x] 2.5 Test I6: el módulo del renderer no importa GCS/`https`/`fetch`; el buffer llega inyectado

## 3. Snapshot al generar

- [x] 3.1 `generateAndPersist`: persistir `content_snapshot` = `resolvedDoc` post-sustitución; generate sigue renderizando **sin** imágenes de rúbrica; la respuesta HTTP no incluye el snapshot
- [x] 3.2 Ruta `overwrite: true`: el INSERT nuevo lleva el snapshot del render nuevo (nunca copiar el de la fila borrada)
- [x] 3.3 Tests de generate y overwrite con snapshot poblado y no rancio

## 4. Rúbrica del representante (API)

- [x] 4.1 Servicio + controlador: `POST` y `DELETE` `/api/companies/:id/legal-rep-signatures/:repIndex` con `authorize('update', 'Company')`; GCS `firmas-representantes/{company_id}/{rep_index}/{uuid}.png`; upsert; borrar objeto anterior best-effort
- [x] 4.2 Validación: ≤500 KB, magic bytes PNG (ignorar Content-Type), canal alfa vía `pngjs`; mensajes es-CL con `sendError`
- [x] 4.3 `GET /api/companies/:id`: `legal_rep_signatures: [{ rep_index, url }]` V4 60 min; **nunca** `gcs_path`
- [x] 4.4 Tests: PNG válido; JPEG con Content-Type png; PNG opaco; >500 KB; 403 sin `update`/`Company`; delete; detalle sin path

## 5. Firma: re-render y constancia

- [x] 5.1 Reescribir `appendSignaturePage` como constancia: título `CONSTANCIA DE FIRMA ELECTRÓNICA SIMPLE`; solo usuario de plataforma y empresa; ambos hashes; frase de imagen registrada vs no se pudo estampar / no se re-renderizó; **prohibido** insinuar que el proveedor o «las partes» firmaron
- [x] 5.2 `signContract`: snapshot → descargar PNGs (omitir y loguear fallos) → re-render → `signed_sha256` del cuerpo → anexar constancia; snapshot null o render que lanza → ruta legacy sobre el PDF original; persistir ambos hashes en `document`
- [x] 5.3 Test I2: snapshot null; empresa sin rúbrica; GCS de PNG caído → firma `ok` y constancia honesta
- [x] 5.4 Test I3: el texto de la última página no contiene «firmado por las partes» ni «el proveedor firmó»; con stamp contiene «imagen registrada»
- [x] 5.5 Test: con snapshot e imagen, el cuerpo lleva la rúbrica en el bloque company y la línea del supplier sigue vacía; el PDF del borrador en GCS no cambia

## 6. Frontend

- [x] 6.1 Extensión Tiptap `signatureBlock` registrada en `RichTextEditor` (round-trip de attrs y párrafos internos; sin UI de inserción)
- [x] 6.2 Test: cargar JSON con wrap, guardar sin editar, el wrap sigue ahí
- [x] 6.3 Ficha de empresa: preview, subir/reemplazar/eliminar por representante; copy «PNG con fondo transparente, máximo 500 KB»; `.btn` / `.btn` danger; controles de mutación solo con `can('update', 'Company')`; apilar bajo 900 px
- [x] 6.4 Verificar en navegador el flujo de subida/preview/borrado en ficha de empresa (edit y view)

## 7. Migración de las 17 plantillas

- [x] 7.1 Script idempotente: **antes de mutar**, INSERT en `template_content_backup` (`note = 'pre-firma-escrita-bloque-firma'`) de cada plantilla activa; no tocar inactivas PL0001–PL0004
- [x] 7.2 Detectar el patrón canónico (párrafo de guiones + párrafo con `company_legal_rep1_name` | `company_legal_rep2_name` | `proveedor_nombre` + `p.p.` opcional). Attrs: `company_legal_rep1_name` → company/1; `company_legal_rep2_name` → company/2; `proveedor_nombre` → supplier/null. Si ya es `signatureBlock`, no-op
- [x] 7.3 Las que no calzan (chilenas/mexicanas/persona natural/empresa con otra forma) se **reportan** (`code` + motivo) y **no se adivinan**. Entregar la lista de las que quedaron fuera para wrap manual
- [x] 7.4 Wrap manual de las reportadas en 7.3; segundo run del script sin duplicar wraps ni backups (`manualTemplateSignatureWraps.js`; agregar entradas según informe del dry-run)
- [ ] 7.5 Revisión visual de las 17 activas (PDF generado sin imagen = líneas como hoy; PDF firmado de prueba con PNG = rúbrica sobre la línea de la empresa, supplier vacío) **antes de dar esta sección por cerrada**

## 8. Cierre

- [x] 8.1 `npm test` backend y frontend en verde
- [x] 8.2 No implementar Adobe, email/teléfono de proveedor, estados `sent`/`viewed`/`expired`, PAdES, ni firma del proveedor
