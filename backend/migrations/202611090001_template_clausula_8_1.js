/**
 * Cláusula 8.1 (retiro de contenido): quita «con su producto {{producto/campaña}}» de sus 5 párrafos y el
 * artículo «la» del párrafo 3 en las plantillas cuya 8.1 coincide con el texto original (clase a) o solo
 * difiere en espacios (clase b). Las demás (p. ej. México, que tiene otra redacción) no se tocan. Revisa todas
 * las plantillas, lee el contenido vivo, respalda en template_content_backup y es idempotente.
 */

const { rewriteClausula81 } = require('../utils/templateClausula81')

const BACKUP_NOTE = 'plantillas-clausula-8-1'

async function up(knex) {
  const rows = await knex('template').select('id', 'code', 'content_json')
  const pending = []
  const excluded = []
  for (const row of rows) {
    const result = rewriteClausula81(row.content_json)
    if (result.status === 'applied') pending.push({ id: row.id, previous: row.content_json, next: result.content })
    else if (result.status === 'excluded') excluded.push(`${row.code}: ${result.reason}`)
  }

  for (const template of pending) {
    await knex('template_content_backup').insert({
      template_id: template.id,
      content_json: template.previous,
      note: BACKUP_NOTE
    })
    await knex('template').where({ id: template.id }).update({ content_json: template.next })
  }
  console.log(`[clausula-8-1] corregidas: ${pending.length}; excluidas (no se tocan): ${excluded.length}`)
  excluded.forEach((line) => console.log(`[clausula-8-1]   ${line}`))
}

async function down(knex) {
  const backups = await knex('template_content_backup').where({ note: BACKUP_NOTE }).select('*')
  for (const backup of backups) {
    await knex('template').where({ id: backup.template_id }).update({ content_json: backup.content_json })
  }
  await knex('template_content_backup').where({ note: BACKUP_NOTE }).del()
}

module.exports = { up, down }
