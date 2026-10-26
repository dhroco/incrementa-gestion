/**
 * Partes del nombre del proveedor (persona natural y representante legal).
 * Agrega columnas nullable, respalda la fila hija y rellena con splitFullName.
 * No reescribe full_name ni nombre_rep_legal. El down solo quita las columnas.
 */

const personName = require('../utils/personName')

const BACKUP_TABLE = 'supplier_child_backup'
const BACKUP_NOTE = 'supplier-name-parts'
const PERSONA_PARTS = ['first_names', 'last_name', 'maternal_last_name']
const EMPRESA_PARTS = ['rep_first_names', 'rep_last_name', 'rep_maternal_last_name']

function hasText(value) {
  return typeof value === 'string' && value.trim() !== ''
}

function partsAreNull(row, keys) {
  return keys.every((key) => row[key] == null)
}

function nullIfBlank(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

function normalizeSpaces(value) {
  return String(value).trim().replace(/\s+/g, ' ')
}

function plannedRow(row, { table, childKind, source, partKeys }) {
  const parts = personName.splitFullName(source)
  const stored = {
    firstNames: nullIfBlank(parts.firstNames),
    lastName: nullIfBlank(parts.lastName),
    maternalLastName: nullIfBlank(parts.maternalLastName)
  }
  const update = {
    [partKeys[0]]: stored.firstNames,
    [partKeys[1]]: stored.lastName,
    [partKeys[2]]: stored.maternalLastName
  }
  return {
    supplier_id: row.supplier_id,
    table,
    childKind,
    row,
    source,
    stored,
    update
  }
}

function collectAffected(rows, options) {
  const planned = []
  for (const row of rows) {
    if (!hasText(row[options.sourceKey]) || !partsAreNull(row, options.partKeys)) continue
    planned.push(plannedRow(row, { ...options, source: row[options.sourceKey] }))
  }
  return planned
}

exports.up = async function up(knex) {
  const { composeFullName } = personName

  await knex.schema.alterTable('supplier_persona_natural', (table) => {
    table.text('first_names').nullable()
    table.text('last_name').nullable()
    table.text('maternal_last_name').nullable()
  })
  await knex.schema.alterTable('supplier_empresa', (table) => {
    table.text('rep_first_names').nullable()
    table.text('rep_last_name').nullable()
    table.text('rep_maternal_last_name').nullable()
  })

  const personaRows = await knex('supplier_persona_natural').select('*')
  const empresaRows = await knex('supplier_empresa').select('*')
  const planned = [
    ...collectAffected(personaRows, {
      table: 'supplier_persona_natural',
      childKind: 'persona_natural',
      sourceKey: 'full_name',
      partKeys: PERSONA_PARTS
    }),
    ...collectAffected(empresaRows, {
      table: 'supplier_empresa',
      childKind: 'empresa',
      sourceKey: 'nombre_rep_legal',
      partKeys: EMPRESA_PARTS
    })
  ]

  if (planned.length) {
    await knex(BACKUP_TABLE).insert(
      planned.map((item) => ({
        supplier_id: item.supplier_id,
        child_kind: item.childKind,
        row_json: JSON.parse(JSON.stringify(item.row)),
        note: BACKUP_NOTE
      }))
    )
  }

  const mismatches = planned.filter(
    (item) => composeFullName(item.stored) !== normalizeSpaces(item.source)
  )
  if (mismatches.length) {
    const ids = mismatches.map((item) => item.supplier_id).join(', ')
    throw new Error(
      `supplier-name-parts: la recomposición no coincide con el nombre guardado para supplier_id: ${ids}`
    )
  }

  for (const item of planned) {
    await knex(item.table).where({ supplier_id: item.supplier_id }).update(item.update)
  }
}

exports.down = async function down(knex) {
  await knex.schema.alterTable('supplier_persona_natural', (table) => {
    table.dropColumn('first_names')
    table.dropColumn('last_name')
    table.dropColumn('maternal_last_name')
  })
  await knex.schema.alterTable('supplier_empresa', (table) => {
    table.dropColumn('rep_first_names')
    table.dropColumn('rep_last_name')
    table.dropColumn('rep_maternal_last_name')
  })
}
