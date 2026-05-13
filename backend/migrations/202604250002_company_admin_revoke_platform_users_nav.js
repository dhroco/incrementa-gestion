/**
 * El perfil Usuario empresa administrador no debe ver ni usar "Usuarios plataforma";
 * solo "Usuarios internos empresa". Revoca los grants asociados (alineado con seed).
 */
const CODES = [
  'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_READ',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_CREATE',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_EDIT'
]

exports.up = async function up(knex) {
  const p = await knex('profile').select('id').where({ code: 'USUARIO_EMPRESA_ADMINISTRADOR' }).first()
  if (!p?.id) return
  const nodes = await knex('navigation_node').select('id').whereIn('code', CODES)
  const ids = nodes.map((n) => n.id)
  if (!ids.length) return
  await knex('profile_navigation_grant').where({ profile_id: p.id }).whereIn('navigation_node_id', ids).del()
}

exports.down = async function down(knex) {
  const p = await knex('profile').select('id').where({ code: 'USUARIO_EMPRESA_ADMINISTRADOR' }).first()
  if (!p?.id) return
  const nodes = await knex('navigation_node').select('id', 'code').whereIn('code', CODES)
  const rows = nodes.map((n) => ({ profile_id: p.id, navigation_node_id: n.id }))
  if (!rows.length) return
  await knex('profile_navigation_grant').insert(rows).onConflict(['profile_id', 'navigation_node_id']).ignore()
}
