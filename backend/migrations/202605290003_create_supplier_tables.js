/**
 * Proveedores globales (contraparte contractual) y redes sociales asociadas.
 */

function uuidPk(table, knex) {
  table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
}

exports.up = async function up(knex) {
  await knex.schema.createTable('supplier', (table) => {
    uuidPk(table, knex)
    table.text('supplier_type').notNullable()

    table.text('full_name').nullable()
    table.text('rut_body').nullable()
    table.text('rut_dv').nullable()
    table.text('address').nullable()

    table.text('razon_social').nullable()
    table.text('rut_empresa_body').nullable()
    table.text('rut_empresa_dv').nullable()
    table.text('giro').nullable()
    table.text('direccion_empresa').nullable()
    table.text('nombre_rep_legal').nullable()
    table.text('rut_rep_legal_body').nullable()
    table.text('rut_rep_legal_dv').nullable()

    table.text('personeria_type').nullable()
    table.date('fecha_certificado_estatuto').nullable()
    table.text('codigo_cve').nullable()
    table.date('fecha_escritura_publica').nullable()
    table.text('nombre_notaria').nullable()
    table.text('nombre_notario').nullable()

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.uuid('created_by').nullable().references('id').inTable('user_profile').onDelete('SET NULL')
    table.uuid('updated_by').nullable().references('id').inTable('user_profile').onDelete('SET NULL')
  })

  await knex.raw(`
    ALTER TABLE supplier
    ADD CONSTRAINT supplier_type_check
    CHECK (supplier_type IN ('persona_natural', 'empresa'))
  `)
  await knex.raw(`
    ALTER TABLE supplier
    ADD CONSTRAINT supplier_personeria_type_check
    CHECK (
      personeria_type IS NULL
      OR personeria_type IN ('empresa_en_un_dia', 'escritura_publica')
    )
  `)

  await knex.schema.createTable('supplier_social_network', (table) => {
    uuidPk(table, knex)
    table
      .uuid('supplier_id')
      .notNullable()
      .references('id')
      .inTable('supplier')
      .onDelete('CASCADE')
    table.text('network_name').notNullable()
    table.text('account_name').notNullable()
    table.integer('sort_order').notNullable().defaultTo(0)
    table.index(['supplier_id'])
  })
}

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('supplier_social_network')
  await knex.schema.dropTableIfExists('supplier')
}
