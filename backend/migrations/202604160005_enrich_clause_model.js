/**
 * Phase A (safe): extend clause base fields without breaking existing data.
 *
 * IMPORTANT:
 * - This migration must be safe on environments that already have rows in:
 *   clause (and its 1:1 children clause_universal / clause_company).
 * - Do NOT introduce NOT NULL columns on child tables with existing rows.
 * - Strong uniqueness constraints are applied in Phase B (next migration).
 */

exports.up = async function up(knex) {
  // 1) Extend clause (parent) with new nullable fields + safe defaults.
  await knex.schema.alterTable('clause', (table) => {
    table.string('title_clause', 255).nullable()
    table.string('code', 100).nullable()
    table.text('description').nullable()
    table.jsonb('content_json').nullable()

    // Use TEXT + CHECK instead of ENUM to keep future evolution simple.
    table.text('status').notNullable().defaultTo('draft')

    table
      .uuid('created_by')
      .nullable()
      .references('id')
      .inTable('user_profile')
      .onDelete('SET NULL')
    table
      .uuid('updated_by')
      .nullable()
      .references('id')
      .inTable('user_profile')
      .onDelete('SET NULL')
    table
      .uuid('last_edited_by')
      .nullable()
      .references('id')
      .inTable('user_profile')
      .onDelete('SET NULL')
  })

  // CHECK constraint for status values (idempotent).
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'clause_status_check'
      ) THEN
        ALTER TABLE public.clause
        ADD CONSTRAINT clause_status_check
        CHECK (status IN ('draft', 'active', 'inactive'));
      END IF;
    END
    $$;
  `)

  // 2) Performance indexes (non-unique).
  await knex.schema.alterTable('clause', (table) => {
    table.index(['status'], 'idx_clause_status')
    table.index(['created_by'], 'idx_clause_created_by')
    table.index(['updated_by'], 'idx_clause_updated_by')
    table.index(['last_edited_by'], 'idx_clause_last_edited_by')
    table.index(['code'], 'idx_clause_code')
  })

  // 3) JSONB index for future content queries (safe, can be dropped later if undesired).
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_clause_content_json_gin
    ON public.clause
    USING GIN (content_json);
  `)

  // 4) Add contextual code columns in child tables (nullable in Phase A).
  await knex.schema.alterTable('clause_universal', (table) => {
    table.string('code', 100).nullable()
  })

  await knex.schema.alterTable('clause_company', (table) => {
    table.string('code', 100).nullable()
  })

  // Optional helper indexes (non-unique) for early query ergonomics.
  await knex.schema.alterTable('clause_universal', (table) => {
    table.index(['code'], 'idx_clause_universal_code')
  })
  await knex.schema.alterTable('clause_company', (table) => {
    table.index(['code'], 'idx_clause_company_code')
  })
}

exports.down = async function down(knex) {
  // Drop child indexes/columns first.
  await knex.schema.alterTable('clause_company', (table) => {
    table.dropIndex(['code'], 'idx_clause_company_code')
    table.dropColumn('code')
  })

  await knex.schema.alterTable('clause_universal', (table) => {
    table.dropIndex(['code'], 'idx_clause_universal_code')
    table.dropColumn('code')
  })

  await knex.raw('DROP INDEX IF EXISTS public.idx_clause_content_json_gin')

  await knex.schema.alterTable('clause', (table) => {
    table.dropIndex(['code'], 'idx_clause_code')
    table.dropIndex(['last_edited_by'], 'idx_clause_last_edited_by')
    table.dropIndex(['updated_by'], 'idx_clause_updated_by')
    table.dropIndex(['created_by'], 'idx_clause_created_by')
    table.dropIndex(['status'], 'idx_clause_status')

    table.dropColumn('last_edited_by')
    table.dropColumn('updated_by')
    table.dropColumn('created_by')
    table.dropColumn('status')
    table.dropColumn('content_json')
    table.dropColumn('description')
    table.dropColumn('code')
    table.dropColumn('title_clause')
  })

  await knex.raw(`
    ALTER TABLE public.clause
    DROP CONSTRAINT IF EXISTS clause_status_check;
  `)
}
