# Recorte · firma-mensajes

> Encargo de Ignacio (arquitecto), 21-oct-2026. **Este texto es el prompt del propose: se usa tal
> cual.** Si algo de aquí no se puede cumplir, se consulta a la mesa; no se reinterpreta. Diseño:
> `docs/disenos/firma-firme.md`. **Base: `preprod` con `firme-flujo-a` ya fusionado** (ese recorte
> agrega `meta.email_enabled` a `GET /api/contracts/pending-signature` y toca la misma pantalla).

## 1. Objetivo

David vio en pre-prod dos mensajes de la pantalla «Firma de documento» que no dicen la verdad. Este
recorte los corrige en el **camino interno** de firma (el botón «Firmar», `signContract`), que sigue
vigente para los proveedores sin RUT chileno:

- **(a) «Contrato firmado» cuando no corresponde.** Hoy, al firmar, la pantalla muestra siempre «Contrato
  firmado…» por 8 segundos, aunque el sistema **no haya podido estampar la rúbrica** de la empresa
  (`signContract` cae a un respaldo y registra el contrato igual). El mensaje debe decir lo que pasó.
- **(b) «Email enviado» solo si de verdad se envió.** Producción sale **sin Resend**: el backend ya
  omite el correo si falta `RESEND_API_KEY`, pero la pantalla dice «Email enviado a …» igual, y el modal
  promete el correo antes de firmar. La pantalla debe decir que se envió **solo** cuando se envió.

## 2. Backend

En `backend/services/contractSigningService.js`, `signContract` **suma dos campos** a `data` en la
respuesta exitosa, sin cambiar nada más de su comportamiento:

- `stampInjected`: el valor que ya calcula (`true` solo si se estampó al menos una rúbrica).
- `emailSent`: `true` únicamente si `emailService.sendSignedContractEmail` **resolvió** y su resultado
  es `{ ok: true }` **sin** `skipped` (con `skipped: true`, con excepción o sin `company.email`,
  `false`).

`companyEmail` y `documentId`, `fileName` quedan como están.

## 3. Pantalla

`frontend/src/pages/ContractSigningPage.jsx`, solo el camino interno (`signing_mode !== 'firme'`; el modal
de Firme y la pestaña «En firma» no se tocan).

Mensaje de éxito al firmar, armado con la respuesta:

| `stampInjected` | `emailSent` | Mensaje |
|---|---|---|
| `true` | `true` | «Contrato firmado. Email enviado a {correo}.» |
| `true` | `false` | «Contrato firmado.» |
| `false` | `true` | «Contrato registrado, pero sin la rúbrica de la empresa (no se pudo estampar). Revise el PDF. Email enviado a {correo}.» |
| `false` | `false` | «Contrato registrado, pero sin la rúbrica de la empresa (no se pudo estampar). Revise el PDF.» |

- El mensaje con «sin la rúbrica» usa el estilo de **advertencia** del sistema de diseño (no el de éxito
  verde) y dura 8 segundos como hoy. Si la respuesta no trae `stampInjected` (backend antiguo), trátalo como
  `true`; si no trae `emailSent`, como `false`.
- **Modal previo a firmar.** Si `meta.email_enabled` es `true`, queda igual: la nota «…y se enviará al
  correo {correo}.» y el botón «Firmar y enviar email». Si es `false`, la nota termina en «…en
  representación de **{empresa}**.» (sin hablar de correo) y el botón dice **«Firmar»** (y «Firmando…» mientras
  espera). Si `meta` no viene, trátalo como `true`.
- Nada más cambia en la pantalla.

## 4. Restricciones

- **No toques** `openspec/config.yaml`, `CLAUDE.md`, `.cursor/rules/**`, `docs/**`, `backend/config.js`,
  `frontend/config.js`, `backend/knexfile.js`, `backend/db/knex.js`, `.github/**`, `infra/**`. No agregues
  variables de entorno ni dependencias.
- No toques `emailService.js`, el contenido del correo ni `signContract` más allá de los dos campos.
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
  `stampInjected` refleja si hubo rúbrica; `companyEmail`, `documentId` y `fileName` no cambian.
- `frontend/src/pages/ContractSigningPage.messages.test.jsx`: las cuatro filas de la tabla de la sección
  3 (texto exacto y estilo advertencia/éxito); sin los campos nuevos en la respuesta; modal con
  `email_enabled: true` y `false` (nota y botón); el mensaje desaparece a los 8 segundos (timers
  simulados).

## 7. Puntos de atención

- `ContractSigningPage.jsx` ya fue modificado por `firme-flujo-a` (pestañas, modal de Firme): si ves
  contradicción entre esa pantalla y esta descripción, consulta a la mesa.
- La interpretación de (a) la confirma David antes de lanzar; si ves en el código que «Contrato firmado»
  se puede mostrar en otro caso incorrecto, **no lo arregles por tu cuenta: consulta a la mesa.**
- Pruebas del perfil: `cd backend && env -u DATABASE_URL npm test` y `cd frontend && npm test` y
  `cd frontend && npm run lint`. Todas en verde.
