/**
 * Catálogo de tipos de documento de identidad (RUT/CL, RFC/MX).
 * Agregar un país con validación por patrón = INSERT, no migración de código.
 */

function uuidPk(table, knex) {
  table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
}

const RFC_PATTERN = JSON.stringify({
  persona_natural: '^[A-ZÑ&]{4}\\d{6}[A-Z0-9]{3}$',
  empresa: '^[A-ZÑ&]{3}\\d{6}[A-Z0-9]{3}$'
})

const CATALOG_SEED = [
  {
    code: 'RUT',
    country_code: 'CL',
    label: 'RUT',
    label_long: 'Rol Único Tributario',
    validator_key: 'rut_cl',
    pattern: null,
    format_example: '12.345.678-5'
  },
  {
    code: 'RFC',
    country_code: 'MX',
    label: 'RFC',
    label_long: 'Registro Federal de Contribuyentes',
    validator_key: 'pattern',
    pattern: RFC_PATTERN,
    format_example: 'LEGF870121MGA'
  }
]

exports.up = async function up(knex) {
  await knex.schema.createTable('identity_document_type', (table) => {
    uuidPk(table, knex)
    table.text('code').notNullable().unique()
    table.string('country_code', 2).notNullable()
    table.text('label').notNullable()
    table.text('label_long').notNullable()
    table.text('validator_key').notNullable()
    table.text('pattern').nullable()
    table.text('format_example').notNullable()
  })

  await knex.raw(`
    ALTER TABLE identity_document_type
    ADD CONSTRAINT identity_document_type_country_code_check
    CHECK (country_code ~ '^[A-Z]{2}$')
  `)

  await knex('identity_document_type').insert(CATALOG_SEED)
}

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('identity_document_type')
}
