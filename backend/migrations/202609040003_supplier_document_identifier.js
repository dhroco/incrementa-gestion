/**
 * Identificador genérico del proveedor (document_type_code + document_number).
 * Snapshot → backfill → verificar display → respaldo fila a fila → DROP rut_*.
 * El down restaura rut_* desde supplier_child_backup, no partiendo document_number.
 */

const { formatRutDisplay } = require('../utils/identityDocument')

const EXPECTED_SUPPLIER_COUNT = 22
const BACKUP_NOTE = 'identificador-tributario-por-pais'
const BACKUP_TABLE = 'supplier_child_backup'

function canonicalFromParts(body, dv) {
  const b = String(body || '').replace(/\D/g, '')
  const d = String(dv || '').trim().toUpperCase()
  if (!b) return null
  return d ? `${b}-${d}` : b
}

function displayFromCanonical(canonical) {
  const raw = String(canonical || '').trim().toUpperCase()
  if (!raw) return ''
  const dash = raw.lastIndexOf('-')
  if (dash > 0) return formatRutDisplay(raw.slice(0, dash), raw.slice(dash + 1))
  return formatRutDisplay(raw.slice(0, -1), raw.slice(-1))
}

function personaVisible(row) {
  return formatRutDisplay(row.rut_body, row.rut_dv)
}

function empresaVisible(row) {
  return formatRutDisplay(row.rut_empresa_body, row.rut_empresa_dv)
}

