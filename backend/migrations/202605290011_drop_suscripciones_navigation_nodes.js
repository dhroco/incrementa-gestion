exports.up = async function up(knex) {
  const nodes = await knex('navigation_node')
    .select('id')
    .whereRaw("code ILIKE '%SUSCRIPCIONES%'")
  const nodeIds = nodes.map((r) => r.id)
  if (nodeIds.length === 0) return
  await knex('profile_navigation_grant').whereIn('navigation_node_id', nodeIds).del()
  await knex('navigation_node').whereIn('id', nodeIds).del()
}

exports.down = async function down(_knex) {}
