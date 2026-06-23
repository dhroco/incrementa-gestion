/**
 * Correo de login almacenado en aplicación (sin depender de auth.users / Supabase).
 */

async function addColumnIfMissing(knex, tableName, columnName, addCb) {
  const exists = await knex.schema.hasColumn(tableName, columnName)
  if (exists) return
  await knex.schema.alterTable(tableName, addCb)
}

exports.up = async function up(knex) {
  await addColumnIfMissing(knex, 'user_profile', 'email', (table) => {
    table.text('email').nullable()
  })
}

exports.down = async function down(knex) {
  const exists = await knex.schema.hasColumn('user_profile', 'email')
  if (!exists) return
  await knex.schema.alterTable('user_profile', (table) => {
    table.dropColumn('email')
  })
}
