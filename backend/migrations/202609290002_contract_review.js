/**
 * Evidence of the SEGUNDO wording review, and the draft's pointer to it.
 * Not applied by this change.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('contract_review', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    table
      .uuid('supplier_id')
      .notNullable()
      .references('id')
      .inTable('supplier')
      .onDelete('CASCADE')
    table
      .uuid('template_id')
      .notNullable()
      .references('id')
      .inTable('template')
      .onDelete('RESTRICT')
    table
      .uuid('created_by')
      .notNullable()
      .references('id')
      .inTable('user_profile')
      .onDelete('RESTRICT')
    table.text('input_hash').notNullable()
    table.text('verdict').notNullable()
    table.check("verdict IN ('ok','observaciones')")
    table.jsonb('observations').notNullable().defaultTo(knex.raw("'[]'::jsonb"))
    table.text('reviewed_text').notNullable()
    table.text('model').notNullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.alterTable('draft_document', (table) => {
    table
      .uuid('review_id')
      .nullable()
      .references('id')
      .inTable('contract_review')
      .onDelete('NO ACTION')
    table.text('review_override_reason').nullable()
  })
}

exports.down = async function down(knex) {
  await knex.schema.alterTable('draft_document', (table) => {
    table.dropColumn('review_id')
    table.dropColumn('review_override_reason')
  })
  await knex.schema.dropTableIfExists('contract_review')
}
