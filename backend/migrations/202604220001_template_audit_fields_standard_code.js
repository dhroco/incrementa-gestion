/**
 * Audit fields on `template` (parent row), optional `code` on `template_company`,
 * uniqueness of standard template codes (partial index on `template_standard` rows).
 */

exports.up = async function up(knex) {
  const hasTemplate = await knex.schema.hasTable('template')
  if (!hasTemplate) throw new Error('Missing table: template')

  if (!(await knex.schema.hasColumn('template', 'code'))) {
    await knex.schema.alterTable('template', (table) => {
      table.string('code', 100).nullable()
    })
  }

  for (const col of ['created_by', 'updated_by', 'last_edited_by']) {
    if (!(await knex.schema.hasColumn('template', col))) {
      await knex.schema.alterTable('template', (table) => {
        table
          .uuid(col)
          .nullable()
          .references('id')
          .inTable('user_profile')
          .onDelete('SET NULL')
      })
    }
  }

  if (await knex.schema.hasTable('template_company')) {
    if (!(await knex.schema.hasColumn('template_company', 'code'))) {
      await knex.schema.alterTable('template_company', (table) => {
        table.string('code', 100).nullable()
      })
    }
  }

  // Backfill standard template codes from stable id-derived values (unique, non-null).
  await knex.raw(`
    UPDATE template t
    SET code = 'PLANTILLA-' || upper(substring(replace(t.id::text, '-', ''), 1, 12))
    FROM template_standard ts
    WHERE ts.id = t.id
      AND (t.code IS NULL OR trim(t.code) = '')
  `)

  // Partial unique index: no subqueries allowed in the predicate (PostgreSQL).
  // Company templates keep `template.code` NULL; codes for por-empresa live on `template_company.code`.
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_template_standard_code_lower
    ON template (lower(trim(code)))
    WHERE code IS NOT NULL
      AND trim(code) <> ''
  `)

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_template_created_by ON template (created_by)
  `)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_template_last_edited_by ON template (last_edited_by)
  `)

  if (await knex.schema.hasTable('template_company')) {
    await knex.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_template_company_company_code_lower
      ON template_company (company_id, lower(trim(code)))
      WHERE code IS NOT NULL AND trim(code) <> ''
    `)
  }
}

exports.down = async function down(knex) {
  await knex.raw(`DROP INDEX IF EXISTS idx_template_standard_code_lower`)
  await knex.raw(`DROP INDEX IF EXISTS idx_template_created_by`)
  await knex.raw(`DROP INDEX IF EXISTS idx_template_last_edited_by`)
  if (await knex.schema.hasTable('template_company')) {
    await knex.raw(`DROP INDEX IF EXISTS idx_template_company_company_code_lower`)
  }

  const hasTemplate = await knex.schema.hasTable('template')
  if (hasTemplate) {
    for (const col of ['last_edited_by', 'updated_by', 'created_by', 'code']) {
      if (await knex.schema.hasColumn('template', col)) {
        await knex.schema.alterTable('template', (table) => {
          table.dropColumn(col)
        })
      }
    }
  }

  if (await knex.schema.hasTable('template_company')) {
    if (await knex.schema.hasColumn('template_company', 'code')) {
      await knex.schema.alterTable('template_company', (table) => {
        table.dropColumn('code')
      })
    }
  }
}
