const crypto = require('crypto')
const { FirmeClientError } = require('../lib/firmeClient')
const { createFirmeSigningService } = require('../services/firmeSigningService')
const { sha256Hex } = require('../services/contractSigningService')
const { computeRutDv } = require('../utils/rut')

const IDS = {
  draft: '11111111-1111-4111-8111-111111111111',
  company: '44444444-4444-4444-8444-444444444444',
  supplier: '55555555-5555-4555-8555-555555555555',
  template: '66666666-6666-4666-8666-666666666666',
  profile: '33333333-3333-4333-8333-333333333333'
}

function validRut() {
  const body = '12345678'
  return `${body}-${computeRutDv(body)}`
}

function baseRows(overrides = {}) {
  return {
    draft_document: [
      {
        id: IDS.draft,
        status: 'draft',
        company_id: IDS.company,
        supplier_id: IDS.supplier,
        template_id: IDS.template,
        client_id: null,
        gcs_path: 'contratos/original.pdf',
        contract_overrides: { fecha_contrato: '2026-10-01' },
        content_snapshot: { type: 'doc', content: [] },
        ...(overrides.draft || {})
      }
    ],
    supplier: [
      {
        id: IDS.supplier,
        supplier_type: overrides.supplierType || 'persona_natural',
        email: 'ana@ejemplo.cl'
      }
    ],
    supplier_persona_natural: [
      {
        supplier_id: IDS.supplier,
        document_type_code: overrides.documentType || 'RUT',
        full_name: 'Ana Pérez',
        first_names: 'Ana',
        last_name: 'Pérez',
        maternal_last_name: 'Soto',
        document_number: '12.345.678-5'
      }
    ],
    supplier_empresa: overrides.empresa ? [overrides.empresa] : [],
    company: [
      {
        id: IDS.company,
        business_name: 'Incrementa SpA',
        short_name: 'Incrementa',
        email: 'empresa@test.cl',
        ...(overrides.company || {})
      }
    ],
    template: [{ id: IDS.template, name: 'Servicios', code: 'SERV' }],
    user_profile: [{ id: IDS.profile, full_name: 'Yerko' }],
    firme_signing: overrides.attempts || [],
    document: overrides.documents || [],
    firme_webhook_event: []
  }
}

function signeeInput(extra = {}) {
  return {
    firstName: 'Ana',
    lastName: 'Pérez',
    maternalLastName: '',
    documentNumber: validRut(),
    email: 'ana@ejemplo.cl',
    ...extra
  }
}

