/**
 * Destructive: remove contador-related navigation nodes and all profile grants.
 * Irreversible — down throws.
 */

exports.up = async function up(knex) {
  const contadorNodes = await knex('navigation_node')
    .select('id')
    .whereRaw("code ILIKE '%CONTADOR%'")

  const nodeIds = contadorNodes.map((row) => row.id)
  if (nodeIds.length === 0) {
    return
  }

  await knex('profile_navigation_grant').whereIn('navigation_node_id', nodeIds).del()
  await knex('navigation_node').whereIn('id', nodeIds).del()
}

exports.down = async function down() {
  throw new Error('Irreversible migration: drop_contador_navigation_nodes')
}
