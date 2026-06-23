exports.up = async function up(knex) {
  await knex('navigation_node')
    .where({ code: 'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA' })
    .update({ label: 'Usuarios', module_title: 'Usuarios' })

  await knex('navigation_node')
    .where({ code: 'NAV_ITEM_CONTRATOS_PLANTILLAS' })
    .update({ label: 'Plantillas', module_title: 'Plantillas' })

  const adminGlobal = await knex('navigation_node')
    .where({ code: 'NAV_MENU_ADMIN_GLOBAL' })
    .first()

  if (adminGlobal) {
    await knex('navigation_node')
      .where({ code: 'NAV_ITEM_SISTEMA_ROLES_PERMISOS' })
      .update({ parent_id: adminGlobal.id, sort_order: 215 })
  }

  const sistemaNode = await knex('navigation_node')
    .where({ code: 'NAV_MENU_SISTEMA' })
    .first()

  if (sistemaNode) {
    await knex('profile_navigation_grant')
      .where({ navigation_node_id: sistemaNode.id })
      .del()
    await knex('navigation_node').where({ id: sistemaNode.id }).del()
  }
}

exports.down = async function down(_knex) {}
