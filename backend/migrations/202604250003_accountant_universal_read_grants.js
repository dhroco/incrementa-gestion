/**
 * Otorga al perfil Contador lectura sobre cláusulas universales y templates estándar
 * (entradas de menú y acciones READ), alineado con 002_navigation_authorization_seed. Idempotente.
 */
const CODES = [
  'NAV_ITEM_CONTRATOS_CLAUSULAS_UNIVERSALES',
  'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ',
  'NAV_ITEM_CONTRATOS_PLANTILLAS',
  'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ'
]

exports.up = async function up(knex) {
  const p = await knex('profile').select('id').where({ code: 'CONTADOR' }).first()
  if (!p?.id) return
  const nodes = await knex('navigation_node').select('id', 'code').whereIn('code', CODES)
  const rows = nodes.map((n) => ({
    profile_id: p.id,
    navigation_node_id: n.id
  }))
  if (!rows.length) return
  await knex('profile_navigation_grant').insert(rows).onConflict(['profile_id', 'navigation_node_id']).ignore()
}

exports.down = async function down(knex) {
  const p = await knex('profile').select('id').where({ code: 'CONTADOR' }).first()
  if (!p?.id) return
  const nodes = await knex('navigation_node').select('id').whereIn('code', CODES)
  const ids = nodes.map((n) => n.id)
  if (!ids.length) return
  await knex('profile_navigation_grant').where({ profile_id: p.id }).whereIn('navigation_node_id', ids).del()
}
