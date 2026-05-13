/**
 * Add template.status with allowed values and default.
 *
 * Needed to define "active template" for clause inactivation rules.
 */

exports.up = async function up(knex) {
  const hasTemplate = await knex.schema.hasTable('template')
  if (!hasTemplate) throw new Error('Missing required table: template')

  const hasColumn = await knex.schema.hasColumn('template', 'status')
  if (!hasColumn) {
    await knex.schema.alterTable('template', (table) => {
      table.text('status').notNullable().defaultTo('active')
    })
  }

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'template_status_check'
      ) THEN
        ALTER TABLE public.template
        ADD CONSTRAINT template_status_check
        CHECK (status IN ('draft', 'active', 'inactive'));
      END IF;
    END
    $$;
  `)

  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_template_status ON public.template (status)`)
}

exports.down = async function down(knex) {
  const hasTemplate = await knex.schema.hasTable('template')
  if (!hasTemplate) return

  await knex.raw('DROP INDEX IF EXISTS public.idx_template_status')
  await knex.raw(`ALTER TABLE public.template DROP CONSTRAINT IF EXISTS template_status_check;`)

  const hasColumn = await knex.schema.hasColumn('template', 'status')
  if (hasColumn) {
    await knex.schema.alterTable('template', (table) => {
      table.dropColumn('status')
    })
  }
}

