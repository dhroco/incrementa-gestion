/**
 * CONTRATO_0018 (Empresa por un día con Canje más Pago, creada a mano en producción el 19-nov) queda con Boost, y se crea
 * CONTRATO_0019: la misma plantilla con personería por escritura pública. Lee el contenido vivo (conserva las ediciones a
 * mano), respalda 0018 en template_content_backup antes de tocarla y aborta sin escribir si la estructura no es la esperada.
 * Idempotente: si 0018 ya tiene el boost y 0019 existe, no hace nada (0019 no se pisa si alguien la editó).
 * Pre-prod: 0018 y 0019 se copian desde producción (la 0018 no existe allí); esta migración queda entonces sin cambios.
 */

const { addBoostToClause24, personeriaEscrituraPublica } = require('../utils/templateCanjePagoBoost')

const BACKUP_NOTE = 'plantillas-0018-0019'
const CODE_18 = 'CONTRATO_0018'
const CODE_19 = 'CONTRATO_0019'
const NAME_18 = 'Contrato Empresa por un día con Canje más Pago con Boost'
const NAME_19 = 'Contrato Empresa escritura pública con Canje más Pago con Boost'
const COPIED_COLUMNS = ['document_type_id', 'status', 'supplier_type', 'country_code', 'currency_code', 'created_by', 'updated_by', 'last_edited_by']

function fail(message) {
  return new Error(`[0018-0019] ${message}; no se modificó nada.`)
}

async function up(knex) {
  const row18 = await knex('template').where({ code: CODE_18 }).first()
  if (!row18) throw fail(`${CODE_18} no existe en esta base (en pre-prod se copia desde producción)`)
  if (row18.supplier_type !== 'empresa' || !JSON.stringify(row18.content_json).includes('pago_dinero_numero')) {
    throw fail(`${CODE_18} no es la plantilla de empresa con Canje más Pago esperada`)
  }

  const boost = addBoostToClause24(row18.content_json)
  if (boost.status === 'mismatch') throw fail(boost.reason)
  const content18 = boost.status === 'applied' ? boost.content : row18.content_json

  const row19 = await knex('template').where({ code: CODE_19 }).first()
  let insert19 = null
  if (!row19) {
    const personeria = personeriaEscrituraPublica(content18)
    if (personeria.status === 'mismatch') throw fail(personeria.reason)
    if (personeria.status === 'already') throw fail(`${CODE_18} ya trae la personería de escritura pública`)
    insert19 = personeria.content
  }

  if (boost.status === 'applied') {
    await knex('template_content_backup').insert({ template_id: row18.id, content_json: row18.content_json, note: BACKUP_NOTE })
    await knex('template').where({ id: row18.id }).update({ content_json: content18 })
  }
  if (row18.name !== NAME_18 || row18.description !== NAME_18) {
    await knex('template').where({ id: row18.id }).update({ name: NAME_18, description: NAME_18 })
  }

  if (insert19) {
    const copied = {}
    for (const column of COPIED_COLUMNS) copied[column] = row18[column]
    await knex('template').insert({
      ...copied,
      code: CODE_19,
      name: NAME_19,
      description: NAME_19,
      content_json: insert19
    })
  }
  console.log(
    `[0018-0019] ${CODE_18}: ${boost.status === 'applied' ? 'boost agregado' : 'ya tenía el boost'}; ${CODE_19}: ${insert19 ? 'creada' : 'ya existía (no se toca)'}`
  )
}

async function down(knex) {
  const backups = await knex('template_content_backup').where({ note: BACKUP_NOTE }).select('*')
  for (const backup of backups) {
    await knex('template').where({ id: backup.template_id }).update({ content_json: backup.content_json })
  }
  await knex('template_content_backup').where({ note: BACKUP_NOTE }).del()
  const row19 = await knex('template').where({ code: CODE_19 }).first()
  if (row19) {
    const used = await knex('draft_document').where({ template_id: row19.id }).first()
    if (used) throw new Error(`[0018-0019] ${CODE_19} tiene borradores; no se elimina.`)
    await knex('template').where({ id: row19.id }).del()
  }
}

module.exports = { up, down }
