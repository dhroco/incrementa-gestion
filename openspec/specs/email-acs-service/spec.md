# email-acs-service Specification

## Purpose
Correo saliente del contrato firmado con Azure Communication Services Email (reemplaza a Resend desde el 18-nov-2026).

## Requirements
### Requirement: ACS environment configuration

`backend/config.js` SHALL expose `ACS_EMAIL_ENDPOINT` and `ACS_EMAIL_FROM` from environment variables for all environments. In Azure they are injected by the Container Apps (module `infra/azure/modulos/correo.bicep`): the endpoint of the Communication Service and the sender `DoNotReply@<guid>.azurecomm.net` of the Azure-managed domain. With a custom domain only `ACS_EMAIL_FROM` changes.

#### Scenario: Config exposes ACS variables

- **WHEN** the backend loads configuration with env vars set
- **THEN** `config.ACS_EMAIL_ENDPOINT` and `config.ACS_EMAIL_FROM` are available to services

### Requirement: sendSignedContractEmail function

Module `backend/services/emailService.js` SHALL export `sendSignedContractEmail({ to, proveedorNombre, templateName, pdfBuffer, fileName })`. `to` MAY hold several addresses separated by comma, semicolon or spaces; duplicates SHALL be removed.

When `ACS_EMAIL_ENDPOINT` and `ACS_EMAIL_FROM` are configured, the function SHALL send through `@azure/communication-email` (`EmailClient.beginSend`) authenticating with `DefaultAzureCredential` (managed identity in Azure, `az login` locally; no keys), with:

- `senderAddress`: `ACS_EMAIL_FROM`
- `recipients.to`: every parsed address
- `content.subject`: `Contrato firmado — ${proveedorNombre} — ${templateName}`
- `content.html`: Spanish message explaining the contract was electronically signed
- `attachments`: the signed PDF (`contentType: application/pdf`, base64)

The function SHALL NOT wait for final delivery: it returns once ACS accepts the message and logs a later failure.

When there are no recipients or ACS is not configured, the function SHALL log and return `{ ok: true, skipped: true }` without throwing. If ACS rejects the request, the error SHALL propagate to the caller.

#### Scenario: Email sent to every recipient

- **WHEN** `sendSignedContractEmail` is called with `to: 'a@x.cl, b@x.cl'` and ACS configured
- **THEN** ACS is invoked once with both recipients and the signed PDF attached

#### Scenario: Not configured

- **WHEN** `ACS_EMAIL_ENDPOINT` or `ACS_EMAIL_FROM` is empty
- **THEN** the function returns `skipped: true` and does not throw
