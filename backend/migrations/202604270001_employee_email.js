/**
 * Contact email for each employee (identificación).
 */

exports.up = async function up(knex) {
  const has = await knex.schema.hasColumn('employee', 'email')
  if (!has) {
    await knex.schema.alterTable('employee', (table) => {
      table.text('email').nullable()
    })
  }
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasColumn('employee', 'email')
  if (has) {
    await knex.schema.alterTable('employee', (table) => {
      table.dropColumn('email')
    })
  }
}
