# email-resend-service Specification

## Purpose
TBD - created by archiving change firma-documento. Update Purpose after archive.
## Requirements
### Requirement: Resend environment configuration

`backend/config.js` SHALL expose `RESEND_API_KEY` and `RESEND_FROM_EMAIL` from environment variables for all environments. `backend/SET_VARS_AMBIENTE_LOCAL.cmd` SHALL define both variables in CMD and PowerShell blocks.

In development, when domain `incrementa.la` is not verified in Resend, operators MAY use `onboarding@resend.dev` as `RESEND_FROM_EMAIL`. In production, `RESEND_FROM_EMAIL` SHALL use a verified domain address (e.g. `contratos@incrementa.la`).

#### Scenario: Config exposes Resend variables

- **WHEN** the backend loads configuration with env vars set
- **THEN** `config.RESEND_API_KEY` and `config.RESEND_FROM_EMAIL` are available to services

### Requirement: sendSignedContractEmail function

Module `backend/services/emailService.js` SHALL export `sendSignedContractEmail({ to, proveedorNombre, templateName, pdfBuffer, fileName })`.

When `RESEND_API_KEY` is configured, the function SHALL use `new Resend(process.env.RESEND_API_KEY)` to send email with:

- `from`: `process.env.RESEND_FROM_EMAIL`
- `to`: the provided recipient
- `subject`: `Contrato firmado — ${proveedorNombre} — ${templateName}`
- `html`: professional Spanish message explaining the contract was electronically signed
- `attachments`: `[{ filename: fileName, content: pdfBuffer.toString('base64') }]`

When `RESEND_API_KEY` is NOT configured, the function SHALL log the email details (to, subject, attachment filename) to console instead of throwing an error.

#### Scenario: Email sent with valid API key

- **WHEN** `sendSignedContractEmail` is called with valid config and parameters
- **THEN** Resend API is invoked with the signed PDF attachment

#### Scenario: Dev fallback without API key

- **WHEN** `RESEND_API_KEY` is empty or undefined
- **THEN** the function logs email payload to console
- **AND** does not throw an error
