# firme-client Specification

## Purpose
TBD - created by archiving change firme-cliente. Update Purpose after archive.

## Requirements
### Requirement: Firme client is a factory with injected dependencies

The backend SHALL provide `backend/lib/firmeClient.js` exporting `createFirmeClient`, `isFirmeConfigured`, and `FirmeClientError`. `createFirmeClient({ apiUrl, token, legalEntityId, fetchImpl } = {})` SHALL use `backend/config.js` values `FIRME_API_URL`, `FIRME_API_TOKEN`, and `FIRME_LEGAL_ENTITY_ID` for any argument that is `undefined`, and SHALL use `global.fetch` when `fetchImpl` is `undefined`. An explicit empty string SHALL NOT be replaced by the config value. The factory SHALL NOT perform network calls and SHALL NOT throw because configuration is missing. The module SHALL use the runtime native `fetch` only and SHALL NOT add npm dependencies. The module SHALL NOT write to the console.

#### Scenario: Defaults come from config and global fetch

- **WHEN** `createFirmeClient()` is called with no arguments and the three config values are non-empty
- **THEN** the returned client uses those config values and `global.fetch`

#### Scenario: Injected fetch is used and config fills the rest

- **WHEN** `createFirmeClient({ fetchImpl })` is called and config has all three values
- **THEN** every HTTP call of that client uses `fetchImpl`
- **AND** `apiUrl`, `token`, and `legalEntityId` come from config

### Requirement: Configuration check

`isFirmeConfigured()` SHALL return true only when `FIRME_API_URL`, `FIRME_API_TOKEN`, and `FIRME_LEGAL_ENTITY_ID` in the loaded `backend/config.js` are all non-empty. Every client method SHALL throw `FirmeClientError` with code `FIRME_NOT_CONFIGURED` and message «Firme no está configurado (revise FIRME_API_URL, FIRME_API_TOKEN y FIRME_LEGAL_ENTITY_ID).» when the client's `apiUrl`, `token`, or `legalEntityId` is empty, before validating arguments and before any `fetch` call.

#### Scenario: Configured when all three values are present

- **WHEN** the loaded config has non-empty URL, token, and legal entity id
- **THEN** `isFirmeConfigured()` returns true

#### Scenario: Not configured when token or legal entity is empty

- **WHEN** the loaded config has an empty `FIRME_API_TOKEN` or an empty `FIRME_LEGAL_ENTITY_ID`
- **THEN** `isFirmeConfigured()` returns false

#### Scenario: Calling without configuration makes no requests

- **WHEN** `sendForSignature` is called on a client created with `fetchImpl` while URL, token, or legal entity id is empty
- **THEN** it throws `FirmeClientError` with code `FIRME_NOT_CONFIGURED` and the message that names `FIRME_API_URL`, `FIRME_API_TOKEN`, and `FIRME_LEGAL_ENTITY_ID`
- **AND** `fetchImpl` was not called

### Requirement: Send a PDF for simple signature

`sendForSignature({ pdf, name, signees })` SHALL send the PDF for procedure `SIMPLE` by calling, in order: `POST /transactions` with `{ legalEntityId }`; `POST /documents` with `{ name, transactionId }` using the returned `id` as `transactionId`; `PUT` of the PDF bytes to the returned `uploadUrl`; `PUT /documents/{code}/upload` with no body; `PUT /documents/{code}` with `{ category: 'CONTRATOS', subcategory: 'Contrato de Prestación de Servicios', procedureType: 'SIMPLE' }`; then, for each signee in input order, `POST /documents/{code}/signees` with `{ firstName, lastName, maternalLastName, documentNumber, email }` and `POST /documents/{code}/signatures` with `{ privateCode, page, x, y }` using the `privateCode` just returned. It SHALL finish with `POST /transactions/{transactionId}/complete` and body `{ paymentMethod: 'CREDITS' }`. It SHALL return `{ transactionId, documentCode, signees: [{ email, privateCode }] }` in input order. API paths SHALL be resolved against `apiUrl`. `uploadUrl` SHALL be used as an absolute URL.

#### Scenario: Two signees are created in input order

- **WHEN** `sendForSignature` is called with a PDF buffer, a document name, and two signees
- **THEN** the calls are transaction, document, PDF upload, upload confirmation, metadata, first signee, first signature, second signee, second signature, and complete
- **AND** each signee body omits `signature` and each signature body is `{ privateCode, page, x, y }` for that signee
- **AND** the result lists both `privateCode` values in the input order

#### Scenario: One signee follows the same flow

- **WHEN** `sendForSignature` is called with one signee
- **THEN** the flow contains a single signee request and a single signature request
- **AND** the result contains that one `privateCode`

