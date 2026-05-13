/**
 * Descripción opcional del cargo (además de name, añadida en 202604260001).
 */

exports.up = async function up(knex) {
  const has = await knex.schema.hasColumn('position', 'description')
  if (!has) {
    await knex.schema.alterTable('position', (table) => {
      table.text('description').nullable()
    })
  }
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasColumn('position', 'description')
  if (has) {
    await knex.schema.alterTable('position', (table) => {
      table.dropColumn('description')
    })
  }
}
