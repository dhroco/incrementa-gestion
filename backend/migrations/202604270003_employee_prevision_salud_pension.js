/**
 * Previsión: salud y fondo de pensión (texto libre, p. ej. isapre/AFP).
 */

exports.up = async function up(knex) {
  const add = async (col) => {
    const has = await knex.schema.hasColumn('employee', col)
    if (!has) {
      await knex.schema.alterTable('employee', (table) => {
        table.text(col).nullable()
      })
    }
  }
  await add('prevision_salud')
  await add('fondo_pension')
}

exports.down = async function down(knex) {
  for (const col of ['fondo_pension', 'prevision_salud']) {
    const has = await knex.schema.hasColumn('employee', col)
    if (has) {
      await knex.schema.alterTable('employee', (table) => {
        table.dropColumn(col)
      })
    }
  }
}
