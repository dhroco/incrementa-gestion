/**
 * Persist resolved contract overrides for query/filter and client on signed documents.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('draft_document', (table) => {
    table.jsonb('contract_overrides').nullable()
  })

  await knex.schema.alterTable('document', (table) => {
    table.jsonb('contract_overrides').nullable()
    table.uuid('client_id').nullable().references('id').inTable('client').onDelete('SET NULL')
  })

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_draft_document_contract_overrides
    ON draft_document USING gin(contract_overrides)
  `)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_document_contract_overrides
    ON document USING gin(contract_overrides)
  `)
}

exports.down = async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_draft_document_contract_overrides')
  await knex.raw('DROP INDEX IF EXISTS idx_document_contract_overrides')

  await knex.schema.alterTable('draft_document', (table) => {
    table.dropColumn('contract_overrides')
  })

  await knex.schema.alterTable('document', (table) => {
    table.dropColumn('contract_overrides')
    table.dropColumn('client_id')
  })
}
