## ADDED Requirements

### Requirement: API calls send a User-Agent

Every request whose URL is under `apiUrl` SHALL include header `User-Agent: Incrementa-Contratos/1.0`, including calls that already exist and calls added by this change. The PDF upload to the S3 `uploadUrl` and every download of a presigned URL SHALL NOT send that header. The token SHALL NOT appear in error messages.

#### Scenario: API calls carry the User-Agent

- **WHEN** the client calls the Firme API
- **THEN** the request includes `User-Agent: Incrementa-Contratos/1.0`
- **AND** it still includes `Authorization: Bearer <token>`

#### Scenario: Presigned upload and download omit the User-Agent

- **WHEN** the client uploads the PDF to S3 or downloads a presigned URL
- **THEN** that request does not include `User-Agent`
- **AND** it does not include `Authorization`

### Requirement: Optional progress callback before complete

`sendForSignature(input, { onProgress } = {})` SHALL accept an optional second argument. When `onProgress` is a function, the client SHALL call it with a copy of `progress` (`{ transactionId?, documentCode?, signees }`) after the transaction is created, after the document is created, after each signee is created, and before `POST /transactions/{id}/complete`. An exception thrown inside `onProgress` SHALL be ignored and SHALL NOT stop the send. When `onProgress` is omitted, the call order, the request bodies, and the return value SHALL be the same as today.

#### Scenario: Progress is reported before complete

- **WHEN** `sendForSignature` is called with `onProgress` and one signee
- **THEN** `onProgress` runs after the transaction, after the document, and after the signee
- **AND** it runs before `complete`
- **AND** the final result is `{ transactionId, documentCode, signees }`

#### Scenario: A throwing callback does not stop the send

- **WHEN** `onProgress` throws after the document is created
- **THEN** the client still completes the transaction
- **AND** the returned `documentCode` is the one created

#### Scenario: Omitting the callback keeps today's response

- **WHEN** `sendForSignature` is called with one argument
- **THEN** no progress callback runs
- **AND** the result lists the signee `privateCode` in input order

### Requirement: Read simple signature quota

`getQuota()` SHALL `GET /legal-entities/{legalEntityId}/quota` and return `{ simple }` as an integer. When `simple` is missing, it SHALL return `0`.

#### Scenario: Quota returns the simple balance

- **WHEN** the quota endpoint returns `simple` equal to 12
- **THEN** `getQuota()` returns `{ simple: 12 }`

#### Scenario: Missing simple balance is zero

- **WHEN** the quota endpoint returns a body without `simple`
- **THEN** `getQuota()` returns `{ simple: 0 }`

### Requirement: Delete a draft document

`deleteDocument(documentCode)` SHALL `DELETE /documents/{code}` and return `{ deleted: true }`. An empty body SHALL be success.

#### Scenario: Empty delete body succeeds

- **WHEN** `DELETE /documents/{code}` responds HTTP 200 with an empty body
- **THEN** `deleteDocument` returns `{ deleted: true }`

### Requirement: Resend a signee invitation

`resendInvitation(documentCode, privateCode)` SHALL `POST /documents/{code}/signees/{privateCode}/resend` and return `{ resent: true }`. An empty body or a JSON body SHALL be success. HTTP 422 SHALL throw `FirmeClientError` with `status` 422.

#### Scenario: Resend accepts an empty body

- **WHEN** the resend endpoint responds HTTP 200 with an empty body
- **THEN** `resendInvitation` returns `{ resent: true }`

#### Scenario: Resend 422 is a client error

- **WHEN** the resend endpoint responds HTTP 422
- **THEN** the error is a `FirmeClientError` with `status` 422
- **AND** the message does not contain the token

### Requirement: Webhook subscription methods

The client SHALL expose `createWebhook({ url, eventTypes })` as `POST /webhooks/subscriptions` with body `{ legalEntityId, url, eventTypes }`; `listWebhooks()` as `GET /webhooks/subscriptions?legalEntityId=…`; `deleteWebhook(id)` as `DELETE /webhooks/subscriptions/{id}`; and `getWebhook(id)` as `GET /webhooks/subscriptions/{id}/status`. Failures SHALL use `FirmeClientError`. The token SHALL NOT appear in messages.

#### Scenario: Create sends the legal entity and event types

- **WHEN** `createWebhook` is called with a URL and an event type list
- **THEN** the request is `POST /webhooks/subscriptions` with that URL, those event types, and the client `legalEntityId`
- **AND** the request includes `Authorization` and `User-Agent: Incrementa-Contratos/1.0`

#### Scenario: List, delete, and status use the subscription id

- **WHEN** `listWebhooks`, `deleteWebhook`, and `getWebhook` are called
- **THEN** they use `GET` with the `legalEntityId` query, `DELETE /webhooks/subscriptions/{id}`, and `GET /webhooks/subscriptions/{id}/status`
- **AND** none of the error messages contain the token
