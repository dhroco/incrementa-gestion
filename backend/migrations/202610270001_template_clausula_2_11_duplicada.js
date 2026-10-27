/**
 * En CONTRATO_0003, 0006, 0009, 0012 y 0015 elimina la cláusula 2.11, que repite la no competencia de la 2.8
 * (la 2.8 queda tal cual), y renumera 2.12 a 2.16 como 2.11 a 2.15. El contenido anterior queda en
 * template_content_backup. Busca por código, es idempotente y se detiene sin modificar nada si alguna
 * plantilla no coincide con el texto esperado.
 */

const { removeDuplicateClause211, TEMPLATE_CODES } = require('../utils/templateClausula211Duplicada')

const BACKUP_NOTE = 'plantillas-clausula-2-11-duplicada'

async function up(knex) {
  const rows = await knex('template').select('id', 'code', 'content_json').whereIn('code', TEMPLATE_CODES)
  if (rows.length === 0) {
    throw new Error('No se encontró ninguna de las plantillas CONTRATO_0003, 0006, 0009, 0012 y 0015.')
  }

  const pending = []
  for (const row of rows) {
    const result = removeDuplicateClause211(row.content_json, row.code)
    if (result.removed > 0) pending.push({ id: row.id, previous: row.content_json, next: result.content })
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
