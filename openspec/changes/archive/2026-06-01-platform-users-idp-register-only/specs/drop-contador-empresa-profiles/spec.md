## REMOVED Requirements

### Requirement: Password rotation complete remains on me controller

**Reason**: `POST /api/me/password-rotation-complete` and `user_profile.must_change_password` are removed; password lifecycle is IdP-only.

**Migration**: Configure Keycloak realm policies for password updates; no application flag to clear after rotation.
