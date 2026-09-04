/**
 * País del proveedor: ISO-3166-1 alfa-2.
 * varchar(2) + CHECK (no char(2): PostgreSQL paddea espacios).
 * Sin DEFAULT. Backfill CL → NOT NULL.
 */

const CHECK_NAME = 'supplier_country_code_check'

exports.up = async function up(knex) {
  await knex.schema.alterTable('supplier', (table) => {
    table.string('country_code', 2).nullable()
  })

  await knex('supplier').update({ country_code: 'CL' })

  await knex.raw(`
    ALTER TABLE supplier
    ADD CONSTRAINT ${CHECK_NAME}
    CHECK (country_code ~ '^[A-Z]{2}$')
  `)

  await knex.raw(`ALTER TABLE supplier ALTER COLUMN country_code SET NOT NULL`)
}

exports.down = async function down(knex) {
  await knex.raw(`ALTER TABLE supplier DROP CONSTRAINT IF EXISTS ${CHECK_NAME}`)
  await knex.schema.alterTable('supplier', (table) => {
    table.dropColumn('country_code')
  })
}
