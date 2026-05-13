/**
 * Enrich company model with business fields.
 *
 * Safe migration strategy:
 * - Adds columns only if missing (idempotent across partially applied envs).
 * - Adds a uniqueness constraint for rut (body+dv) if not present.
 */

async function addColumnIfMissing(knex, tableName, columnName, addCb) {
  const exists = await knex.schema.hasColumn(tableName, columnName)
  if (exists) return
  await knex.schema.alterTable(tableName, addCb)
}

async function hasUniqueOn(knex, tableName, indexName) {
  // Postgres: check pg_indexes for named index (covers both index/constraint-backed index)
  const rows = await knex
    .select('indexname')
    .from('pg_indexes')
    .where({ schemaname: 'public', tablename: tableName, indexname: indexName })
  return (rows?.length ?? 0) > 0
}

exports.up = async function up(knex) {
  await addColumnIfMissing(knex, 'company', 'business_name', (table) => {
    table.text('business_name').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'rut_body', (table) => {
    table.text('rut_body').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'rut_dv', (table) => {
    table.text('rut_dv').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'business_activity', (table) => {
    table.text('business_activity').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'address', (table) => {
    table.text('address').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'commune', (table) => {
    table.text('commune').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'city', (table) => {
    table.text('city').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'email', (table) => {
    table.text('email').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'phone', (table) => {
    table.text('phone').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'legal_representative_1', (table) => {
    table.text('legal_representative_1').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'legal_representative_2', (table) => {
    table.text('legal_representative_2').nullable()
  })
  await addColumnIfMissing(knex, 'company', 'status', (table) => {
    table.text('status').notNullable().defaultTo('draft')
  })

  // Named unique index for rut body+dv (case-insensitive DV).
  const idxName = 'company_rut_unique'
  const exists = await hasUniqueOn(knex, 'company', idxName)
  if (!exists) {
    await knex.schema.alterTable('company', (table) => {
      table.unique(['rut_body', 'rut_dv'], { indexName: idxName })
      table.index(['business_name'], 'company_business_name_idx')
      table.index(['status'], 'company_status_idx')
    })
  }
}

exports.down = async function down(knex) {
  // We avoid dropping columns (data-loss). Only drop added indexes if present.
  const idxName = 'company_rut_unique'
  const exists = await hasUniqueOn(knex, 'company', idxName)
  if (exists) {
    await knex.schema.alterTable('company', (table) => {
      table.dropUnique(['rut_body', 'rut_dv'], idxName)
      table.dropIndex(['business_name'], 'company_business_name_idx')
      table.dropIndex(['status'], 'company_status_idx')
    })
  }
}

