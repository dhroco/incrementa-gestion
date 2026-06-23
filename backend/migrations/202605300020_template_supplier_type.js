/**
 * Template supplier_type: persona_natural | empresa.
 * Cleans PLANTILLA-* dev seeds, backfills PL0001, then NOT NULL + check.
 */

async function deleteTemplatesByCodePattern(knex, pattern) {
  const ids = await knex('template').pluck('id').where('code', 'ilike', pattern)
  const toRemove = [...new Set(ids)]
  if (toRemove.length === 0) return

  if (await knex.schema.hasTable('draft_document')) {
    await knex('draft_document').whereIn('template_id', toRemove).del()
  }
  if (await knex.schema.hasTable('document')) {
    const hasCol = await knex.schema.hasColumn('document', 'template_id')
    if (hasCol) {
      await knex('document').whereIn('template_id', toRemove).del()
    }
  }
  await knex('template_standard').whereIn('id', toRemove).del()
  await knex('template').whereIn('id', toRemove).del()
}

exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('template')
  if (!has) throw new Error('Missing table: template')

  if (!(await knex.schema.hasColumn('template', 'supplier_type'))) {
    await knex.schema.alterTable('template', (table) => {
      table.text('supplier_type').nullable()
    })
  }

  await deleteTemplatesByCodePattern(knex, 'PLANTILLA-%')

  await knex('template').where({ code: 'PL0001' }).update({ supplier_type: 'empresa' })

  // Leftover parent rows from dropped company templates (not in template_standard).
  const standardIds = await knex('template_standard').pluck('id')
  if (standardIds.length > 0) {
    await knex('template').whereNotIn('id', standardIds).del()
  }

  await knex.raw(`ALTER TABLE public.template ALTER COLUMN supplier_type SET NOT NULL`)

  await knex.raw(`
    ALTER TABLE public.template
    DROP CONSTRAINT IF EXISTS template_supplier_type_check
  `)
  await knex.raw(`
    ALTER TABLE public.template
    ADD CONSTRAINT template_supplier_type_check
    CHECK (supplier_type IN ('persona_natural', 'empresa'))
  `)
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('template')
  if (!has) return

  await knex.raw(`
    ALTER TABLE public.template
    DROP CONSTRAINT IF EXISTS template_supplier_type_check
  `)

  if (await knex.schema.hasColumn('template', 'supplier_type')) {
    await knex.schema.alterTable('template', (table) => {
      table.dropColumn('supplier_type')
    })
  }
}
