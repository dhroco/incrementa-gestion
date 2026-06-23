/**
 * Catálogo maestro de redes sociales; supplier_social_network referencia catalog_id.
 */

function uuidPk(table, knex) {
  table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
}

const CATALOG_SEED = [
  { sort_order: 1, code: 'instagram', name: 'Instagram' },
  { sort_order: 2, code: 'facebook', name: 'Facebook' },
  { sort_order: 3, code: 'linkedin', name: 'LinkedIn' },
  { sort_order: 4, code: 'x', name: 'X' },
  { sort_order: 5, code: 'tiktok', name: 'TikTok' },
  { sort_order: 6, code: 'youtube', name: 'YouTube' },
  { sort_order: 7, code: 'whatsapp_business', name: 'WhatsApp Business' },
  { sort_order: 8, code: 'pinterest', name: 'Pinterest' }
]

exports.up = async function up(knex) {
  await knex.schema.createTable('social_network_catalog', (table) => {
    uuidPk(table, knex)
    table.text('code').notNullable().unique()
    table.text('name').notNullable()
    table.integer('sort_order').notNullable()
  })

  await knex('social_network_catalog').insert(CATALOG_SEED)

  await knex('supplier_social_network').del()

  await knex.schema.alterTable('supplier_social_network', (table) => {
    table.uuid('catalog_id').nullable()
  })

  await knex.schema.alterTable('supplier_social_network', (table) => {
    table.dropColumn('network_name')
  })

  await knex.raw(`ALTER TABLE supplier_social_network ALTER COLUMN catalog_id SET NOT NULL`)

  await knex.schema.alterTable('supplier_social_network', (table) => {
    table
      .foreign('catalog_id')
      .references('id')
      .inTable('social_network_catalog')
      .onDelete('RESTRICT')
  })
}

exports.down = async function down(knex) {
  await knex('supplier_social_network').del()

  await knex.schema.alterTable('supplier_social_network', (table) => {
    table.dropForeign('catalog_id')
  })

  await knex.schema.alterTable('supplier_social_network', (table) => {
    table.dropColumn('catalog_id')
    table.text('network_name').notNullable()
  })

  await knex.schema.dropTableIfExists('social_network_catalog')
}
