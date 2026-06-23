/**
 * Draft contracts: PDF bytes in GCS, metadata in PostgreSQL.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('draft_document', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table
      .uuid('template_id')
      .notNullable()
      .references('id')
      .inTable('template')
      .onDelete('RESTRICT')
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
    table.string('status', 32).notNullable().defaultTo('draft')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table
      .uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('user_profile')
      .onDelete('RESTRICT')
    table.timestamp('expires_at', { useTz: true }).nullable()
    table.index(['supplier_id'])
    table.index(['company_id'])
    table.index(['status'])
  })
}

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('draft_document')
}
