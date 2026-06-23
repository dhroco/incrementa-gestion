/**
 * Nodos de navegación del módulo Proveedores bajo Administración global.
 * Idempotente (upsert por code).
 */

const PROVEEDORES_CODES = [
  'NAV_ITEM_PROVEEDORES_PROVEEDORES',
  'NAV_ACTION_PROVEEDORES_READ',
  'NAV_ACTION_PROVEEDORES_CREATE',
  'NAV_ACTION_PROVEEDORES_EDIT'
]

async function upsertNode(knex, payload) {
  const [row] = await knex('navigation_node')
    .insert(payload)
    .onConflict('code')
    .merge({
      parent_id: payload.parent_id ?? null,
      label: payload.label,
      route_path: payload.route_path ?? null,
      module_title: payload.module_title ?? null,
      sort_order: payload.sort_order,
      is_active: payload.is_active,
      show_in_main_menu: payload.show_in_main_menu
    })
    .returning('id')
  return row?.id ?? null
}

exports.up = async function up(knex) {
  const parent = await knex('navigation_node').select('id').where({ code: 'NAV_MENU_ADMIN_GLOBAL' }).first()
  if (!parent?.id) return

  const navProveedoresId = await upsertNode(knex, {
    parent_id: parent.id,
    code: 'NAV_ITEM_PROVEEDORES_PROVEEDORES',
    label: 'Proveedores',
    route_path: '/app/proveedores',
    module_title: 'Proveedores',
    sort_order: 245,
    is_active: true,
    show_in_main_menu: true
  })

  await upsertNode(knex, {
    parent_id: navProveedoresId,
    code: 'NAV_ACTION_PROVEEDORES_READ',
    label: 'Ver proveedores',
    route_path: null,
    module_title: null,
    sort_order: 246,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navProveedoresId,
    code: 'NAV_ACTION_PROVEEDORES_CREATE',
    label: 'Crear proveedor',
    route_path: null,
    module_title: null,
    sort_order: 247,
    is_active: true,
    show_in_main_menu: false
  })
  await upsertNode(knex, {
    parent_id: navProveedoresId,
    code: 'NAV_ACTION_PROVEEDORES_EDIT',
    label: 'Editar proveedor',
    route_path: null,
    module_title: null,
    sort_order: 248,
    is_active: true,
    show_in_main_menu: false
  })

  const adminProfile = await knex('profile').select('id').where({ code: 'ADMINISTRADOR_PLATAFORMA' }).first()
  if (!adminProfile?.id) return

  const nodes = await knex('navigation_node').select('id', 'code').whereIn('code', PROVEEDORES_CODES)
  const rows = nodes.map((n) => ({
    profile_id: adminProfile.id,
    navigation_node_id: n.id
  }))
  if (!rows.length) return
  await knex('profile_navigation_grant').insert(rows).onConflict(['profile_id', 'navigation_node_id']).ignore()
}

exports.down = async function down(knex) {
  const nodes = await knex('navigation_node').select('id').whereIn('code', PROVEEDORES_CODES)
  const nodeIds = nodes.map((n) => n.id)
  if (!nodeIds.length) return
  await knex('profile_navigation_grant').whereIn('navigation_node_id', nodeIds).del()
  await knex('navigation_node').whereIn('id', nodeIds).del()
}
