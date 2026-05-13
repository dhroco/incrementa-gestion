/**
 * Alinea el grant de edición con el de creación: perfiles que solo tenían CREATE
 * reciben también EDIT (misma intención operativa).
 */
const CREATE = 'NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE'
const EDIT = 'NAV_ACTION_TRABAJADORES_TRABAJADORES_EDIT'

exports.up = async function up(knex) {
  const createNode = await knex('navigation_node').select('id').where({ code: CREATE }).first()
  const editNode = await knex('navigation_node').select('id').where({ code: EDIT }).first()
  if (!createNode?.id || !editNode?.id) return

  const withCreate = await knex('profile_navigation_grant').where({ navigation_node_id: createNode.id }).select('profile_id')

  const rows = withCreate.map((r) => ({
    profile_id: r.profile_id,
    navigation_node_id: editNode.id
  }))
  if (rows.length === 0) return
  await knex('profile_navigation_grant').insert(rows).onConflict(['profile_id', 'navigation_node_id']).ignore()
}

exports.down = async function down() {
  // No se revierte: no distinguimos grants añadidos por esta migración de los ya existentes.
}