exports.up = async function up(knex) {
  const personaRows = await knex('supplier_persona_natural').select('*')
  const empresaRows = await knex('supplier_empresa').select('*')
  const total = personaRows.length + empresaRows.length
  if (total !== EXPECTED_SUPPLIER_COUNT) {
    throw new Error(
      `identificador-tributario-por-pais: se esperaban ${EXPECTED_SUPPLIER_COUNT} proveedores, hay ${total}. Abortando.`
    )
  }

  const snapshot = new Map()
  for (const row of personaRows) {
    snapshot.set(row.supplier_id, personaVisible(row))
  }
  for (const row of empresaRows) {
    snapshot.set(row.supplier_id, empresaVisible(row))
  }

  await knex.schema.alterTable('supplier_persona_natural', (table) => {
    table.text('document_type_code').nullable()
    table.text('document_number').nullable()
  })
  await knex.schema.alterTable('supplier_empresa', (table) => {
    table.text('document_type_code').nullable()
    table.text('document_number').nullable()
    table.text('rep_document_type_code').nullable()
    table.text('rep_document_number').nullable()
  })

  for (const row of personaRows) {
    const document_number = canonicalFromParts(row.rut_body, row.rut_dv)
    await knex('supplier_persona_natural').where({ supplier_id: row.supplier_id }).update({
      document_type_code: 'RUT',
      document_number
    })
  }
  for (const row of empresaRows) {
    const document_number = canonicalFromParts(row.rut_empresa_body, row.rut_empresa_dv)
    const rep = canonicalFromParts(row.rut_rep_legal_body, row.rut_rep_legal_dv)
    await knex('supplier_empresa').where({ supplier_id: row.supplier_id }).update({
      document_type_code: 'RUT',
      document_number,
      rep_document_type_code: rep ? 'RUT' : null,
      rep_document_number: rep
    })
  }

  const afterPersona = await knex('supplier_persona_natural').select('supplier_id', 'document_number')
  const afterEmpresa = await knex('supplier_empresa').select('supplier_id', 'document_number')
  const mismatches = []
  for (const row of [...afterPersona, ...afterEmpresa]) {
    const expected = snapshot.get(row.supplier_id)
    const actual = displayFromCanonical(row.document_number)
    if (expected !== actual) {
      mismatches.push(row.supplier_id)
    }
  }
  if (mismatches.length) {
    throw new Error(
      `identificador-tributario-por-pais: el RUT visible cambió en ${mismatches.length} proveedor(es). Abortando antes del DROP.`
    )
  }

  const exists = await knex.schema.hasTable(BACKUP_TABLE)
  if (!exists) {
    await knex.schema.createTable(BACKUP_TABLE, (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
      table.uuid('supplier_id').notNullable()
      table.text('child_kind').notNullable()
      table.jsonb('row_json').notNullable()
      table.text('note')
      table.timestamp('backed_up_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
    await knex.raw(`
      ALTER TABLE ${BACKUP_TABLE}
      ADD CONSTRAINT supplier_child_backup_kind_check
      CHECK (child_kind IN ('persona_natural', 'empresa'))
    `)
  }

  const backupRows = [
    ...personaRows.map((row) => ({
      supplier_id: row.supplier_id,
      child_kind: 'persona_natural',
      row_json: JSON.parse(JSON.stringify(row)),
      note: BACKUP_NOTE
    })),
    ...empresaRows.map((row) => ({
      supplier_id: row.supplier_id,
      child_kind: 'empresa',
      row_json: JSON.parse(JSON.stringify(row)),
      note: BACKUP_NOTE
    }))
  ]
  if (backupRows.length) {
    await knex(BACKUP_TABLE).insert(backupRows)
  }

  await knex.raw(`
    ALTER TABLE supplier_persona_natural
    ALTER COLUMN document_type_code SET NOT NULL,
    ALTER COLUMN document_number SET NOT NULL
  `)
  await knex.raw(`
    ALTER TABLE supplier_empresa
    ALTER COLUMN document_type_code SET NOT NULL,
    ALTER COLUMN document_number SET NOT NULL
  `)

  await knex.schema.alterTable('supplier_persona_natural', (table) => {
    table
      .foreign('document_type_code', 'spn_document_type_code_fk')
      .references('code')
      .inTable('identity_document_type')
      .onDelete('RESTRICT')
  })
  await knex.schema.alterTable('supplier_empresa', (table) => {
    table
      .foreign('document_type_code', 'se_document_type_code_fk')
      .references('code')
      .inTable('identity_document_type')
      .onDelete('RESTRICT')
    table
      .foreign('rep_document_type_code', 'se_rep_document_type_code_fk')
      .references('code')
      .inTable('identity_document_type')
      .onDelete('RESTRICT')
  })

  await knex.schema.alterTable('supplier_persona_natural', (table) => {
    table.dropColumn('rut_body')
    table.dropColumn('rut_dv')
  })
  await knex.schema.alterTable('supplier_empresa', (table) => {
    table.dropColumn('rut_empresa_body')
    table.dropColumn('rut_empresa_dv')
    table.dropColumn('rut_rep_legal_body')
    table.dropColumn('rut_rep_legal_dv')
  })
}

exports.down = async function down(knex) {
  const backups = await knex(BACKUP_TABLE).where({ note: BACKUP_NOTE }).select('*')
  if (!backups.length) {
    throw new Error(
      'identificador-tributario-por-pais: no hay filas en supplier_child_backup; no se reconstruye desde document_number.'
    )
  }

  await knex.schema.alterTable('supplier_persona_natural', (table) => {
    table.dropForeign('document_type_code', 'spn_document_type_code_fk')
  })
  await knex.schema.alterTable('supplier_empresa', (table) => {
    table.dropForeign('document_type_code', 'se_document_type_code_fk')
    table.dropForeign('rep_document_type_code', 'se_rep_document_type_code_fk')
  })

  await knex.schema.alterTable('supplier_persona_natural', (table) => {
    table.text('rut_body').nullable()
    table.text('rut_dv').nullable()
  })
  await knex.schema.alterTable('supplier_empresa', (table) => {
    table.text('rut_empresa_body').nullable()
    table.text('rut_empresa_dv').nullable()
    table.text('rut_rep_legal_body').nullable()
    table.text('rut_rep_legal_dv').nullable()
  })

  for (const b of backups) {
    const row = typeof b.row_json === 'string' ? JSON.parse(b.row_json) : b.row_json
    if (!row || typeof row !== 'object') {
      throw new Error(`identificador-tributario-por-pais: row_json inválido para ${b.supplier_id}`)
    }
    if (b.child_kind === 'persona_natural') {
      if (row.rut_body == null || row.rut_dv == null) {
        throw new Error(`identificador-tributario-por-pais: backup sin rut_* para ${b.supplier_id}`)
      }
      await knex('supplier_persona_natural').where({ supplier_id: b.supplier_id }).update({
        rut_body: row.rut_body,
        rut_dv: row.rut_dv
      })
    } else if (b.child_kind === 'empresa') {
      if (row.rut_empresa_body == null || row.rut_empresa_dv == null) {
        throw new Error(`identificador-tributario-por-pais: backup sin rut_empresa_* para ${b.supplier_id}`)
      }
      await knex('supplier_empresa').where({ supplier_id: b.supplier_id }).update({
        rut_empresa_body: row.rut_empresa_body,
        rut_empresa_dv: row.rut_empresa_dv,
        rut_rep_legal_body: row.rut_rep_legal_body ?? null,
        rut_rep_legal_dv: row.rut_rep_legal_dv ?? null
      })
    }
  }

  await knex.raw(`
    ALTER TABLE supplier_persona_natural
    ALTER COLUMN rut_body SET NOT NULL,
    ALTER COLUMN rut_dv SET NOT NULL
  `)
  await knex.raw(`
    ALTER TABLE supplier_empresa
    ALTER COLUMN rut_empresa_body SET NOT NULL,
    ALTER COLUMN rut_empresa_dv SET NOT NULL
  `)

  await knex.schema.alterTable('supplier_persona_natural', (table) => {
    table.dropColumn('document_type_code')
    table.dropColumn('document_number')
  })
  await knex.schema.alterTable('supplier_empresa', (table) => {
    table.dropColumn('document_type_code')
    table.dropColumn('document_number')
    table.dropColumn('rep_document_type_code')
    table.dropColumn('rep_document_number')
  })

  await knex(BACKUP_TABLE).where({ note: BACKUP_NOTE }).del()
  const leftover = await knex(BACKUP_TABLE).count('id as n').first()
  if (!leftover || Number(leftover.n) === 0) {
    await knex.schema.dropTableIfExists(BACKUP_TABLE)
  }
}
