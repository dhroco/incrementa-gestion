/**
 * Removes clause tables — product scope is templates only.
 * template_clause was dropped in 202604230001.
 */

function uuidPk(table, knex) {
  table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
}

function timestamps(table, knex, { withUpdatedAt = true } = {}) {
  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  if (withUpdatedAt) {
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  }
}

exports.up = async function up(knex) {
  await knex.raw('DROP TABLE IF EXISTS clause_company CASCADE')
  await knex.raw('DROP TABLE IF EXISTS clause_universal CASCADE')
  await knex.raw('DROP TABLE IF EXISTS clause CASCADE')
}

exports.down = async function down(knex) {
  await knex.schema.createTable('clause', (table) => {
    uuidPk(table, knex)
    timestamps(table, knex, { withUpdatedAt: true })
    table.string('title_clause', 255).nullable()
    table.string('code', 100).nullable()
    table.text('description').nullable()
    table.jsonb('content_json').nullable()
    table.text('status').notNullable().defaultTo('draft')
    table.uuid('created_by').nullable().references('id').inTable('user_profile').onDelete('SET NULL')
    table.uuid('updated_by').nullable().references('id').inTable('user_profile').onDelete('SET NULL')
    table.uuid('last_edited_by').nullable().references('id').inTable('user_profile').onDelete('SET NULL')
  })

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clause_status_check'
      ) THEN
        ALTER TABLE public.clause
        ADD CONSTRAINT clause_status_check
        CHECK (status IN ('draft', 'active', 'inactive'));
      END IF;
    END
    $$;
  `)

  await knex.schema.alterTable('clause', (table) => {
    table.index(['status'], 'idx_clause_status')
    table.index(['created_by'], 'idx_clause_created_by')
    table.index(['updated_by'], 'idx_clause_updated_by')
    table.index(['last_edited_by'], 'idx_clause_last_edited_by')
    table.index(['code'], 'idx_clause_code')
  })

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_clause_content_json_gin
    ON public.clause USING GIN (content_json);
  `)

  await knex.schema.createTable('clause_company', (table) => {
    table.uuid('id').primary().references('id').inTable('clause').onDelete('CASCADE')
    table.uuid('company_id').notNullable().references('id').inTable('company').onDelete('CASCADE')
    timestamps(table, knex, { withUpdatedAt: true })
    table.string('code', 100).notNullable()
    table.index(['company_id'])
    table.index(['code'], 'idx_clause_company_code')
  })

  await knex.schema.createTable('clause_universal', (table) => {
    table.uuid('id').primary().references('id').inTable('clause').onDelete('CASCADE')
    timestamps(table, knex, { withUpdatedAt: true })
    table.string('code', 100).notNullable()
    table.index(['code'], 'idx_clause_universal_code')
  })

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_clause_universal_code
    ON public.clause_universal (code);
  `)

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_clause_company_company_id_code
    ON public.clause_company (company_id, code);
  `)
}