function createSigningHarness(options = {}) {
  const ops = []
  const pdf = options.pdf || Buffer.from('PDF-ESTAMPADO')
  const memory = createMemoryDb(baseRows(options.rows || {}))
  const stored = []
  const blobs = options.blobs || new Map()

  function db(table) {
    const chain = memory(table)
    const insert = chain.insert.bind(chain)
    chain.insert = (row) => {
      if (String(table).startsWith('firme_signing') && row.status === 'sending') ops.push('reserve')
      return insert(row)
    }
    return chain
  }
  db.transaction = (fn) => memory.transaction(fn)
  db.tables = memory.tables
  db.events = memory.events
  Object.defineProperty(db, 'skipLocks', {
    get() {
      return memory.skipLocks
    },
    set(value) {
      memory.skipLocks = value
    }
  })
  Object.defineProperty(db, 'lockedIds', {
    get() {
      return memory.lockedIds
    },
    set(value) {
      memory.lockedIds = value
    }
  })
  Object.defineProperty(db, 'failDocumentInsert', {
    get() {
      return memory.failDocumentInsert
    },
    set(value) {
      memory.failDocumentInsert = value
    }
  })

  const calls = { getDocument: [], deleteDocument: [], send: [], quota: 0, resend: [], evidence: 0, download: 0 }
  const emails = []
  const client = {
    async getQuota() {
      ops.push('quota')
      calls.quota += 1
      if (options.quotaError) throw options.quotaError
      return { simple: options.simple === undefined ? 4 : options.simple }
    },
    async getDocument(code) {
      calls.getDocument.push(code)
      if (options.getDocument) return options.getDocument(code)
      return { status: 'DRAFT', signedOn: null, signees: [] }
    },
    async deleteDocument(code) {
      calls.deleteDocument.push(code)
      ops.push('delete')
      return { deleted: true }
    },
    async downloadSignedPdf(code) {
      calls.download += 1
      if (options.downloadSignedPdf) return options.downloadSignedPdf(code)
      return Buffer.from('firmado')
    },
    async collectEvidence() {
      calls.evidence += 1
      return options.evidence || { logs: [{ id: 'log-1' }], signees: [{ events: [{ type: 'open' }], certificates: [] }] }
    },
    async resendInvitation(code, privateCode) {
      calls.resend.push({ code, privateCode })
      if (options.resendError) throw options.resendError
      return { resent: true }
    },
    async sendForSignature(input, sendOptions) {
      ops.push('send')
      calls.send.push(input)
      if (options.onSend) return options.onSend(input, sendOptions, { db: memory, ops })
      if (sendOptions?.onProgress) {
        await sendOptions.onProgress({
          transactionId: 'tx-1',
          documentCode: 'doc-1',
          signees: [{ email: input.signees[0].email, privateCode: 'priv-1' }]
        })
      }
      return {
        transactionId: 'tx-1',
        documentCode: 'doc-1',
        signees: [{ email: input.signees[0].email, privateCode: 'priv-1' }]
      }
    }
  }

  const storageService = {
    async uploadBuffer({ buffer, gcsPath }) {
      ops.push('store')
      stored.push({ buffer, gcsPath })
      blobs.set(gcsPath, Buffer.from(buffer))
      return gcsPath
    },
    async uploadBufferOnce({ buffer, gcsPath }) {
      ops.push('store-once')
      const existing = blobs.get(gcsPath)
      if (existing) {
        if (sha256Hex(existing) === sha256Hex(buffer)) return { created: false }
        const err = new Error('Ya existe un archivo distinto en esa ruta.')
        err.code = 'STORAGE_CONFLICT'
        throw err
      }
      blobs.set(gcsPath, Buffer.from(buffer))
      stored.push({ buffer, gcsPath, once: true })
      return { created: true }
    },
    async downloadBuffer({ gcsPath }) {
      if (options.originalPdf) return options.originalPdf
      if (blobs.has(gcsPath)) return Buffer.from(blobs.get(gcsPath))
      return Buffer.from('PDF-ORIGINAL')
    }
  }

  const service = createFirmeSigningService({
    db,
    storageService,
    emailService: {
      async sendSignedContractEmail(payload) {
        emails.push(payload)
        if (options.emailResult) return options.emailResult
        if (options.emailError) throw options.emailError
        return { ok: true }
      }
    },
    firmeClient: client,
    now: () => options.now || new Date('2026-10-26T15:00:00.000Z'),
    environment: options.environment === undefined ? 'dev' : options.environment,
    firmeConfigured: options.firmeConfigured === undefined ? true : options.firmeConfigured,
    buildStampedPdf:
      options.buildStampedPdf ||
      (async () => {
        ops.push('stamp')
        return {
          buffer: pdf,
          sha256: sha256Hex(pdf),
          byteLength: pdf.length,
          stamp: { page: 2, x: 0.335, y: 0.8 }
        }
      }),
    logger: { error() {} }
  })

  return { service, db, memory, ops, pdf, calls, client, stored, blobs, emails, IDS }
}

function attemptRow(extra = {}) {
  return {
    id: extra.id || 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    draft_document_id: IDS.draft,
    attempt: extra.attempt || 1,
    status: extra.status || 'pending_signature',
    document_id: extra.document_id || 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    approved_by: IDS.profile,
    approved_at: extra.approved_at || new Date('2026-10-26T15:00:00.000Z'),
    signee_first_name: 'Ana',
    signee_last_name: 'Pérez',
    signee_maternal_last_name: '.',
    signee_rut: validRut(),
    signee_email: 'ana@ejemplo.cl',
    firme_document_code: extra.firme_document_code === undefined ? 'doc-1' : extra.firme_document_code,
    firme_signee_private_code: 'priv-1',
    stamped_sha256: extra.stamped_sha256,
    stamped_byte_length: extra.stamped_byte_length,
    ...extra
  }
}

