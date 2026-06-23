/**
 * Clientes (marca/empresa anunciante) y campañas de producto asociadas.
 */

function uuidPk(table, knex) {
  table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
}

exports.up = async function up(knex) {
  await knex.schema.createTable('client', (table) => {
    uuidPk(table, knex)
    table.text('name').notNullable()
    table.text('brand').notNullable()
    table.text('brand_account').nullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.uuid('created_by').nullable().references('id').inTable('user_profile').onDelete('SET NULL')
    table.uuid('updated_by').nullable().references('id').inTable('user_profile').onDelete('SET NULL')
  })

  await knex.schema.createTable('client_product_campaign', (table) => {
    uuidPk(table, knex)
    table.uuid('client_id').notNullable().references('id').inTable('client').onDelete('CASCADE')
    table.text('name').notNullable()
    table.integer('sort_order').notNullable().defaultTo(0)
    table.index(['client_id'])
  })
}

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('client_product_campaign')
  await knex.schema.dropTableIfExists('client')
}
