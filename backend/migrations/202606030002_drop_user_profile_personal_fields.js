exports.up = async (knex) => {
  for (const column of ['phone', 'rut_body', 'rut_dv']) {
    const hasColumn = await knex.schema.hasColumn('user_profile', column)
    if (hasColumn) {
      await knex.schema.alterTable('user_profile', (table) => {
        table.dropColumn(column)
      })
    }
  }
}

exports.down = async (knex) => {
  const addColumnIfMissing = async (columnName) => {
    const hasColumn = await knex.schema.hasColumn('user_profile', columnName)
    if (!hasColumn) {
      await knex.schema.alterTable('user_profile', (table) => {
        table.text(columnName).nullable()
      })
    }
  }

  await addColumnIfMissing('phone')
  await addColumnIfMissing('rut_body')
  await addColumnIfMissing('rut_dv')
}
