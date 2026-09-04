/**
 * País de la plantilla + corrección de redacción mexicana.
 * CONTRATO_0016 / CONTRATO_0017 → MX y «cédula de identidad» → «RFC».
 */

const CHECK_NAME = 'template_country_code_check'
const MX_CODES = ['CONTRATO_0016', 'CONTRATO_0017']
const BACKUP_NOTE = 'identificador-tributario-por-pais: cédula de identidad → RFC'
const FROM_PHRASE = 'cédula de identidad'
const TO_PHRASE = 'RFC'

function replacePlainText(node, from, to) {
  if (node == null || typeof node !== 'object') return node
  if (typeof node.text === 'string' && node.text.includes(from)) {
    return { ...node, text: node.text.split(from).join(to) }
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map((child) => replacePlainText(child, from, to)) }
  }
  return node
}

exports.up = async function up(knex) {
  const hasCol = await knex.schema.hasColumn('template', 'country_code')
  if (!hasCol) {
    await knex.schema.alterTable('template', (table) => {
      table.string('country_code', 2).nullable()
    })
    await knex.raw(`
      ALTER TABLE template
      ADD CONSTRAINT ${CHECK_NAME}
      CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$')
    `)
  }

  await knex('template').update({ country_code: 'CL' })
  await knex('template').whereIn('code', MX_CODES).update({ country_code: 'MX' })

  const mxTemplates = await knex('template').select('id', 'content_json').whereIn('code', MX_CODES)
  for (const t of mxTemplates) {
    await knex('template_content_backup').insert({
      template_id: t.id,
      content_json: t.content_json,
      note: BACKUP_NOTE
    })
    const updated = replacePlainText(t.content_json, FROM_PHRASE, TO_PHRASE)
    await knex('template').where({ id: t.id }).update({ content_json: updated })
  }
}

exports.down = async function down(knex) {
  const backups = await knex('template_content_backup').where({ note: BACKUP_NOTE }).select('*')
  for (const b of backups) {
    await knex('template').where({ id: b.template_id }).update({ content_json: b.content_json })
  }
  await knex('template_content_backup').where({ note: BACKUP_NOTE }).del()

  await knex.raw(`ALTER TABLE template DROP CONSTRAINT IF EXISTS ${CHECK_NAME}`)
  if (await knex.schema.hasColumn('template', 'country_code')) {
    await knex.schema.alterTable('template', (table) => {
      table.dropColumn('country_code')
    })
  }
}
