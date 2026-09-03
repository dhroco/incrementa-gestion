/**
 * Legal representative signature registry.
 * Stores one transparent PNG per legal representative index (1|2) per company.
 */

exports.up = async function up(knex) {
  const exists = await knex.schema.hasTable('legal_rep_signature')
  if (exists) return

  await knex.schema.createTable('legal_rep_signature', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    table.smallint('rep_index').notNullable()
    table.text('gcs_path').notNullable()
    table
      .uuid('uploaded_by')
      .nullable()
      .references('id')
      .inTable('user_profile')
      .onDelete('SET NULL')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())

    table.unique(['company_id', 'rep_index'])
    table.index(['company_id'])
  })

  await knex.raw(`
    ALTER TABLE legal_rep_signature
    ADD CONSTRAINT legal_rep_signature_rep_index_check
    CHECK (rep_index IN (1, 2))
  `)
}

exports.down = async function down(knex) {
  const exists = await knex.schema.hasTable('legal_rep_signature')
  if (!exists) return

  await knex.schema.dropTable('legal_rep_signature')
}

