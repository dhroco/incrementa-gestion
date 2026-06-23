exports.up = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('user_profile', 'must_change_password')
  if (hasColumn) {
    await knex.schema.alterTable('user_profile', (table) => {
      table.dropColumn('must_change_password')
    })
  }
}

exports.down = async (knex) => {
  const hasColumn = await knex.schema.hasColumn('user_profile', 'must_change_password')
  if (!hasColumn) {
    await knex.schema.alterTable('user_profile', (table) => {
      table.boolean('must_change_password').notNullable().defaultTo(false)
    })
  }
}