### Requirement: Authorization and presigned URLs

Every request whose URL is under `apiUrl` SHALL include header `Authorization: Bearer <token>` and SHALL NOT place the token anywhere else. A JSON body SHALL be sent with `Content-Type: application/json`. The PDF upload SHALL use the `uploadUrl` as-is, with `Content-Type: application/pdf`, the PDF `Buffer` as the body, and without `Authorization`. Downloads of `download_url` SHALL be `GET` requests without `Authorization`. HTTP 2xx, including 201, SHALL be treated as success.

#### Scenario: Bearer token stays on the API

- **WHEN** a document is sent, read, downloaded, or its evidence is collected
- **THEN** every call to `apiUrl` sends `Authorization: Bearer <token>`
- **AND** the S3 upload and each presigned download omit `Authorization`
- **AND** the S3 upload sends `Content-Type: application/pdf` and the PDF `Buffer`

### Requirement: Partial progress when a send step fails

If a step of `sendForSignature` fails, the client SHALL throw `FirmeClientError` and SHALL NOT retry and SHALL NOT delete resources. `step` SHALL be `transactions`, `documents`, `upload-pdf`, `confirm-upload`, `metadata`, `signees`, `signatures`, or `complete`, matching the failed call. `progress` SHALL be `{ transactionId?, documentCode?, signees }` for resources already created. A signee SHALL be included in `progress.signees` as `{ email, privateCode }` only after `POST /signees` succeeds. The token SHALL NOT appear in `message` or `progress`.

#### Scenario: Completing without credits keeps the created document

- **WHEN** `POST /transactions/{transactionId}/complete` responds HTTP 422 after two signees were created
- **THEN** the error code is `FIRME_NO_CREDITS` and `step` is `complete`
- **AND** `progress` includes `transactionId`, `documentCode`, and both signees with their `privateCode`
- **AND** neither `message` nor `progress` contains the token

#### Scenario: A failed signee keeps only earlier signees

- **WHEN** `POST /documents/{code}/signees` responds HTTP 500 for the second signee
- **THEN** `step` is `signees`
- **AND** `progress.signees` contains only the first signee
- **AND** `progress` includes `transactionId` and `documentCode`

### Requirement: Firme error translation

`FirmeClientError` SHALL carry `message`, `code`, `status`, `step`, and `progress`. The client SHALL map failures as follows, and SHALL NOT log them. HTTP 401 or 403 on a request that sent `Authorization` SHALL use code `FIRME_AUTH_FAILED`, the response status, and message «Firme rechazó la autenticación (revise FIRME_API_TOKEN).» HTTP 422 on step `complete` SHALL use code `FIRME_NO_CREDITS` and message «No quedan créditos de firma en Firme para completar el envío.» Any other non-2xx response, including presigned upload or download, SHALL use code `FIRME_API_ERROR` and message «Error al comunicarse con Firme (paso <step>, HTTP <status>).» When the JSON body has `detail`, the message SHALL append that value in parentheses, clipped to 200 characters; a non-string `detail` SHALL be passed through `JSON.stringify` before clipping. If `detail` contains the token, the token text SHALL be removed. A thrown `fetch` SHALL use code `FIRME_NETWORK_ERROR` and message «No se pudo conectar con Firme.» For methods other than `sendForSignature`, `progress` SHALL be `{ signees: [] }`. Read and evidence calls SHALL use `step` values `document`, `signed-file-url`, `download-signed-pdf`, `logs`, `email-events`, `email-certificate`, and `download-certificate`.

#### Scenario: Rejected token on the first call

- **WHEN** `POST /transactions` responds HTTP 401
- **THEN** the error code is `FIRME_AUTH_FAILED` and `status` is 401
- **AND** the message is «Firme rechazó la autenticación (revise FIRME_API_TOKEN).»
- **AND** the message does not contain the token

#### Scenario: API error includes clipped detail

- **WHEN** `POST /documents/{code}/signees` responds HTTP 500 with a JSON `detail`
- **THEN** the error code is `FIRME_API_ERROR` and `step` is `signees`
- **AND** the message contains `paso signees`, `HTTP 500`, and the `detail` text in parentheses, at most 200 characters of that detail

#### Scenario: Network failure

- **WHEN** `fetchImpl` throws
- **THEN** the error code is `FIRME_NETWORK_ERROR`
- **AND** the message is «No se pudo conectar con Firme.»

#### Scenario: Presigned URL failure is not an auth failure

- **WHEN** the PDF upload URL responds HTTP 403
- **THEN** the error code is `FIRME_API_ERROR` and `step` is `upload-pdf`

