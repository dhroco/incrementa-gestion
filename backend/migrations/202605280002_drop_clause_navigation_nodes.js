exports.up = async function up(knex) {
  const clauseNodes = await knex('navigation_node')
    .select('id')
    .whereRaw("code ILIKE '%CLAUSULA%'")

  const nodeIds = clauseNodes.map((row) => row.id)
  if (nodeIds.length === 0) {
    return
  }

  await knex('profile_navigation_grant').whereIn('navigation_node_id', nodeIds).del()
  await knex('navigation_node').whereIn('id', nodeIds).del()
}

exports.down = async function down(_knex) {
  // Los nodos de cláusulas no se restauran; la funcionalidad fue eliminada.
}
