/**
 * Remove excess standard-template rows left from older / repeated seeds.
 *
 * Keeps at most the canonical seeded standards identified by `code`:
 *   PLANTILLA-SEED-01, PLANTILLA-SEED-02, PLANTILLA-SEED-03
 *
 * Targets only rows in `template_standard` whose parent `template.created_by` is NULL
 * (legacy seed / pre-audit inserts), so manually created platform templates are not pruned.
 *
 * `document.template_id` is ON DELETE RESTRICT → delete those rows first.
 */

const KEEP_CODES = ['PLANTILLA-SEED-01', 'PLANTILLA-SEED-02', 'PLANTILLA-SEED-03']

exports.up = async function up(knex) {
  const hasTemplate = await knex.schema.hasTable('template')
  const hasStandard = await knex.schema.hasTable('template_standard')
  if (!hasTemplate || !hasStandard) return

  await knex.raw(
    `
    DELETE FROM document d
    WHERE EXISTS (
      SELECT 1
      FROM template t
      INNER JOIN template_standard ts ON ts.id = t.id
      WHERE t.id = d.template_id
        AND t.created_by IS NULL
        AND (t.code IS NULL OR t.code NOT IN (?, ?, ?))
    )
  `,
    KEEP_CODES
  )

  await knex.raw(
    `
    DELETE FROM template t
    USING template_standard ts
    WHERE t.id = ts.id
      AND t.created_by IS NULL
      AND (t.code IS NULL OR t.code NOT IN (?, ?, ?))
  `,
    KEEP_CODES
  )
}

exports.down = async function down() {
  // Data deletion is not reversible.
}
