/**
 * Reubica el ítem "Jornadas laborales" bajo el menú "Gestión trabajadores"
 * (antes colgaba de "Administración global").
 */
exports.up = async function up(knex) {
  const parent = await knex('navigation_node').select('id').where({ code: 'NAV_MENU_GESTION_TRABAJADORES' }).first()
  if (!parent?.id) return
  await knex('navigation_node')
    .where({ code: 'NAV_ITEM_ADMIN_GLOBAL_JORNADAS_LABORALES' })
    .update({ parent_id: parent.id, sort_order: 340 })
}

exports.down = async function down(knex) {
  const parent = await knex('navigation_node').select('id').where({ code: 'NAV_MENU_ADMIN_GLOBAL' }).first()
  if (!parent?.id) return
  await knex('navigation_node')
    .where({ code: 'NAV_ITEM_ADMIN_GLOBAL_JORNADAS_LABORALES' })
    .update({ parent_id: parent.id, sort_order: 250 })
}
