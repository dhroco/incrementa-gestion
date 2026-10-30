/**
 * Redacción sin género en CONTRATO_0001 a CONTRATO_0017 (frases sueltas: «domiciliado», «esta último», «don»,
 * «la Influencer» en persona natural). El contenido anterior queda en template_content_backup. Busca por código,
 * lee el contenido vivo (las ediciones hechas a mano se conservan), es idempotente y se detiene sin modificar
 * nada si una frase aparece más de una vez.
 */

const { rewriteGeneroNeutro, TEMPLATE_CODES } = require('../utils/templateGeneroNeutro')

const BACKUP_NOTE = 'plantillas-genero-neutro'

async function up(knex) {
  const rows = await knex('template').select('id', 'code', 'content_json').whereIn('code', TEMPLATE_CODES)
  if (rows.length === 0) {
    throw new Error('No se encontró ninguna de las plantillas CONTRATO_0001 a CONTRATO_0017.')
  }

  const pending = []
  for (const row of rows) {
    const result = rewriteGeneroNeutro(row.content_json, row.code)
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
