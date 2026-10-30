/**
 * En CONTRATO_0013, 0014 y 0015 («Canje más Pago») las cláusulas 3.1 a 3.3 pasan a contemplar el canje y el pago
 * en dinero (variables pago_dinero_numero y pago_dinero_texto). El contenido anterior queda en
 * template_content_backup. Busca por código, es idempotente y se detiene sin modificar nada si alguna plantilla
 * no coincide con el texto esperado.
 */

const { rewriteCanjeMasPago, TEMPLATE_CODES } = require('../utils/templateCanjeMasPago')

const BACKUP_NOTE = 'plantillas-canje-mas-pago'

async function up(knex) {
  const rows = await knex('template').select('id', 'code', 'content_json').whereIn('code', TEMPLATE_CODES)
  if (rows.length === 0) {
    throw new Error('No se encontró ninguna de las plantillas CONTRATO_0013, 0014 y 0015.')
  }

  const pending = []
  for (const row of rows) {
    const result = rewriteCanjeMasPago(row.content_json, row.code)
    if (result.replaced > 0) pending.push({ id: row.id, previous: row.content_json, next: result.content })
  }

  for (const template of pending) {
    await knex('template_content_backup').insert({
      template_id: template.id,
      content_json: template.previous,
      note: BACKUP_NOTE
    })
    await knex('template').where({ id: template.id }).update({ content_json: template.next })
  }
}

async function down(knex) {
  const backups = await knex('template_content_backup').where({ note: BACKUP_NOTE }).select('*')
  for (const backup of backups) {
    await knex('template').where({ id: backup.template_id }).update({ content_json: backup.content_json })
  }
  await knex('template_content_backup').where({ note: BACKUP_NOTE }).del()
}

module.exports = { up, down }
