/**
 * Domicilio del trabajador: dirección, comuna, ciudad.
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
  await add('address')
  await add('commune')
  await add('city')
}

exports.down = async function down(knex) {
  for (const col of ['city', 'commune', 'address']) {
    const has = await knex.schema.hasColumn('employee', col)
    if (has) {
      await knex.schema.alterTable('employee', (table) => {
        table.dropColumn(col)
      })
    }
  }
}
