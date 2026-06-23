## 1. Database

- [x] 1.1 Add migration `backend/migrations/*_drop_must_change_password.js` with `DROP COLUMN must_change_password` on `user_profile`
- [x] 1.2 Grep seeds and fixtures for `must_change_password`; remove or update references

## 2. Keycloak admin client

- [x] 2.1 Comment out `createUser`, `deleteUser`, `resetUserPassword` in `keycloakAdminClient.js` with `// eliminado en refactor IdP` (keep `findUserIdByEmail`, `updateUserEmail`, token helpers)
- [x] 2.2 Verify `delete-app-user.js`: if it still needs `deleteUser`, leave an active export for scripts only; document in code comment
- [x] 2.3 Ensure `findUserIdByEmail` distinguishes empty result vs network/admin errors for callers

## 3. Platform users service and API

- [x] 3.1 Refactor `createPlatformUser` in `platformUsersAdminService.js`: lookup → 422/409 → insert without password or `must_change_password`
- [x] 3.2 Remove `generateTempPassword` and any Keycloak create/delete/reset calls from create path
- [x] 3.3 Update `platformUsersPlatformApi` tests and `platformUsersPlatformApi.test.js` for new errors and response shape (no temp password)
- [x] 3.4 Remove password handlers from `meController.js` and unregister `PUT /api/me/password`, `POST /api/me/password-rotation-complete` in `app.js`

## 4. Session layer

- [x] 4.1 Remove `must_change_password` / `mustChangePassword` from `userSessionMetaService.js` and `sessionResponses.js`
- [x] 4.2 Update `meSessionApi.test.js`, `sessionResponses.test.js`, and any test using `mustChangePassword`

## 5. Frontend auth and routing

- [x] 5.1 Remove `mustChangePassword` state, reducers, and `selectMustChangePassword` from `authSlice`
- [x] 5.2 Delete `MandatoryPasswordChangePage.jsx` and its route; remove router guard redirect for mandatory password change
- [x] 5.3 Remove password-related methods from `meApi.js` and frontend tests (`mePasswordApi.test.js`, etc.)

## 6. Platform user create UI

- [x] 6.1 Simplify `PlatformUserCreatePage.jsx`: no password/temp-password UI; toast + redirect on success
- [x] 6.2 Map API 422 IdP-not-found to form message about creating user in Keycloak first

## 7. Verification

- [x] 7.1 Project-wide grep for `must_change_password`, `mustChangePassword`, `MandatoryPasswordChange`, `password-rotation-complete`, `generateTempPassword`
- [x] 7.2 Run `knex migrate:latest` locally and backend test suite for affected modules
- [x] 7.3 Manual smoke: create user in Keycloak → register in platform → login; attempt register without Keycloak user → see 422 message