function cloneRow(row) {
  const copy = { ...row }
  return copy
}

function cloneTables(tables) {
  const copy = {}
  for (const [name, rows] of Object.entries(tables)) {
    copy[name] = rows.map(cloneRow)
  }
  return copy
}

function createMemoryDb(initial = {}) {
  const tables = {}
  for (const [name, rows] of Object.entries(initial)) {
    tables[name] = rows.map(cloneRow)
  }
  const events = []

  function ensure(name) {
    const table = String(name).split(/\s+/)[0]
    if (!tables[table]) tables[table] = []
    return table
  }

  function remember(table, row, ignoreConflict) {
    const rows = tables[table]
    if (table === 'firme_webhook_event' && ignoreConflict && row.event_id != null) {
      if (rows.some((item) => item.event_id === row.event_id)) return { ignored: true }
    }
    if (table === 'firme_signing') {
      const active = row.status === 'sending' || row.status === 'pending_signature'
      const clash = rows.some(
        (item) =>
          item.draft_document_id === row.draft_document_id &&
          (item.status === 'sending' || item.status === 'pending_signature')
      )
      if (active && clash) {
        const err = new Error('unique active attempt')
        err.code = '23505'
        throw err
      }
      if (rows.some((item) => item.draft_document_id === row.draft_document_id && item.attempt === row.attempt)) {
        const err = new Error('unique attempt')
        err.code = '23505'
        throw err
      }
    }
    if (table === 'document' && db.failDocumentInsert) {
      db.failDocumentInsert = false
      const err = new Error('insert failed')
      err.code = 'PERSIST_FAILED'
      throw err
    }
    rows.push(cloneRow(row))
    events.push({ op: 'insert', table, id: row.id, status: row.status })
    return { ignored: false }
  }

  function query(tableName) {
    const table = ensure(tableName)
    const state = { eq: {}, skip: false }

    function matched() {
      return tables[table].filter((row) =>
        Object.entries(state.eq).every(([key, value]) => row[key] === value)
      )
    }

    const chain = {
      where(column, value) {
        if (value === undefined && column && typeof column === 'object') Object.assign(state.eq, column)
        else state.eq[column] = value
        return chain
      },
      forUpdate() {
        return chain
      },
      skipLocked() {
        state.skip = true
        return chain
      },
      orderBy() {
        return chain
      },
      select() {
        return chain
      },
      first() {
        if (state.skip && db.skipLocks) return Promise.resolve(null)
        const found = matched()
        if (state.skip && found[0] && db.lockedIds && db.lockedIds.has(found[0].id)) return Promise.resolve(null)
        return Promise.resolve(found[0] ? found[0] : null)
      },
      update(patch) {
        const targets = matched()
        for (const row of targets) Object.assign(row, patch)
        events.push({ op: 'update', table, ids: targets.map((row) => row.id), patch: { ...patch } })
        return Promise.resolve(targets.length)
      },
      insert(row) {
        let ignoreConflict = false
        const op = {
          onConflict() {
            return {
              ignore() {
                ignoreConflict = true
                return op
              }
            }
          },
          then(resolve, reject) {
            try {
              resolve(remember(table, row, ignoreConflict))
            } catch (err) {
              reject(err)
            }
          }
        }
        return op
      },
      then(resolve, reject) {
        return Promise.resolve(matched().map((row) => row)).then(resolve, reject)
      }
    }
    return chain
  }

  function db(table) {
    return query(table)
  }

  db.transaction = async function transaction(fn) {
    const snapshot = cloneTables(tables)
    try {
      return await fn(db)
    } catch (err) {
      for (const key of Object.keys(tables)) delete tables[key]
      const restored = cloneTables(snapshot)
      for (const [key, rows] of Object.entries(restored)) tables[key] = rows
      throw err
    }
  }

  db.skipLocks = false
  db.lockedIds = null
  db.failDocumentInsert = false
  db.tables = tables
  db.events = events
  return db
}

module.exports = {
  createMemoryDb,
  createSigningHarness,
  attemptRow,
  signeeInput,
  validRut,
  IDS,
  sha256Hex,
  FirmeClientError,
  crypto
}
