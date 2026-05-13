exports.up = async function up(knex) {
  await knex.schema.dropTableIfExists('template_clause')
}

exports.down = async function down(knex) {
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
}

