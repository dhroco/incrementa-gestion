/**
 * POC: persist generated PDF bytes per employee + template (no S3).
 * Table name `generated_document` avoids collision with existing `document` rows.
 */

exports.up = async function up(knex) {
  const hasEmployee = await knex.schema.hasTable('employee')
  if (!hasEmployee) throw new Error('expected employee table')

  await knex.schema.createTable('generated_document', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table
      .uuid('employee_id')
      .notNullable()
      .references('id')
      .inTable('employee')
      .onDelete('CASCADE')
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    table
      .uuid('standard_template_id')
      .nullable()
      .references('id')
      .inTable('template_standard')
      .onDelete('SET NULL')
    table
      .uuid('company_template_id')
      .nullable()
      .references('id')
      .inTable('template_company')
      .onDelete('SET NULL')
    table.text('file_name').notNullable()
    table.specificType('file_data', 'bytea').notNullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index(['company_id'])
    table.index(['employee_id'])
    table.index(['created_at'])
  })

  await knex.raw(`
    ALTER TABLE generated_document
    ADD CONSTRAINT generated_document_one_template_ck
    CHECK (
      (standard_template_id IS NOT NULL AND company_template_id IS NULL)
      OR (standard_template_id IS NULL AND company_template_id IS NOT NULL)
    )
  `)
}

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('generated_document')
}
