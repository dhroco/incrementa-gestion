/**
 * Enforce company.business_name NOT NULL.
 *
 * Safe strategy:
 * - Normalize blanks to NULL.
 * - Backfill NULLs with deterministic placeholder (based on RUT when present).
 * - Enforce NOT NULL.
 */

exports.up = async function up(knex) {
  const hasCompany = await knex.schema.hasTable('company')
  if (!hasCompany) throw new Error('Missing required table: company')

  const hasBusinessName = await knex.schema.hasColumn('company', 'business_name')
  if (!hasBusinessName) {
    // Defensive: older envs must run enrich_company_model first.
    throw new Error('Missing required column: company.business_name')
  }

  // Treat blank/whitespace as NULL.
  await knex.raw(`
    UPDATE public.company
    SET business_name = NULL
    WHERE business_name IS NOT NULL
      AND btrim(business_name) = '';
  `)

  // Backfill NULLs.
  await knex.raw(`
    UPDATE public.company
    SET business_name =
      CASE
        WHEN rut_body IS NOT NULL AND btrim(rut_body) <> ''
          THEN ('Empresa ' || rut_body || COALESCE('-' || rut_dv, ''))
        ELSE ('Empresa ' || id::text)
      END
    WHERE business_name IS NULL;
  `)

  await knex.schema.alterTable('company', (table) => {
    table.text('business_name').notNullable().alter()
  })
}

exports.down = async function down(knex) {
  const hasCompany = await knex.schema.hasTable('company')
  if (!hasCompany) return
  const hasBusinessName = await knex.schema.hasColumn('company', 'business_name')
  if (!hasBusinessName) return

  await knex.schema.alterTable('company', (table) => {
    table.text('business_name').nullable().alter()
  })
}

