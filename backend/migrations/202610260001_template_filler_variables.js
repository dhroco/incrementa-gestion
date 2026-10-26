/**
 * Reemplaza el texto de relleno de las plantillas de contrato (CONTRATO_0001 a CONTRATO_0017)
 * por variables: plazo de no competencia, activaciones, vigencia, plazo de cesión, días de boost
 * y nombre del cliente. No borra ni mueve cláusulas. El contenido anterior de cada plantilla
 * modificada queda en template_content_backup. Busca por código, no por id, y es idempotente:
 * una plantilla que ya trae las variables no se toca. Si una plantilla no coincide con el texto
 * esperado, la migración se detiene sin modificar nada.
 */

const { rewriteFillerVariables, TEMPLATE_CODES } = require('../utils/templateFillerVariables')

const BACKUP_NOTE = 'plantillas-variables-relleno'

async function up(knex) {
  const rows = await knex('template').select('id', 'code', 'content_json').whereIn('code', TEMPLATE_CODES)
  if (rows.length === 0) {
    throw new Error('No se encontró ninguna de las plantillas CONTRATO_0001 a CONTRATO_0017.')
  }

  const pending = []
  for (const row of rows) {
    const result = rewriteFillerVariables(row.content_json, row.code)
    if (result.replaced > 0) {
      pending.push({ id: row.id, previous: row.content_json, next: result.content })
    }
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

module.exports = {
  up,
  down
}
