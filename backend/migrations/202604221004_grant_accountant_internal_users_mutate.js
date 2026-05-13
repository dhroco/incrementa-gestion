/**
 * Otorga al perfil Contador los grants de crear/editar usuarios internos empresa
 * (alineado con seeds; idempotente para bases ya actualizadas).
 */
exports.up = async function up(knex) {
  const accountant = await knex('profile').select('id').where({ code: 'CONTADOR' }).first()
  if (!accountant?.id) return
  const codes = ['NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE', 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT']
  const nodes = await knex('navigation_node').select('id', 'code').whereIn('code', codes)
  const rows = nodes.map((n) => ({
    profile_id: accountant.id,
    navigation_node_id: n.id
  }))
  if (!rows.length) return
  await knex('profile_navigation_grant').insert(rows).onConflict(['profile_id', 'navigation_node_id']).ignore()
}

exports.down = async function down(knex) {
  const accountant = await knex('profile').select('id').where({ code: 'CONTADOR' }).first()
  if (!accountant?.id) return
  const nodes = await knex('navigation_node')
    .select('id')
    .whereIn('code', [
      'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE',
      'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT'
    ])
  const ids = nodes.map((n) => n.id)
  if (!ids.length) return
  await knex('profile_navigation_grant').where({ profile_id: accountant.id }).whereIn('navigation_node_id', ids).del()
}
