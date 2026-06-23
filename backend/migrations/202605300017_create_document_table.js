/**
 * Contract registry (GCS-backed). Replaces legacy GFA `document` table.
 */

exports.up = async function up(knex) {
  await knex.schema.dropTableIfExists('document')

  await knex.schema.createTable('document', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table
      .uuid('draft_document_id')
      .nullable()
      .references('id')
      .inTable('draft_document')
      .onDelete('SET NULL')
    table
      .uuid('supplier_id')
      .notNullable()
      .references('id')
      .inTable('supplier')
      .onDelete('CASCADE')
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    table.text('gcs_path').notNullable()
    table.text('file_name').notNullable()
    table.string('source', 32).notNullable()
    table
      .uuid('template_id')
      .nullable()
      .references('id')
      .inTable('template')
      .onDelete('SET NULL')
    table.text('document_type').nullable()
    table.timestamp('signed_at', { useTz: true }).nullable()
    table.text('signed_by').nullable()
    table.date('effective_from').nullable()
    table.date('effective_until').nullable()
    table.integer('duration_months').nullable()
    table.timestamp('archived_at', { useTz: true }).nullable()
    table
      .uuid('uploaded_by')
      .nullable()
      .references('id')
      .inTable('user_profile')
      .onDelete('SET NULL')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index(['supplier_id'])
    table.index(['company_id'])
    table.index(['source'])
  })

  await knex.raw(`
    ALTER TABLE document
    ADD CONSTRAINT document_source_check
    CHECK (source IN ('generated', 'uploaded'))
  `)
}

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('document')
}
