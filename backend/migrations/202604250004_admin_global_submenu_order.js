/**
 * Orden de submenús bajo "Administración global" para plataforma:
 * Empresas (210) → Usuarios plataforma (220) → Contadores (230), alineado con el seed.
 */
const ORDER = [
  { code: 'NAV_ITEM_ADMIN_GLOBAL_EMPRESAS', sort_order: 210 },
  { code: 'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA', sort_order: 220 },
  { code: 'NAV_ITEM_ADMIN_GLOBAL_CONTADORES', sort_order: 230 }
]

exports.up = async function up(knex) {
  for (const { code, sort_order } of ORDER) {
    const n = await knex('navigation_node').select('id').where({ code }).first()
    if (n) await knex('navigation_node').where({ id: n.id }).update({ sort_order })
  }
}

exports.down = async function down(knex) {
  // Orden previo: Usuarios plataforma 210, Contadores 220, Empresas 230
  const previous = [
    { code: 'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_PLATAFORMA', sort_order: 210 },
    { code: 'NAV_ITEM_ADMIN_GLOBAL_CONTADORES', sort_order: 220 },
    { code: 'NAV_ITEM_ADMIN_GLOBAL_EMPRESAS', sort_order: 230 }
  ]
  for (const { code, sort_order } of previous) {
    const n = await knex('navigation_node').select('id').where({ code }).first()
    if (n) await knex('navigation_node').where({ id: n.id }).update({ sort_order })
  }
}
