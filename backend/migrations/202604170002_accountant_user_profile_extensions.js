/**
 * Contadores: datos de identidad en user_profile, domicilio y estado en accountant.
 *
 * Mapeo negocio → columnas (inglés snake_case):
 * - Dirección → accountant.address
 * - Comuna    → accountant.commune
 * - Ciudad    → accountant.city
 *
 * Nota histórica: esta migración añadió `accountant.is_active`; el estado activo se unificó
 * luego en `user_profile.is_active` y la columna en `accountant` se elimina en `202604180002_drop_accountant_is_active.js`.
 * (usuario contador no puede operar en la app mientras esté inactivo).
 */

async function addColumnIfMissing(knex, tableName, columnName, addCb) {
  const exists = await knex.schema.hasColumn(tableName, columnName)
  if (exists) return
  await knex.schema.alterTable(tableName, addCb)
}

exports.up = async function up(knex) {
  await addColumnIfMissing(knex, 'user_profile', 'full_name', (table) => {
    table.text('full_name').nullable()
  })
  await addColumnIfMissing(knex, 'user_profile', 'phone', (table) => {
    table.text('phone').nullable()
  })
  await addColumnIfMissing(knex, 'user_profile', 'rut_body', (table) => {
    table.text('rut_body').nullable()
  })
  await addColumnIfMissing(knex, 'user_profile', 'rut_dv', (table) => {
    table.text('rut_dv').nullable()
  })
  await addColumnIfMissing(knex, 'user_profile', 'must_change_password', (table) => {
    table.boolean('must_change_password').notNullable().defaultTo(false)
  })

  await addColumnIfMissing(knex, 'accountant', 'address', (table) => {
    table.text('address').nullable()
  })
  await addColumnIfMissing(knex, 'accountant', 'commune', (table) => {
    table.text('commune').nullable()
  })
  await addColumnIfMissing(knex, 'accountant', 'city', (table) => {
    table.text('city').nullable()
  })
  await addColumnIfMissing(knex, 'accountant', 'is_active', (table) => {
    table.boolean('is_active').notNullable().defaultTo(true)
  })
}

exports.down = async function down(knex) {
  const dropIf = async (table, col) => {
    if (await knex.schema.hasColumn(table, col)) {
      await knex.schema.alterTable(table, (t) => t.dropColumn(col))
    }
  }
  await dropIf('accountant', 'is_active')
  await dropIf('accountant', 'city')
  await dropIf('accountant', 'commune')
  await dropIf('accountant', 'address')
  await dropIf('user_profile', 'must_change_password')
  await dropIf('user_profile', 'rut_dv')
  await dropIf('user_profile', 'rut_body')
  await dropIf('user_profile', 'phone')
  await dropIf('user_profile', 'full_name')
}
