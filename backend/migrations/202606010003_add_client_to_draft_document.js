/**
 * Referencia opcional al cliente en borradores de contrato.
 */

exports.up = async function up(knex) {
  await knex.schema.alterTable('draft_document', (table) => {
    table.uuid('client_id').nullable().references('id').inTable('client').onDelete('SET NULL')
    table.index(['client_id'])
  })
}

exports.down = async function down(knex) {
  await knex.schema.alterTable('draft_document', (table) => {
    table.dropIndex(['client_id'])
    table.dropColumn('client_id')
  })
}
