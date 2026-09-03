/**
 * Backup Tiptap template content_json before applying signatureBlock wrapping.
 *
 * Used to ensure template migrations are reversible and auditable.
 */

exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable('template_content_backup')
  if (exists) return

  await knex.schema.createTable('template_content_backup', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table
      .uuid('template_id')
      .notNullable()
      .references('id')
      .inTable('template')
      .onDelete('CASCADE')
    table.jsonb('content_json').notNullable()
    table.text('note')
    table.timestamp('backed_up_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = async function down(knex) {
  const exists = await knex.schema.hasTable('template_content_backup')
  if (!exists) return

  await knex.schema.dropTable('template_content_backup')
}

