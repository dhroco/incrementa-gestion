/**
 * Store the materialized Tiptap document used to render the draft PDF.
 * Needed to re-render deterministically at sign time.
 */

exports.up = async function up(knex) {
  const hasDraft = await knex.schema.hasTable('draft_document')
  if (!hasDraft) return

  const hasCol = await knex.schema.hasColumn('draft_document', 'content_snapshot')
  if (hasCol) return

  await knex.schema.alterTable('draft_document', (table) => {
    table.jsonb('content_snapshot').nullable()
  })
}

exports.down = async function down(knex) {
  const hasDraft = await knex.schema.hasTable('draft_document')
  if (!hasDraft) return

  const hasCol = await knex.schema.hasColumn('draft_document', 'content_snapshot')
  if (!hasCol) return

  await knex.schema.alterTable('draft_document', (table) => {
    table.dropColumn('content_snapshot')
  })
}

