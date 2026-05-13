/**
 * GFA base data model (minimal structural schema).
 *
 * Notes:
 * - UUID PK via gen_random_uuid() to match existing migrations.
 * - Minimal columns: PK/FK/timestamps only (no business fields yet).
 * - Real inheritance via PK = FK for child tables.
 * - Bridge tables use composite PKs (no artificial id).
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
  await knex.schema.createTable('company', (table) => {
    uuidPk(table, knex)
    timestamps(table, knex, { withUpdatedAt: true })
  })

  await knex.schema.createTable('position', (table) => {
    uuidPk(table, knex)
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    timestamps(table, knex, { withUpdatedAt: true })
    table.index(['company_id'])
  })

  await knex.schema.createTable('work_schedule', (table) => {
    uuidPk(table, knex)
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    timestamps(table, knex, { withUpdatedAt: true })
    table.index(['company_id'])
  })

  await knex.schema.createTable('employee', (table) => {
    uuidPk(table, knex)
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    table
      .uuid('position_id')
      .notNullable()
      .references('id')
      .inTable('position')
      .onDelete('RESTRICT')
    table
      .uuid('work_schedule_id')
      .notNullable()
      .references('id')
      .inTable('work_schedule')
      .onDelete('RESTRICT')
    timestamps(table, knex, { withUpdatedAt: true })
    table.index(['company_id'])
    table.index(['position_id'])
    table.index(['work_schedule_id'])
  })

  await knex.schema.createTable('template', (table) => {
    uuidPk(table, knex)
    timestamps(table, knex, { withUpdatedAt: true })
  })

  await knex.schema.createTable('template_company', (table) => {
    // PK = FK to template.id
    table
      .uuid('id')
      .primary()
      .references('id')
      .inTable('template')
      .onDelete('CASCADE')
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    timestamps(table, knex, { withUpdatedAt: true })
    table.index(['company_id'])
  })

  await knex.schema.createTable('template_standard', (table) => {
    // PK = FK to template.id
    table
      .uuid('id')
      .primary()
      .references('id')
      .inTable('template')
      .onDelete('CASCADE')
    timestamps(table, knex, { withUpdatedAt: true })
  })

  await knex.schema.createTable('clause', (table) => {
    uuidPk(table, knex)
    timestamps(table, knex, { withUpdatedAt: true })
  })

  await knex.schema.createTable('clause_company', (table) => {
    // PK = FK to clause.id
    table
      .uuid('id')
      .primary()
      .references('id')
      .inTable('clause')
      .onDelete('CASCADE')
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    timestamps(table, knex, { withUpdatedAt: true })
    table.index(['company_id'])
  })

  await knex.schema.createTable('clause_universal', (table) => {
    // PK = FK to clause.id
    table
      .uuid('id')
      .primary()
      .references('id')
      .inTable('clause')
      .onDelete('CASCADE')
    timestamps(table, knex, { withUpdatedAt: true })
  })

  await knex.schema.createTable('template_clause', (table) => {
    table
      .uuid('template_id')
      .notNullable()
      .references('id')
      .inTable('template')
      .onDelete('CASCADE')
    table
      .uuid('clause_id')
      .notNullable()
      .references('id')
      .inTable('clause')
      .onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.primary(['template_id', 'clause_id'])
    table.index(['template_id'])
    table.index(['clause_id'])
  })

  await knex.schema.createTable('document_type', (table) => {
    uuidPk(table, knex)
    timestamps(table, knex, { withUpdatedAt: true })
  })

  await knex.schema.createTable('document', (table) => {
    uuidPk(table, knex)
    table
      .uuid('template_id')
      .notNullable()
      .references('id')
      .inTable('template')
      .onDelete('RESTRICT')
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('RESTRICT')
    table
      .uuid('employee_id')
      .notNullable()
      .references('id')
      .inTable('employee')
      .onDelete('RESTRICT')
    table
      .uuid('document_type_id')
      .notNullable()
      .references('id')
      .inTable('document_type')
      .onDelete('RESTRICT')
    timestamps(table, knex, { withUpdatedAt: true })
    table.index(['template_id'])
    table.index(['company_id'])
    table.index(['employee_id'])
    table.index(['document_type_id'])
  })

  await knex.schema.createTable('company_internal_user', (table) => {
    // PK = FK to user_profile.id
    table
      .uuid('id')
      .primary()
      .references('id')
      .inTable('user_profile')
      .onDelete('CASCADE')
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    timestamps(table, knex, { withUpdatedAt: true })
    table.index(['company_id'])
  })

  await knex.schema.createTable('accountant', (table) => {
    // PK = FK to user_profile.id
    table
      .uuid('id')
      .primary()
      .references('id')
      .inTable('user_profile')
      .onDelete('CASCADE')
    timestamps(table, knex, { withUpdatedAt: true })
  })

  await knex.schema.createTable('accountant_company', (table) => {
    table
      .uuid('accountant_id')
      .notNullable()
      .references('id')
      .inTable('accountant')
      .onDelete('CASCADE')
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.primary(['accountant_id', 'company_id'])
    table.index(['accountant_id'])
    table.index(['company_id'])
  })
}

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('accountant_company')
  await knex.schema.dropTableIfExists('accountant')
  await knex.schema.dropTableIfExists('company_internal_user')
  await knex.schema.dropTableIfExists('document')
  await knex.schema.dropTableIfExists('document_type')
  await knex.schema.dropTableIfExists('template_clause')
  await knex.schema.dropTableIfExists('clause_universal')
  await knex.schema.dropTableIfExists('clause_company')
  await knex.schema.dropTableIfExists('clause')
  await knex.schema.dropTableIfExists('template_standard')
  await knex.schema.dropTableIfExists('template_company')
  await knex.schema.dropTableIfExists('template')
  await knex.schema.dropTableIfExists('employee')
  await knex.schema.dropTableIfExists('work_schedule')
  await knex.schema.dropTableIfExists('position')
  await knex.schema.dropTableIfExists('company')
}

