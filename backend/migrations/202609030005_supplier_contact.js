/**
 * Contacto del proveedor: email y teléfono en la tabla base (común a ambos subtipos CTI).
 * Nullable para no romper las filas existentes. Sin UNIQUE sobre email.
 */

exports.up = async function up(knex) {
  const hasSupplier = await knex.schema.hasTable('supplier')
  if (!hasSupplier) return

  const hasEmail = await knex.schema.hasColumn('supplier', 'email')
  const hasPhone = await knex.schema.hasColumn('supplier', 'phone')
  if (hasEmail && hasPhone) return

  await knex.schema.alterTable('supplier', (table) => {
    if (!hasEmail) table.text('email').nullable()
    if (!hasPhone) table.text('phone').nullable()
  })
}

exports.down = async function down(knex) {
  const hasSupplier = await knex.schema.hasTable('supplier')
  if (!hasSupplier) return

  const hasEmail = await knex.schema.hasColumn('supplier', 'email')
  const hasPhone = await knex.schema.hasColumn('supplier', 'phone')
  if (!hasEmail && !hasPhone) return

  await knex.schema.alterTable('supplier', (table) => {
    if (hasEmail) table.dropColumn('email')
    if (hasPhone) table.dropColumn('phone')
  })
}
