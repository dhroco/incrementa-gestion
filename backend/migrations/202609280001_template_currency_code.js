/**
 * Moneda de la plantilla. Solo el esquema: se corre antes del deploy.
 * La marca USD y la cláusula 3.1 van en 202609280002, después del deploy.
 */

const CHECK_NAME = 'template_currency_code_check'

async function up(knex) {
  const hasCol = await knex.schema.hasColumn('template', 'currency_code')
  if (!hasCol) {
    await knex.schema.alterTable('template', (table) => {
      table.string('currency_code', 3).notNullable().defaultTo('CLP')
    })
    await knex.raw(`
      ALTER TABLE template
      ADD CONSTRAINT ${CHECK_NAME}
      CHECK (currency_code IN ('CLP', 'USD'))
    `)
  }
}

async function down(knex) {
  await knex.raw(`ALTER TABLE template DROP CONSTRAINT IF EXISTS ${CHECK_NAME}`)
  if (await knex.schema.hasColumn('template', 'currency_code')) {
    await knex.schema.alterTable('template', (table) => {
      table.dropColumn('currency_code')
    })
  }
}

module.exports = { up, down }
