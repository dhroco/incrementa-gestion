/**
 * Revoca el acceso de "Jornadas laborales" al perfil Administrador de plataforma.
 * Usuario empresa administrador y Contador conservan el grant si ya existía en seeds.
 */
exports.up = async function up(knex) {
  const adminProfile = await knex('profile').select('id').where({ code: 'ADMINISTRADOR_PLATAFORMA' }).first()
  const node = await knex('navigation_node').select('id').where({ code: 'NAV_ITEM_ADMIN_GLOBAL_JORNADAS_LABORALES' }).first()
  if (!adminProfile?.id || !node?.id) return
  await knex('profile_navigation_grant').where({ profile_id: adminProfile.id, navigation_node_id: node.id }).del()
}

exports.down = async function down(knex) {
  const adminProfile = await knex('profile').select('id').where({ code: 'ADMINISTRADOR_PLATAFORMA' }).first()
  const node = await knex('navigation_node').select('id').where({ code: 'NAV_ITEM_ADMIN_GLOBAL_JORNADAS_LABORALES' }).first()
  if (!adminProfile?.id || !node?.id) return
  await knex('profile_navigation_grant')
    .insert({ profile_id: adminProfile.id, navigation_node_id: node.id })
    .onConflict(['profile_id', 'navigation_node_id'])
    .ignore()
}
