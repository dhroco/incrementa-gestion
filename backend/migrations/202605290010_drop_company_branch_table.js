/**
 * Remove branch offices (sucursales) — companies are managed without sub-entities.
 */

exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('company_branch')
  if (!has) return
  await knex.schema.dropTable('company_branch')
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('company_branch')
  if (has) return

  await knex.schema.createTable('company_branch', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table
      .uuid('company_id')
      .notNullable()
      .references('id')
      .inTable('company')
      .onDelete('CASCADE')
    table.text('name').notNullable()
    table.text('address').nullable()
    table.text('commune').nullable()
    table.text('city').nullable()
    table.text('region').nullable()
    table.text('email').nullable()
    table.text('phone').nullable()
    table.integer('sort_order').notNullable().defaultTo(0)
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index(['company_id', 'sort_order'], 'company_branch_company_sort_idx')
  })
}
