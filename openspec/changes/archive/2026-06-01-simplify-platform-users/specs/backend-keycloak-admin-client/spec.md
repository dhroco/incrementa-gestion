## MODIFIED Requirements

### Requirement: Find user id by email in application realm

The Keycloak admin client SHALL expose `findUserIdByEmail(email)` that queries `{KEYCLOAK_ADMIN_URL}/admin/realms/{KEYCLOAK_REALM}/users?email={encodedEmail}&exact=true` (or the project's existing query shape). When exactly one user matches, it SHALL return `{ id, fullName }` where `id` is the Keycloak user UUID and `fullName` is built by joining non-empty `firstName` and `lastName` from the Keycloak user record (trimmed, single space). If both name parts are empty or undefined, `fullName` SHALL be the normalized email argument. When no user matches, it SHALL return `null`. On admin client unavailable it SHALL behave consistently with other admin operations (null client → caller maps to **503**). On Keycloak admin errors (network, token, etc.) it SHALL throw `KeycloakAdminError` as today.

#### Scenario: Existing Keycloak user with name resolved

- **WHEN** `findUserIdByEmail` is called for an email present in the realm with `firstName` and `lastName`
- **THEN** the function returns `{ id: <uuid>, fullName: "<firstName> <lastName>" }`

#### Scenario: Existing Keycloak user without name parts

- **WHEN** `findUserIdByEmail` is called for an email present in the realm but `firstName` and `lastName` are empty
- **THEN** the function returns `{ id: <uuid>, fullName: <normalized email> }`

#### Scenario: Unknown email returns null

- **WHEN** no user matches the email in the realm
- **THEN** the function returns `null` without throwing
