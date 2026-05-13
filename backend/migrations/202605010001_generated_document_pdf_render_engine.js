/**
 * POC: trazabilidad del motor con el que se generó el PDF (pdf_lib vs react_pdf)
 */

exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('generated_document')
  if (!has) return
  await knex.schema.alterTable('generated_document', (table) => {
    table.string('pdf_render_engine', 32).nullable()
  })
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('generated_document')
  if (!has) return
  const hasCol = await knex.schema.hasColumn('generated_document', 'pdf_render_engine')
  if (hasCol) {
    await knex.schema.alterTable('generated_document', (table) => {
      table.dropColumn('pdf_render_engine')
    })
  }
}
