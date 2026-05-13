/**
 * Fixes company clause code uniqueness when clause_company.code was NULL:
 * the partial unique index (WHERE code IS NOT NULL) did not apply, while the UI
 * lists clause.code from the parent — allowing duplicate visible codes per company.
 *
 * - Backfill clause_company.code from clause
 * - Resolve duplicate (company_id, code) groups by renaming newer rows
 * - NOT NULL on clause_company.code + full unique (company_id, code)
 * - Trigger: after clause.code update, sync clause_company.code
 */

exports.up = async function up(knex) {
  // 0) Drop partial unique index first — backfill can assign the same (company_id, code) that another
  //    row already has, which would violate the index until we dedupe in step 3.
  await knex.raw('DROP INDEX IF EXISTS public.ux_clause_company_company_id_code_not_null')
  await knex.raw('DROP INDEX IF EXISTS public.ux_clause_company_company_id_code')

  // 1) Align child from parent wherever child is missing code
  await knex.raw(`
    UPDATE public.clause_company AS cc
    SET code = c.code
    FROM public.clause AS c
    WHERE c.id = cc.id
      AND cc.code IS NULL
      AND c.code IS NOT NULL
  `)

  // 2) Any remaining NULL: deterministic placeholder (must be unique per row before NOT NULL + unique)
  const stillNull = await knex('clause_company as cc')
    .join('clause as c', 'c.id', 'cc.id')
    .select('cc.id', 'cc.company_id')
    .whereNull('cc.code')

  for (const row of stillNull) {
    const suffix = String(row.id).replace(/-/g, '').slice(0, 8)
    let candidate = `PENDING_${suffix}`
    for (let n = 0; n < 200; n += 1) {
      const tryCode = n === 0 ? candidate : `PENDING_${suffix}_${n}`
      const exists = await knex('clause_company')
        .where({ company_id: row.company_id, code: tryCode })
        .whereNot({ id: row.id })
        .first()
      if (!exists) {
        candidate = tryCode
        break
      }
      if (n === 199) {
        throw new Error('Could not allocate unique placeholder code for clause_company')
      }
    }
    // Parent row must be updated first: trg_clause_company_sync_code rejects child UPDATE
    // when clause.code and new clause_company.code differ.
    await knex('clause').where({ id: row.id }).update({ code: candidate })
    await knex('clause_company').where({ id: row.id }).update({ code: candidate })
  }

  // 3) Deduplicate (company_id, code) with multiple rows — keep oldest by updated_at, rename others
  const dupGroups = await knex.raw(`
    SELECT cc.company_id, cc.code, array_agg(cc.id ORDER BY c.updated_at ASC, cc.id ASC) AS ids
    FROM public.clause_company cc
    INNER JOIN public.clause c ON c.id = cc.id
    WHERE cc.code IS NOT NULL
    GROUP BY cc.company_id, cc.code
    HAVING COUNT(*) > 1
  `)

  const rows = dupGroups.rows ?? []
  for (const g of rows) {
    const ids = g.ids
    if (!Array.isArray(ids) || ids.length < 2) continue
    const [, ...rest] = ids
    const base = String(g.code)

    for (const id of rest) {
      const suffix = String(id).replace(/-/g, '').slice(0, 8)
      let chosen = `${base}_${suffix}`
      for (let n = 0; n < 200; n += 1) {
        const tryCode = n === 0 ? chosen : `${base}_${suffix}_${n}`
        const clash = await knex('clause_company')
          .where({ company_id: g.company_id, code: tryCode })
          .whereNot({ id })
          .first()
        if (!clash) {
          chosen = tryCode
          break
        }
        if (n === 199) {
          throw new Error('Could not allocate unique code for duplicate clause_company row')
        }
      }
      await knex('clause').where({ id }).update({ code: chosen })
      await knex('clause_company').where({ id }).update({ code: chosen })
    }
  }

  // 4) NOT NULL (all rows should have code now)
  await knex.raw('ALTER TABLE public.clause_company ALTER COLUMN code SET NOT NULL')

  // 5) Full unique index (indexes dropped at start; do not drop again here)
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_clause_company_company_id_code
    ON public.clause_company (company_id, code)
  `)

  // 6) Keep clause.code in sync when parent is updated outside clause_company (e.g. seeds)
  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.sync_clause_code_to_clause_company()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM public.clause_company WHERE id = NEW.id) THEN
        UPDATE public.clause_company
        SET code = NEW.code
        WHERE id = NEW.id
          AND (code IS DISTINCT FROM NEW.code);
      END IF;
      RETURN NEW;
    END;
    $$;
  `)

  await knex.raw(`
    DROP TRIGGER IF EXISTS trg_clause_sync_code_to_company ON public.clause;
    CREATE TRIGGER trg_clause_sync_code_to_company
    AFTER UPDATE OF code ON public.clause
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_clause_code_to_clause_company();
  `)
}

exports.down = async function down(knex) {
  await knex.raw('DROP TRIGGER IF EXISTS trg_clause_sync_code_to_company ON public.clause;')
  await knex.raw('DROP FUNCTION IF EXISTS public.sync_clause_code_to_clause_company();')

  await knex.raw('DROP INDEX IF EXISTS public.ux_clause_company_company_id_code')

  await knex.raw('ALTER TABLE public.clause_company ALTER COLUMN code DROP NOT NULL')

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_clause_company_company_id_code_not_null
    ON public.clause_company (company_id, code)
    WHERE code IS NOT NULL;
  `)
}
