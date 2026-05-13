/**
 * Remove operational status from `company` (Activa/Inactiva/Borrador at DB level).
 * Drops index first, then column.
 */

exports.up = async function up(knex) {
  const hasColumn = await knex.schema.hasColumn('company', 'status')
  if (!hasColumn) return

  const idxRows = await knex
    .select('indexname')
    .from('pg_indexes')
    .where({ schemaname: 'public', tablename: 'company', indexname: 'company_status_idx' })
  if ((idxRows?.length ?? 0) > 0) {
    await knex.raw('DROP INDEX IF EXISTS company_status_idx')
  }

  await knex.schema.alterTable('company', (table) => {
    table.dropColumn('status')
  })
}

exports.down = async function down(knex) {
  const hasColumn = await knex.schema.hasColumn('company', 'status')
  if (hasColumn) return

  await knex.schema.alterTable('company', (table) => {
    table.text('status').notNullable().defaultTo('draft')
  })

  await knex.schema.alterTable('company', (table) => {
    table.index(['status'], 'company_status_idx')
  })
}
