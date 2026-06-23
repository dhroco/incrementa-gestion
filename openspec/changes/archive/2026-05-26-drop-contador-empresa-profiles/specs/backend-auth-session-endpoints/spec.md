## REMOVED Requirements

### Requirement: No frontend or session middleware changes

**Reason**: Superseded by profile removal; enriched session behavior must change to drop accountant-specific fields and inactive handling.

**Migration**: Consumers must not expect `assignedCompanies`, accountant-specific `isActive` branching, or HTTP 403 accountant-inactive responses. Platform admin uses unified `user_profile.is_active` only.

## ADDED Requirements

### Requirement: Enriched session excludes removed profile behaviors

`GET /api/me/session` (and alias `/api/me/authorization/current`) SHALL NOT include response fields `assignedCompanies` or accountant-specific inactive handling for profile codes `CONTADOR` or `USUARIO_EMPRESA_ADMINISTRADOR`. The handler SHALL NOT return HTTP 403 with an accountant-inactive error body. Session meta loading SHALL NOT query table `accountant`. Automatic injection of `company` context based on `USUARIO_EMPRESA_ADMINISTRADOR` scope SHALL NOT occur.

#### Scenario: Platform admin session payload shape

- **WHEN** a user with only profile `ADMINISTRADOR_PLATAFORMA` calls `GET /api/me/session`
- **THEN** the response status is **200**
- **AND** the JSON body does not contain property `assignedCompanies`
- **AND** `profile.code` is `ADMINISTRADOR_PLATAFORMA`

#### Scenario: No accountant inactive gate

- **WHEN** any authenticated user calls `GET /api/me/session`
- **THEN** the server does not respond with the accountant-inactive error code/body previously produced for disabled accountants
