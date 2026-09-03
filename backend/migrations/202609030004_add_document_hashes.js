/**
 * Add SHA-256 hashes for draft body and signed body.
 */

exports.up = async function up(knex) {
  const hasDoc = await knex.schema.hasTable('document')
  if (!hasDoc) return

  const hasDraftSha = await knex.schema.hasColumn('document', 'draft_sha256')
  const hasSignedSha = await knex.schema.hasColumn('document', 'signed_sha256')
  if (hasDraftSha && hasSignedSha) return

  await knex.schema.alterTable('document', (table) => {
    if (!hasDraftSha) table.text('draft_sha256').nullable()
    if (!hasSignedSha) table.text('signed_sha256').nullable()
  })
}

exports.down = async function down(knex) {
  const hasDoc = await knex.schema.hasTable('document')
  if (!hasDoc) return

  const hasDraftSha = await knex.schema.hasColumn('document', 'draft_sha256')
  const hasSignedSha = await knex.schema.hasColumn('document', 'signed_sha256')

  if (!hasDraftSha && !hasSignedSha) return

  await knex.schema.alterTable('document', (table) => {
    if (hasDraftSha) table.dropColumn('draft_sha256')
    if (hasSignedSha) table.dropColumn('signed_sha256')
  })
}

