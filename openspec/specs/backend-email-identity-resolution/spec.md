# backend-email-identity-resolution Specification

## Purpose
TBD - created by archiving change backend-entra-id-email-identity. Update Purpose after archive.
## Requirements
### Requirement: Internal identity resolution middleware

The backend SHALL provide `backend/middleware/resolveInternalIdentity.js` as an injectable factory `resolveInternalIdentity({ db })` that returns Express middleware. When `req.auth.email` is present and non-empty after normalization, the middleware SHALL query `user_profile` for a row whose email matches case-insensitively and, if found, SHALL set `req.auth.userId` to that row's `user_id`. When no row matches or email is absent, the middleware SHALL NOT modify `req.auth.userId` and SHALL call `next()` without error.

#### Scenario: Email matches user profile

- **WHEN** a request passes OIDC auth with normalized email `user@example.com`
- **AND** `user_profile` contains a row with `LOWER(email) = 'user@example.com'` and `user_id = 'internal-uuid-1'`
- **THEN** the middleware calls `next()`
- **AND** `req.auth.userId` equals `'internal-uuid-1'`
- **AND** `req.auth.email` remains the normalized email from the token

#### Scenario: Email does not match any profile

- **WHEN** a request passes OIDC auth with email present in the token
- **AND** no `user_profile` row matches that email case-insensitively
- **THEN** the middleware calls `next()`
- **AND** `req.auth.userId` remains the JWT `sub` from the prior auth middleware

#### Scenario: Email absent in token

- **WHEN** a request passes OIDC auth but `req.auth.email` is null or empty after normalization
- **THEN** the middleware calls `next()` without querying the database
- **AND** `req.auth.userId` is unchanged

### Requirement: Email normalization for identity lookup

The identity resolution middleware SHALL normalize `req.auth.email` using `normalizeAuthEmail` from `backend/lib/normalizeAuthEmail.js` before database lookup. Database comparison SHALL use `LOWER(email)` on the `user_profile.email` column.

#### Scenario: Case-insensitive match

- **WHEN** the token email normalizes to `admin@incrementa.la`
- **AND** `user_profile.email` stores `Admin@Incrementa.LA`
- **THEN** the middleware resolves the correct `user_id`

### Requirement: Middleware ordering in Express application

`backend/app.js` SHALL register the identity resolution middleware after `requireAuth` (OIDC validation) and before `attachAbilityMiddleware`. The middleware SHALL be injectable via `createApp({ resolveInternalIdentityMiddleware })` with a default wired to the application Knex instance.

#### Scenario: Protected route uses resolved internal user id

- **WHEN** `createApp()` is called without overrides
- **AND** a protected route receives a valid Entra token whose email matches a user profile
- **THEN** `attachAbility` and downstream handlers receive `req.auth.userId` equal to the internal `user_profile.user_id`

### Requirement: Case-insensitive unique email index

A Knex migration SHALL create a partial unique index on `user_profile`:

```sql
CREATE UNIQUE INDEX user_profile_email_lower_unique
  ON user_profile (LOWER(email))
  WHERE email IS NOT NULL;
```

Before creating the index, the migration SHALL detect duplicate emails (case-insensitive, ignoring NULL) and SHALL fail with an error message listing the duplicate groups. The migration SHALL NOT delete or merge duplicate rows automatically.

#### Scenario: Migration succeeds with unique emails

- **WHEN** no two non-null `user_profile.email` values differ only by case
- **THEN** `knex migrate:latest` creates index `user_profile_email_lower_unique`

#### Scenario: Migration fails on duplicates

- **WHEN** two rows have emails `User@Example.com` and `user@example.com`
- **THEN** the migration throws an error identifying the duplicate normalized email
- **AND** no index is created

#### Scenario: Migration rollback

- **WHEN** the migration is rolled back
- **THEN** index `user_profile_email_lower_unique` is dropped

### Requirement: Existing user resolvers remain unchanged

This change SHALL NOT modify `buildPackedRulesForUser`, `loadSessionMetaForUser`, or `getUserProfileIdByUserId`. Internal identity resolution SHALL occur exclusively via the new middleware overwriting `req.auth.userId`.

#### Scenario: Resolver source files untouched

- **WHEN** this change is merged
- **THEN** the three resolver functions continue to accept `userId` as their lookup key without email-based logic

### Requirement: No frontend or ROPC changes

This capability SHALL NOT modify files under `frontend/`. It SHALL NOT remove or alter `oidcAuthService`, `authController`, or routes `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`.

#### Scenario: Scope boundary

- **WHEN** this change is merged
- **THEN** no frontend source files are changed
- **AND** ROPC auth endpoints remain present and functional

