# Dominio · firma electrónica con Firme.cl

> Diseño de Ignacio (arquitecto), 28-sep-2026. Decisiones de producto de David, mismo día.

## Qué es

Cómo un contrato generado en incrementa llega a firmarse con firma electrónica simple (FES) en
Firme.cl, y cómo el sistema recoge el PDF firmado y la evidencia. Antecedentes:
`docs/propuesta-firma-electronica.html` y `docs/pauta-reunion-firme.html`.

Hoy la firma es interna: `POST /api/contracts/:id/sign` (`services/contractSigningService.js`)
vuelve a generar el PDF con la rúbrica guardada del representante (`legal_rep_signature`, en GCS),
le agrega una página de firma con los hashes del borrador y del firmado, y lo envía por correo. La
influencer firma fuera del sistema.

## Lo que se probó (28-sep, staging de Firme, script fuera del producto)

Flujo completo `SIMPLE` con dos firmantes, de punta a punta en 13 minutos:

`POST /transactions` → `POST /documents` (devuelve `uploadUrl` de S3) → `PUT` del PDF a S3 →
`PUT /documents/{code}/upload` → `PUT /documents/{code}` (categoría `CONTRATOS`, subcategoría
`Contrato de Prestación de Servicios`, `procedureType: SIMPLE`) → por firmante
`POST /documents/{code}/signees` + `POST /documents/{code}/signatures` (página base 0, `x`/`y` en
fracción de la página) → `POST /transactions/{id}/complete` con `paymentMethod: CREDITS`.

Después: `GET /documents/{code}` (estado `PENDING_SIGNATURE` → `SIGNED`, `signedOn` por
firmante), `GET /documents/{code}/logs`, `GET /documents/{code}/signees/{privateCode}/emails/events`,
`GET /documents/{code}/signees/{privateCode}/emails/{hub_email_id}/certificate` (certificado de
correo en PDF) y `GET /documents/{code}/files/SIGNED_DOCUMENT` (URL firmada, dura ~1 h).

Autenticación: `Authorization: Bearer <token de desarrollador>`. La especificación OpenAPI está en
`{FIRME_API_URL}/openapi.json`.

Hallazgos que condicionan el diseño:
- **La firma es secuencial**, en el orden en que se crean los firmantes.
- **El timbre** se ubica con (`x`, `y`) = esquina superior izquierda, y mide cerca de un tercio del
  ancho y un octavo del alto de la página. Trae nombre, correo, fecha y QR, pero no el RUT. La
  plantilla tiene que reservarle una caja libre.
- Hoy Firme exige RUT chileno y apellido materno.
- Cada firmante consume un crédito `SIMPLE`. Sin saldo, `complete` responde 422.
- La firma con imagen guardada (`bulk-sign`) existe, pero solo para el trámite `CERTIFY`.

## Decisiones

- **Yerko firma siempre primero** (David, 28-sep).
- **Pendiente, de Yerko y Marcela:** si Yerko aprueba en incrementa y Firme se usa solo para la
  influencer (opción A), o si los dos firman en Firme (opción B). Mientras no se decida, solo se
  construye lo que sirve a las dos.
- Extranjeros sin RUT siguen firmando fuera del sistema hasta que Firme los soporte (decisión A del
  28-sep, `incrementa-firma-firme`).

## Recortes

En `firma-firme.recortes.yaml`. El primero, `firme-cliente`, es el cliente HTTP de la API: sirve
igual con uno o con dos firmantes. Los que dependen de la decisión (estado del contrato, cuándo se
envía, cómo se recoge la firma, dónde se guarda la evidencia, interfaz) se diseñan cuando llegue la
respuesta.

## Qué queda fuera, por ahora

- El modelo de datos del envío a Firme y el estado del contrato.
- Webhooks (Firme los ofrece vía AWS SNS) o sondeo periódico.
- Guardar en GCS el PDF firmado y la evidencia.
- La caja reservada para el timbre en las plantillas.
- Los secretos de Firme en Cloud Run (Secret Manager y workflows).
