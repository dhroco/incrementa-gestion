/**
 * Phase B: enforce contextual uniqueness for clause code and add DB-level consistency helpers.
 *
 * Rules:
 * - Universal clauses: code unique globally (within clause_universal set).
 * - Company clauses: code unique per company (company_id, code).
 * - Allow code to be NULL (draft/incomplete), but enforce uniqueness when provided.
 */

exports.up = async function up(knex) {
  // Unique partial index for universal code (ignore NULL).
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_clause_universal_code_not_null
    ON public.clause_universal (code)
    WHERE code IS NOT NULL;
  `)

  // Unique partial composite index for company code per company (ignore NULL).
  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_clause_company_company_id_code_not_null
    ON public.clause_company (company_id, code)
    WHERE code IS NOT NULL;
  `)

  // Consistency trigger: keep clause.code and child.code aligned.
  // Convention:
  // - On INSERT/UPDATE of child rows:
  //   - If clause.code is NULL and child.code is not NULL, set clause.code = child.code.
  //   - If both are non-NULL and differ, raise error.
  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.sync_clause_code_from_child()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE parent_code text;
    BEGIN
      SELECT code INTO parent_code
      FROM public.clause
      WHERE id = NEW.id
      FOR UPDATE;

      IF parent_code IS NULL AND NEW.code IS NOT NULL THEN
        UPDATE public.clause
        SET code = NEW.code
        WHERE id = NEW.id;
        RETURN NEW;
      END IF;

      IF parent_code IS NOT NULL AND NEW.code IS NOT NULL AND parent_code <> NEW.code THEN
        RAISE EXCEPTION 'clause.code (%) differs from %.code (%) for clause_id=%',
          parent_code, TG_TABLE_NAME, NEW.code, NEW.id
          USING ERRCODE = '23514';
      END IF;

      RETURN NEW;
    END;
    $$;
  `)

  await knex.raw(`
    DROP TRIGGER IF EXISTS trg_clause_universal_sync_code ON public.clause_universal;
    CREATE TRIGGER trg_clause_universal_sync_code
    BEFORE INSERT OR UPDATE OF code ON public.clause_universal
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_clause_code_from_child();
  `)

  await knex.raw(`
    DROP TRIGGER IF EXISTS trg_clause_company_sync_code ON public.clause_company;
    CREATE TRIGGER trg_clause_company_sync_code
    BEFORE INSERT OR UPDATE OF code ON public.clause_company
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_clause_code_from_child();
  `)
}

exports.down = async function down(knex) {
  await knex.raw('DROP TRIGGER IF EXISTS trg_clause_company_sync_code ON public.clause_company;')
  await knex.raw('DROP TRIGGER IF EXISTS trg_clause_universal_sync_code ON public.clause_universal;')
  await knex.raw('DROP FUNCTION IF EXISTS public.sync_clause_code_from_child();')

  await knex.raw('DROP INDEX IF EXISTS public.ux_clause_company_company_id_code_not_null;')
  await knex.raw('DROP INDEX IF EXISTS public.ux_clause_universal_code_not_null;')
}

