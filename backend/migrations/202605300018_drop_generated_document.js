/**
 * Remove legacy BYTEA storage for generated PDFs.
 */

exports.up = async function up(knex) {
  await knex.schema.dropTableIfExists('generated_document')
}

exports.down = async function down() {
  // Legacy table not recreated (BYTEA POC).
}
