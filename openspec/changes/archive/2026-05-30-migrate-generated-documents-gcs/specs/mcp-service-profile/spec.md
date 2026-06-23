## ADDED Requirements

### Requirement: MCP_SERVICE profile with technical user and manage-all grant

Migration `202605300019_mcp_service_profile` SHALL insert profile `code='MCP_SERVICE'`, `label='Servicio MCP'`, user_profile with `user_id='00000000-0000-0000-0000-000000000001'`, `email='mcp@incrementa.la'`, `is_active=true`, and `role_permissions` with `action='manage'`, `subject='all'`, `inverted=false` linked to that profile.

The migration `down` SHALL delete in order: `role_permissions` for that profile, then `user_profile` for that `user_id`, then `profile` with `code='MCP_SERVICE'`.

#### Scenario: Up seeds MCP profile

- **WHEN** migration 019 runs on a database without MCP_SERVICE
- **THEN** profile MCP_SERVICE exists with the technical user and a manage/all permission row

#### Scenario: Down removes MCP data

- **WHEN** migration 019 down runs
- **THEN** no `role_permissions`, `user_profile`, or `profile` rows remain for MCP_SERVICE / the fixed user id
