/**
 * Drop company-scoped templates: remove generated_document.company_template_id
 * and table template_company.
 */

exports.up = async function up(knex) {
  const hasGeneratedDoc = await knex.schema.hasTable('generated_document')
  if (hasGeneratedDoc) {
    await knex.raw(`
      ALTER TABLE generated_document
      DROP CONSTRAINT IF EXISTS generated_document_one_template_ck
    `)
    const hasCol = await knex.schema.hasColumn('generated_document', 'company_template_id')
    if (hasCol) {
      await knex.schema.alterTable('generated_document', (table) => {
        table.dropColumn('company_template_id')
      })
    }
  }

  await knex.schema.dropTableIfExists('template_company')
}

exports.down = async function down(knex) {
  const hasTemplate = await knex.schema.hasTable('template')
  if (!hasTemplate) return

  if (!(await knex.schema.hasTable('template_company'))) {
    await knex.schema.createTable('template_company', (table) => {
      table
        .uuid('id')
        .primary()
        .references('id')
        .inTable('template')
        .onDelete('CASCADE')
      table
        .uuid('company_id')
        .notNullable()
        .references('id')
        .inTable('company')
        .onDelete('CASCADE')
      table.string('code', 100).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
      table.index(['company_id'])
    })

    await knex.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_template_company_company_code_lower
      ON template_company (company_id, lower(trim(code)))
      WHERE code IS NOT NULL AND trim(code) <> ''
    `)
  }

  const hasGeneratedDoc = await knex.schema.hasTable('generated_document')
  if (hasGeneratedDoc) {
    const hasCol = await knex.schema.hasColumn('generated_document', 'company_template_id')
    if (!hasCol) {
      await knex.schema.alterTable('generated_document', (table) => {
        table
          .uuid('company_template_id')
          .nullable()
          .references('id')
          .inTable('template_company')
          .onDelete('SET NULL')
      })
    }
    await knex.raw(`
      ALTER TABLE generated_document
      DROP CONSTRAINT IF EXISTS generated_document_one_template_ck
    `)
    await knex.raw(`
      ALTER TABLE generated_document
      ADD CONSTRAINT generated_document_one_template_ck
      CHECK (
        (standard_template_id IS NOT NULL AND company_template_id IS NULL)
        OR (standard_template_id IS NULL AND company_template_id IS NOT NULL)
      )
    `)
  }
}
