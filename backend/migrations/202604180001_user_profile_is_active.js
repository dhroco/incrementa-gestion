/**
 * Activo/Inactivo a nivel de identidad para perfiles que no usan tabla `accountant`.
 * Copia inicial desde `accountant.is_active` hacia `user_profile`; la fuente de verdad
 * final es `user_profile.is_active` (ver `202604180002_drop_accountant_is_active.js`).
 */

async function addColumnIfMissing(knex, tableName, columnName, addCb) {
  const exists = await knex.schema.hasColumn(tableName, columnName)
  if (exists) return
  await knex.schema.alterTable(tableName, addCb)
}

exports.up = async function up(knex) {
  await addColumnIfMissing(knex, 'user_profile', 'is_active', (table) => {
    table.boolean('is_active').notNullable().defaultTo(true)
  })

  // Alinear contadores existentes: si hay fila accountant, reflejar su is_active
  const hasAccountant = await knex.schema.hasTable('accountant')
  if (hasAccountant) {
    await knex.raw(`
      update user_profile up
      set is_active = a.is_active
      from accountant a
      where a.id = up.id
    `)
  }
}

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn('user_profile', 'is_active')) {
    await knex.schema.alterTable('user_profile', (table) => table.dropColumn('is_active'))
  }
}
