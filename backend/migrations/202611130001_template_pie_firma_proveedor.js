/**
 * CONTRATO_0001 a CONTRATO_0015: se elimina el pie de firma del influencer (lo agrega Firme.cl en su proceso de firma;
 * el bloque queda con un solo párrafo vacío) y se agregan 5 párrafos vacíos entre el último párrafo y la firma del
 * representante de la empresa. Es el cambio que David hizo a mano en CONTRATO_0001 de producción. Lee el contenido
 * vivo (conserva las ediciones a mano), respalda en template_content_backup, es idempotente y deja sin tocar las
 * plantillas cuyo final no tiene la estructura esperada. México (0016 y 0017) no entra: su proveedor no puede firmar
 * por Firme y necesita su línea de firma.
 */

const { rewritePieFirma, TEMPLATE_CODES } = require('../utils/templatePieFirma')

const BACKUP_NOTE = 'plantillas-pie-firma'

async function up(knex) {
  const rows = await knex('template').select('id', 'code', 'content_json').whereIn('code', TEMPLATE_CODES)
  const pending = []
  const excluded = []
  for (const row of rows) {
    const result = rewritePieFirma(row.content_json, row.code)
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
  console.log(`[pie-firma] corregidas: ${pending.length}; excluidas (no se tocan): ${excluded.length}`)
  excluded.forEach((line) => console.log(`[pie-firma]   ${line}`))
}

async function down(knex) {
  const backups = await knex('template_content_backup').where({ note: BACKUP_NOTE }).select('*')
  for (const backup of backups) {
    await knex('template').where({ id: backup.template_id }).update({ content_json: backup.content_json })
  }
  await knex('template_content_backup').where({ note: BACKUP_NOTE }).del()
}

module.exports = { up, down }
