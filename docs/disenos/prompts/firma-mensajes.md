# Recorte · firma-mensajes

> Encargo de Ignacio (arquitecto), 21-oct-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/firma-firme.md`. **Base: `preprod` con `firme-flujo-a` ya fusionado** (ese recorte
> agrega `meta.email_enabled` a `GET /api/contracts/pending-signature` y toca la misma pantalla).

## 1. Objetivo

David vio en pre-prod dos mensajes de la pantalla «Firma de documento» que no dicen la verdad. Su regla:

- **(a) «Contrato firmado» solo cuando el contrato ya está firmado por las dos partes**: por la empresa
  (la rúbrica de Yerko, que se estampa automáticamente al aprobar) **y** por el proveedor (la influencer).
  Mientras falte cualquiera de las dos, el mensaje dice **«Contrato en proceso de firma»**.
- **(b) «Email enviado» solo cuando de verdad se envió un correo.** Producción sale **sin Resend**: el
  backend ya omite el correo si falta `RESEND_API_KEY`, pero la pantalla dice «Email enviado a …» igual, y
  el modal promete el correo antes de firmar. La pantalla debe decir que se envió **solo** cuando se envió.

## 2. Backend

En `backend/services/contractSigningService.js`, `signContract` **suma un campo** a `data` en la respuesta
exitosa, sin cambiar nada más de su comportamiento:

- `emailSent`: `true` únicamente si `emailService.sendSignedContractEmail` **resolvió** y su resultado es
  `{ ok: true }` **sin** `skipped` (con `skipped: true`, con excepción o sin `company.email`, `false`).

`companyEmail`, `documentId` y `fileName` quedan como están.

## 3. Pantalla

`frontend/src/pages/ContractSigningPage.jsx`. Un solo criterio: **la palabra «firmado» se muestra solo si
las dos partes firmaron.**

**Mensaje tras la acción del botón (8 segundos, estilo de éxito del sistema de diseño):**

| Camino | Mensaje |
|---|---|
| Aprobar y enviar a firma (Firme, `signing_mode === 'firme'`) | «Contrato en proceso de firma.» |
| Firmar (camino interno, `signing_mode !== 'firme'`; en ese camino el proveedor firma fuera del sistema) | «Contrato en proceso de firma.», y si `emailSent` es `true`, se agrega « Email enviado a {correo}.» |

- «Email enviado» aparece **solo** si `emailSent` es `true`. Si la respuesta no trae `emailSent`, es `false`.
- **«Contrato firmado.»** aparece **únicamente** cuando el sistema detecta que Firme completó la firma:
  cuando «Actualizar estado» (o la carga de la pestaña «En firma») devuelve un intento que pasó a `signed`, se
  muestra «Contrato firmado.» durante 8 segundos y el contrato sale de la tabla «En firma». En ningún otro
  lugar de la pantalla aparece el texto «Contrato firmado» (ni en el modal, ni en botones, ni en errores).
- **Modal previo (camino interno).** Si `meta.email_enabled` es `true`, queda igual: la nota «…y se enviará
  al correo {correo}.» y el botón «Firmar y enviar email». Si es `false`, la nota termina en «…en
  representación de **{empresa}**.» (sin hablar de correo) y el botón dice **«Firmar»** (y «Firmando…»
  mientras espera). Si `meta` no viene, trátalo como `true`.
- **Modal de Firme.** Su texto y su botón («Aprobar y enviar a firma») no cambian.
- Otras pantallas: el chip «Firmado» de `ContractsListPage.jsx` ya solo corresponde a `signed`; no lo
  cambies. Si encuentras cualquier otro texto del frontend o de las respuestas del backend que diga
  «firmado» para un contrato aún sin firmar por las dos partes, **no lo corrijas por tu cuenta: consulta a la
  mesa.** (El correo «Contrato firmado — …» que se envía al completar la firma es correcto: no se toca.)

## 4. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`. No agregues
  variables de entorno ni dependencias.
- No toques `emailService.js`, el contenido del correo ni `signContract` más allá de `emailSent`.
- Mensajes en español. Ningún comando llama a servicios reales ni a la base de datos.
- Documentación y commits en español.

## 5. Pruebas existentes

Ninguna prueba existente cambia. **No modifiques ningún archivo de prueba existente.** Si cualquier
prueba existente falla, **no la ajustes: consulta a la mesa.**

## 6. Pruebas nuevas

**Todas en archivos nuevos.**

- `backend/test/contractSigningService.messages.test.js` (mismos dobles que las pruebas existentes de
  `signContract`): `emailSent` es `true` con correo enviado; `false` cuando el servicio devuelve
  `{ ok: true, skipped: true }`; `false` cuando lanza; `false` cuando la empresa no tiene correo;
  `companyEmail`, `documentId` y `fileName` no cambian.
- `frontend/src/pages/ContractSigningPage.messages.test.jsx`: el mensaje tras aprobar y enviar a Firme es
  «Contrato en proceso de firma.»; el del camino interno es el mismo, con y sin «Email enviado a …» según
  `emailSent`; sin `emailSent` en la respuesta no aparece «Email enviado»; **el texto «Contrato firmado.» no
  aparece tras ninguna de esas dos acciones**, y sí aparece cuando «Actualizar estado» devuelve un intento
  `signed`; modal con `email_enabled: true` y `false` (nota y botón); los mensajes desaparecen a los 8
  segundos (timers simulados).

## 7. Puntos de atención

- `ContractSigningPage.jsx` ya fue modificado por `firme-flujo-a` (pestañas, modal de Firme, mensaje de
  éxito): si ves contradicción entre esa pantalla y esta descripción, consulta a la mesa.
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test` y
  `cd frontend && npm run lint`. Todas en verde.
