/**
 * Simplify template.status: remove draft, keep active and inactive only.
 * Migrates existing draft rows to inactive.
 */

exports.up = async function up(knex) {
  const hasTemplate = await knex.schema.hasTable('template')
  if (!hasTemplate) return

  await knex('template').where('status', 'draft').update({ status: 'inactive' })

  await knex.raw(`ALTER TABLE public.template DROP CONSTRAINT IF EXISTS template_status_check`)

  await knex.raw(`
    ALTER TABLE public.template
    ADD CONSTRAINT template_status_check
    CHECK (status IN ('active', 'inactive'))
  `)

  await knex.raw(`
    ALTER TABLE public.template
    ALTER COLUMN status SET DEFAULT 'inactive'
  `)
}

exports.down = async function down(knex) {
  const hasTemplate = await knex.schema.hasTable('template')
  if (!hasTemplate) return

  await knex.raw(`ALTER TABLE public.template DROP CONSTRAINT IF EXISTS template_status_check`)

  await knex.raw(`
    ALTER TABLE public.template
    ADD CONSTRAINT template_status_check
    CHECK (status IN ('draft', 'active', 'inactive'))
  `)

  await knex.raw(`
    ALTER TABLE public.template
    ALTER COLUMN status SET DEFAULT 'active'
  `)
}
