/**
 * Technical profile for MCP / automated integrations.
 */

const MCP_USER_ID = '00000000-0000-0000-0000-000000000001'
const MCP_EMAIL = 'mcp@incrementa.la'
const MCP_PROFILE_CODE = 'MCP_SERVICE'

exports.up = async function up(knex) {
  let profile = await knex('profile').where({ code: MCP_PROFILE_CODE }).first()
  if (!profile) {
    await knex('profile').insert({ code: MCP_PROFILE_CODE, label: 'Servicio MCP' })
    profile = await knex('profile').where({ code: MCP_PROFILE_CODE }).first()
  }

  const profileId = profile.id

  const existingUser = await knex('user_profile').where({ user_id: MCP_USER_ID }).first()
  if (!existingUser) {
    await knex('user_profile').insert({
      user_id: MCP_USER_ID,
      email: MCP_EMAIL,
      profile_id: profileId,
      is_active: true
    })
  }

  const existingPerm = await knex('role_permissions')
    .where({ role_id: profileId, action: 'manage', subject: 'all', inverted: false })
    .first()
  if (!existingPerm) {
    await knex('role_permissions').insert({
      role_id: profileId,
      action: 'manage',
      subject: 'all',
      inverted: false
    })
  }
}

exports.down = async function down(knex) {
  const profile = await knex('profile').where({ code: MCP_PROFILE_CODE }).first()
  if (profile) {
    await knex('role_permissions').where({ role_id: profile.id }).del()
  }
  await knex('user_profile').where({ user_id: MCP_USER_ID }).del()
  await knex('profile').where({ code: MCP_PROFILE_CODE }).del()
}
