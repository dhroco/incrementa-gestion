/**
 * Business fields for contract templates (shared `template` row).
 * Standard templates use `content_json` with the same TipTap doc shape as clauses.
 */

const MIN_DOC = { type: 'doc', content: [{ type: 'paragraph', content: [] }] }

exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('template')
  if (!has) throw new Error('Missing table: template')

  if (!(await knex.schema.hasColumn('template', 'name'))) {
    await knex.schema.alterTable('template', (table) => {
      table.text('name').nullable()
      table.text('description').nullable()
      table.jsonb('content_json').nullable()
    })
  }

  await knex('template').whereNull('name').update({ name: 'Plantilla (semilla)' })
  await knex('template').whereNull('content_json').update({ content_json: JSON.stringify(MIN_DOC) })

  await knex.raw(`
    ALTER TABLE public.template
    ALTER COLUMN name SET NOT NULL
  `)
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('template')
  if (!has) return

  await knex.raw(`ALTER TABLE public.template ALTER COLUMN name DROP NOT NULL`)

  if (await knex.schema.hasColumn('template', 'content_json')) {
    await knex.schema.alterTable('template', (table) => {
      table.dropColumn('content_json')
    })
  }
  if (await knex.schema.hasColumn('template', 'description')) {
    await knex.schema.alterTable('template', (table) => {
      table.dropColumn('description')
    })
  }
  if (await knex.schema.hasColumn('template', 'name')) {
    await knex.schema.alterTable('template', (table) => {
      table.dropColumn('name')
    })
  }
}
