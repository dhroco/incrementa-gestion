## ADDED Requirements

### Requirement: Auth slice stores profile extras from enriched session

The frontend auth slice SHALL store `avatarUrl`, `contactEmail`, and `widgetPreferences` at the top level of auth state (alongside `enrichedEmail`, `enrichedProfile`, etc.). `fetchEnrichedSessionThunk` SHALL populate these from `GET /api/me/session` response fields `avatar_url`, `contact_email`, and `widget_preferences` when present. The slice SHALL export selectors `selectAvatarUrl`, `selectContactEmail`, and `selectWidgetPreferences`. The slice SHALL export reducer action `updateProfileData({ contactEmail, widgetPreferences, avatarUrl })` that updates these fields without clearing tokens or forcing re-login.

#### Scenario: Enriched session hydrates profile extras

- **WHEN** `fetchEnrichedSessionThunk` succeeds and the session response includes `avatar_url`, `contact_email`, and `widget_preferences`
- **THEN** Redux state contains matching values in `avatarUrl`, `contactEmail`, and `widgetPreferences`

#### Scenario: updateProfileData after profile save

- **WHEN** the user saves contact email or widget preferences on Mi Perfil
- **THEN** the app dispatches `updateProfileData` with the new values
- **AND** `selectContactEmail` or `selectWidgetPreferences` reflect the update without a full session reload

#### Scenario: Profile extras cleared on sign out

- **WHEN** `signOutThunk` completes or session is cleared
- **THEN** `avatarUrl`, `contactEmail`, and `widgetPreferences` are reset to null
