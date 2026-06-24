## REMOVED Requirements

### Requirement: Keycloak admin configuration in backend config

**Reason**: Microsoft Entra ID replaced Keycloak; platform user validation uses Microsoft Graph read-only lookup. No runtime or script path requires Keycloak Admin REST credentials.

**Migration**: Remove `KEYCLOAK_*` from deployment secrets and local env scripts. Use Microsoft Entra admin portal for identity lifecycle. Use simplified `delete-app-user.js` (database only) for application profile removal.

### Requirement: Keycloak admin client uses native fetch only

**Reason**: Module `backend/lib/keycloakAdminClient.js` is deleted.

**Migration**: None for application runtime. Operational user deletion in Entra is out of band.

### Requirement: Master realm admin token with short-lived cache

**Reason**: Keycloak admin client removed.

**Migration**: None.

### Requirement: Delete user from application realm

**Reason**: Application no longer calls Keycloak `deleteUser`. Graph client is read-only.

**Migration**: Remove platform access by deleting `user_profile` via admin API or simplified ops script; manage Entra account separately in Microsoft admin center.

### Requirement: Platform user provisioning uses Keycloak admin client

**Reason**: Superseded by Graph-based validation in `platform-users-idp-register-only`; Keycloak client no longer exists.

**Migration**: Already completed in prior change; this removal deletes dead code only.

### Requirement: Deletion scripts use only application schema and Keycloak

**Reason**: Script simplified to database-only deletion; Keycloak identity deletion is not performed by the application.

**Migration**: Update ops runbooks: `delete-app-user.js` removes `user_profile` only; Entra user deletion is manual if required.
