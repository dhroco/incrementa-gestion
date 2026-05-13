/**
 * Phase C: universal clause codes MUST be NOT NULL and UNIQUE.
 *
 * Previous Phase B allowed NULL codes (unique only when provided).
 * This migration:
 * - backfills NULL/blank codes for existing clause_universal rows
 * - resolves duplicates deterministically
 * - enforces NOT NULL
 * - replaces partial unique index with full unique index
 */

exports.up = async function up(knex) {
  // 1) Normalize blanks to NULL first (avoid empty-string edge cases).
  await knex.raw(`
    UPDATE public.clause_universal
    SET code = NULL
    WHERE code IS NOT NULL AND btrim(code) = '';
  `)

  // IMPORTANT: existing partial unique index can block intermediate backfills/dedup.
  // Drop it early, then recreate a full unique index after we normalize.
  await knex.raw('DROP INDEX IF EXISTS public.ux_clause_universal_code_not_null;')

  // 2) Backfill missing universal codes.
  // IMPORTANT: Phase B trigger enforces clause.code == clause_universal.code when both non-NULL.
  // Therefore:
  // - If parent clause.code exists, use it as source of truth for clause_universal.code.
  // - If both are NULL, generate a deterministic code and set parent first, then child.

  // 2.a) Prefer parent code when present (avoids trigger mismatch errors).
  await knex.raw(`
    UPDATE public.clause_universal cu
    SET code = c.code
    FROM public.clause c
    WHERE cu.id = c.id
      AND cu.code IS NULL
      AND c.code IS NOT NULL
      AND btrim(c.code) <> '';
  `)

  // 2.b) For remaining NULLs, generate code and update parent then child.
  await knex.raw(`
    WITH missing AS (
      SELECT
        cu.id,
        'CLAUSE_UNIV_' || upper(replace(substring(cu.id::text, 1, 8), '-', '')) AS new_code
      FROM public.clause_universal cu
      JOIN public.clause c ON c.id = cu.id
      WHERE cu.code IS NULL
        AND (c.code IS NULL OR btrim(c.code) = '')
    )
    UPDATE public.clause c
    SET code = m.new_code
    FROM missing m
    WHERE c.id = m.id;
  `)

  await knex.raw(`
    WITH missing AS (
      SELECT
        cu.id,
        'CLAUSE_UNIV_' || upper(replace(substring(cu.id::text, 1, 8), '-', '')) AS new_code
      FROM public.clause_universal cu
      WHERE cu.code IS NULL
    )
    UPDATE public.clause_universal cu
    SET code = m.new_code
    FROM missing m
    WHERE cu.id = m.id;
  `)

  // 3) Resolve duplicates deterministically: keep the first by id, suffix others with id prefix.
  // Update parent clause.code first, then clause_universal.code to satisfy trigger.
  await knex.raw(`
    WITH d AS (
      SELECT
        id,
        code,
        row_number() OVER (PARTITION BY code ORDER BY id) AS rn
      FROM public.clause_universal
      WHERE code IS NOT NULL
    ),
    fix AS (
      SELECT
        id,
        code AS old_code,
        code || '_' || upper(replace(substring(id::text, 1, 6), '-', '')) AS new_code
      FROM d
      WHERE rn > 1
    )
    UPDATE public.clause c
    SET code = f.new_code
    FROM fix f
    WHERE c.id = f.id;
  `)

  await knex.raw(`
    WITH d AS (
      SELECT
        id,
        code,
        row_number() OVER (PARTITION BY code ORDER BY id) AS rn
      FROM public.clause_universal
      WHERE code IS NOT NULL
    ),
    fix AS (
      SELECT
        id,
        code || '_' || upper(replace(substring(id::text, 1, 6), '-', '')) AS new_code
      FROM d
      WHERE rn > 1
    )
    UPDATE public.clause_universal cu
    SET code = f.new_code
    FROM fix f
    WHERE cu.id = f.id;
  `)

  // 4) Create full unique index.
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_clause_universal_code
    ON public.clause_universal (code);
  `)

  // 5) Enforce NOT NULL at column level.
  await knex.raw(`
    ALTER TABLE public.clause_universal
    ALTER COLUMN code SET NOT NULL;
  `)
}

exports.down = async function down(knex) {
  // Relax NOT NULL and restore partial unique index.
  await knex.raw(`
    ALTER TABLE public.clause_universal
    ALTER COLUMN code DROP NOT NULL;
  `)

  await knex.raw('DROP INDEX IF EXISTS public.ux_clause_universal_code;')

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_clause_universal_code_not_null
    ON public.clause_universal (code)
    WHERE code IS NOT NULL;
  `)
}