### Requirement: Input is validated before any send request

`sendForSignature` SHALL validate input only after configuration is present, and SHALL throw `FIRME_INVALID_INPUT` with a Spanish message that names the field, without calling `fetch`, on the first defect: `pdf` is not a `Buffer` («El campo pdf debe ser un Buffer.»); `signees` is not a non-empty array («El campo signees debe incluir al menos un firmante.»); a signee lacks `firstName`, `lastName`, `maternalLastName`, `documentNumber`, `email`, or `signature`, treating `null`, `undefined`, and `''` as missing («Al firmante N le falta el campo <campo>.», N starting at 1); `signature` lacks `page`, `x`, or `y` with that same missing-field message; `page` is not an integer greater than or equal to 0 («El campo page del firmante N debe ser un entero mayor o igual a 0.»); `x` or `y` is not a finite number from 0 through 1 inclusive («El campo <x|y> del firmante N debe estar entre 0 y 1.»).

#### Scenario: Invalid PDF does not call Firme

- **WHEN** `pdf` is not a `Buffer`
- **THEN** the error code is `FIRME_INVALID_INPUT` and the message names `pdf`
- **AND** no HTTP call was made

#### Scenario: Empty signees does not call Firme

- **WHEN** `signees` is an empty array
- **THEN** the error code is `FIRME_INVALID_INPUT` and the message names `signees`
- **AND** no HTTP call was made

#### Scenario: Missing signee field does not call Firme

- **WHEN** a signee omits `maternalLastName`, `documentNumber`, `email`, or `signature`
- **THEN** the error code is `FIRME_INVALID_INPUT` and the message names that field and the signee position
- **AND** no HTTP call was made

#### Scenario: Stamp position out of range does not call Firme

- **WHEN** `page` is not an integer greater than or equal to 0, or `x` or `y` is outside 0 through 1
- **THEN** the error code is `FIRME_INVALID_INPUT` and the message names `page`, `x`, or `y`
- **AND** no HTTP call was made

### Requirement: Read document status

`getDocument(documentCode)` SHALL `GET /documents/{code}` and return `{ status, signedOn, signees: [{ email, signedOn }] }`. `status` SHALL be the value returned by Firme, unchanged. A missing or null `signedOn`, on the document or on a signee, SHALL be returned as `null`. Signees SHALL be limited to `email` and `signedOn`. A missing `signees` array SHALL be returned as `[]`.

#### Scenario: Pending document without signature dates

- **WHEN** Firme returns `status` `PENDING_SIGNATURE` and no `signedOn` on the document or its signees
- **THEN** `getDocument` returns that `status`, `signedOn` null, and each signee with `email` and `signedOn` null

#### Scenario: Signed document keeps Firme dates

- **WHEN** Firme returns `status` `SIGNED` and `signedOn` values on the document and a signee
- **THEN** `getDocument` returns those `signedOn` values unchanged

### Requirement: Download the signed PDF

`downloadSignedPdf(documentCode)` SHALL `GET /documents/{code}/files/SIGNED_DOCUMENT`, read `download_url`, and `GET` that absolute URL without `Authorization`. It SHALL return a `Buffer` of the response body.

#### Scenario: Signed file is fetched from the presigned URL

- **WHEN** the file endpoint returns a `download_url` and that URL returns PDF bytes
- **THEN** `downloadSignedPdf` returns those bytes as a `Buffer`
- **AND** the second request does not send `Authorization`

### Requirement: Collect signature evidence

`collectEvidence(documentCode, privateCodes)` SHALL `GET /documents/{code}/logs` and use the response `items` as `logs`. For each `privateCode`, in order, it SHALL `GET /documents/{code}/signees/{privateCode}/emails/events` and use `items` as `events`. For each distinct `hub_email_id` in those events, in order of first appearance, it SHALL `GET /documents/{code}/signees/{privateCode}/emails/{hub_email_id}/certificate`, then `GET` `download_url` without `Authorization`, and store `{ emailId, pdf }` where `emailId` is that `hub_email_id` and `pdf` is the downloaded `Buffer`. It SHALL return `{ logs, signees: [{ privateCode, events, certificates }] }`. It SHALL NOT request further pages.

#### Scenario: One certificate per distinct email id

- **WHEN** a signee has two email events with the same `hub_email_id` and a third event with a different id
- **THEN** `collectEvidence` requests two certificates for that signee
- **AND** the result lists that `privateCode` with both events and two certificates whose `emailId` values are those ids

#### Scenario: Evidence follows private code order

- **WHEN** `privateCodes` lists two signees
- **THEN** email events are requested in that order
- **AND** `logs` are the `items` from the logs response
