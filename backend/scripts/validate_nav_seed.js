const knexFactory = require('knex')
const knexConfig = require('../knexfile')

async function main() {
  const knex = knexFactory(knexConfig)
  try {
    const profiles = await knex('profile')
      .select('code')
      .whereIn('code', ['ADMINISTRADOR_PLATAFORMA'])
      .orderBy('code')

    const rootMenus = await knex('navigation_node')
      .select('code', 'label', 'sort_order', 'is_active', 'show_in_main_menu')
      .whereNull('parent_id')
      .where('code', 'like', 'NAV_MENU_%')
      .orderBy('sort_order')

    const orphans = await knex('navigation_node')
      .select('code', 'parent_id')
      .where('code', 'like', 'NAV_ITEM_%')
      .whereNotNull('parent_id')
      .whereNotIn('parent_id', knex('navigation_node').select('id'))
      .limit(10)

    const grantCounts = await knex('profile as p')
      .join('profile_navigation_grant as g', 'g.profile_id', 'p.id')
      .join('navigation_node as n', 'n.id', 'g.navigation_node_id')
      .whereIn('p.code', ['ADMINISTRADOR_PLATAFORMA'])
      .andWhere((qb) => qb.where('n.code', 'like', 'NAV_MENU_%').orWhere('n.code', 'like', 'NAV_ITEM_%'))
      .groupBy('p.code')
      .select('p.code')
      .count({ grants: 'g.navigation_node_id' })
      .orderBy('p.code')

    const admin = await knex('profile').select('id').where({ code: 'ADMINISTRADOR_PLATAFORMA' }).first()
    const legacyDash = await knex('navigation_node').select('id').where({ code: 'NAV_DASHBOARD' }).first()
    const hasLegacyDashboardGrant = Boolean(
      admin?.id &&
        legacyDash?.id &&
        (await knex('profile_navigation_grant')
          .select('profile_id')
          .where({ profile_id: admin.id, navigation_node_id: legacyDash.id })
          .first())
    )

    console.log(
      JSON.stringify({ profiles, rootMenus, orphans, grantCounts, hasLegacyDashboardGrant }, null, 2)
    )
  } finally {
    // eslint-disable-next-line no-unsafe-finally
    await knex.destroy()
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})

