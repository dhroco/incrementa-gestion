/**
 * Activo/Inactivo unificado en user_profile: elimina duplicación en accountant.
 * Antes de DROP, alinea user_profile.is_active desde accountant.is_active (última reconciliación).
 */

exports.up = async function up(knex) {
  const hasAccountant = await knex.schema.hasTable('accountant')
  const hasAccActive = hasAccountant && (await knex.schema.hasColumn('accountant', 'is_active'))
  const hasUpActive = await knex.schema.hasColumn('user_profile', 'is_active')

  if (hasAccActive && hasUpActive) {
    await knex.raw(`
      update user_profile up
      set is_active = a.is_active
      from accountant a
      where a.id = up.id
    `)
  }

  if (hasAccActive) {
    await knex.schema.alterTable('accountant', (table) => {
      table.dropColumn('is_active')
    })
  }
}

exports.down = async function down(knex) {
  const hasAccActive = await knex.schema.hasColumn('accountant', 'is_active')
  if (!hasAccActive) {
    await knex.schema.alterTable('accountant', (table) => {
      table.boolean('is_active').notNullable().defaultTo(true)
    })
    const hasUpActive = await knex.schema.hasColumn('user_profile', 'is_active')
    if (hasUpActive) {
      await knex.raw(`
        update accountant a
        set is_active = up.is_active
        from user_profile up
        where up.id = a.id
      `)
    }
  }
}
