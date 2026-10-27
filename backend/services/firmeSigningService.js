const crypto = require('crypto')
const config = require('../config')
const { db: defaultDb } = require('../db/knex')
const { storageService: defaultStorageService } = require('./storageService')
const emailServiceDefault = require('./emailService')
const { createFirmeClient, isFirmeConfigured, FirmeClientError } = require('../lib/firmeClient')
const { verifySnsMessage, isSnsHttpsUrl } = require('../lib/snsVerify')
const { parseRut } = require('../utils/rut')
const { yearMonthInSantiago } = require('./documentBuilderService')
const { buildSignedGcsPath, sanitizeFilePart, sha256Hex } = require('./contractSigningService')
const { createFirmeStampService } = require('./firmeStampService')

const MATERNAL_PLACEHOLDER = '.'
const HUNG_MS = 10 * 60 * 1000
const LINK_TTL_MS = 10 * 24 * 60 * 60 * 1000
const SWEEP_STALE_MS = 10 * 60 * 1000
const SCREEN_STALE_MS = 60 * 1000
const ACTIVE = new Set(['sending', 'pending_signature'])
const LATER = new Set(['PENDING_SIGNATURE', 'SIGNED', 'COMPLETED', 'REJECTED', 'CANCELLED', 'REFUNDED', 'EXPIRED'])
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

const FIRMA_BLOQUEADA = 'La firma está deshabilitada en producción hasta que se configure Firme.'
const ENVIO_EN_CURSO = 'Este contrato ya tiene un envío a firma en curso.'
const RUT_INVALIDO = 'El RUT del firmante no es válido.'
const RUT_FIRME = 'Firme no aceptó el RUT del firmante.'
const ENLACE_NO_RENOVABLE =
  'Firme no permite renovar este enlace; use «Reenviar a firma» (usa 1 crédito nuevo).'
const NO_CREDITS = 'No quedan créditos de firma en Firme para completar el envío.'

function fail(status, code, message) {
  return { ok: false, status, code, message }
}

function isEmail(value) {
  if (typeof value !== 'string' || /\s/.test(value)) return false
  const parts = value.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  return Boolean(local && domain && domain.includes('.'))
}

function clipName(templateName, supplierName) {
  const name = `Contrato Incrementa — ${templateName || 'Plantilla'} — ${supplierName || 'Proveedor'}`
  return name.length <= 120 ? name : name.slice(0, 120)
}

function signeeFullName(row) {
  const maternal = row.signee_maternal_last_name === MATERNAL_PLACEHOLDER ? '' : row.signee_maternal_last_name
  return [row.signee_first_name, row.signee_last_name, maternal].filter(Boolean).join(' ')
}

function siblingPath(gcsPath, fileName) {
  const slash = String(gcsPath).lastIndexOf('/')
  return `${gcsPath.slice(0, slash + 1)}${fileName}`
}

function isUniqueViolation(err) {
  return err?.code === '23505'
}

function isFirmeRutRejection(err) {
  return err instanceof FirmeClientError && err.status === 422 && err.step === 'signees' && String(err.message).includes('RUT ingresado no es válido')
}

function firmeStatusFor(err) {
  if (err?.code === 'FIRME_NO_CREDITS') return 402
  return 502
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    const sorted = {}
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key])
    return sorted
  }
  return value
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value))
}

function evidenceCore(parsed) {
  return {
    events: parsed?.events || [],
    firmeDocumentCode: parsed?.firmeDocumentCode ?? null,
    logs: parsed?.logs || [],
    signedOn: parsed?.signedOn ?? null
  }
}

function sameEvidence(stored, incoming) {
  try {
    const left = JSON.parse(Buffer.isBuffer(stored) ? stored.toString('utf8') : String(stored))
    const right = JSON.parse(Buffer.isBuffer(incoming) ? incoming.toString('utf8') : String(incoming))
    return stableJson(evidenceCore(left)) === stableJson(evidenceCore(right))
  } catch {
    return false
  }
}

function verificationInstant(remote, fallback) {
  if (remote?.signedOn) {
    const parsed = new Date(remote.signedOn)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return fallback
}

function createFirmeSigningService({
  db = defaultDb,
  storageService = defaultStorageService,
  emailService = emailServiceDefault,
  firmeClient,
  now = () => new Date(),
  logger = console,
  environment,
  firmeConfigured,
  buildStampedPdf,
  fetchImpl,
  snsTopicArn = null
} = {}) {
  const client = firmeClient || createFirmeClient()
  const stampPdf = buildStampedPdf || createFirmeStampService({ db, storageService, now }).buildStampedPdf
  const fetchFn = fetchImpl || global.fetch
  const expectedTopicArn = snsTopicArn ? String(snsTopicArn) : null

  function clock() {
    return new Date(now())
  }

  function currentEnv() {
    return environment === undefined ? config.ENVIRONMENT : environment
  }

  function configured() {
    return firmeConfigured === undefined ? isFirmeConfigured() : Boolean(firmeConfigured)
  }

  function logError(message) {
    const sink = logger && typeof logger.error === 'function' ? logger.error.bind(logger) : console.error
    sink(`[firmeSigningService] ${message}`)
  }

  async function rows(conn, table, criteria) {
    const query = conn(table)
    const chain = criteria ? query.where(criteria) : query
    const result = await chain
    return Array.isArray(result) ? result : []
  }

  async function supplierDocumentType(draft) {
    if (!draft) return null
    const supplier = await db('supplier').where({ id: draft.supplier_id }).first()
    if (!supplier) return null
    if (supplier.supplier_type === 'empresa') {
      const empresa = await db('supplier_empresa').where({ supplier_id: supplier.id }).first()
      return empresa?.document_type_code || null
    }
    const persona = await db('supplier_persona_natural').where({ supplier_id: supplier.id }).first()
    return persona?.document_type_code || null
  }

  async function getSigningMode(draftDocumentId) {
    if (currentEnv() === 'prod' && !configured()) return 'blocked'
    if (!configured()) return 'internal'
    const draft = await db('draft_document').where({ id: draftDocumentId }).first()
    const documentType = await supplierDocumentType(draft)
    return documentType === 'RUT' ? 'firme' : 'internal'
  }

  function isHung(row, current) {
    if (!row || row.status !== 'sending') return false
    const approved = new Date(row.approved_at).getTime()
    return Number.isFinite(approved) && current.getTime() - approved > HUNG_MS
  }

  async function attemptsFor(draftDocumentId) {
    return rows(db, 'firme_signing', { draft_document_id: draftDocumentId })
  }

  async function markFailed(id, code, message) {
    await db('firme_signing').where({ id, status: 'sending' }).update({
      status: 'send_failed',
      last_error_code: code,
      last_error_message: message,
      updated_at: clock()
    })
  }

  async function adoptSending(row, remote) {
    let adopted = false
    await db.transaction(async (trx) => {
      const locked = await trx('firme_signing')
        .where({ id: row.id, status: 'sending' })
        .forUpdate()
        .skipLocked()
        .first()
      if (!locked) return
      await trx('firme_signing').where({ id: row.id, status: 'sending' }).update({
        status: 'pending_signature',
        firme_status: remote?.status || null,
        updated_at: clock()
      })
      await trx('draft_document').where({ id: row.draft_document_id }).update({ status: 'in_signature' })
      adopted = true
    })
    return adopted
  }

  async function putImmutable(buffer, gcsPath, contentType) {
    try {
      await storageService.uploadBufferOnce({ buffer, gcsPath, contentType })
    } catch (err) {
      if (err?.code !== 'STORAGE_CONFLICT' || contentType !== 'application/json') throw err
      let existing
      try {
        existing = await storageService.downloadBuffer({ gcsPath })
      } catch {
        throw err
      }
      if (!sameEvidence(existing, buffer)) throw err
    }
  }

  async function persistProgress(signingId, progress) {
    if (!progress || typeof progress !== 'object') return
    const patch = { updated_at: clock() }
    let changed = false
    if (progress.transactionId) {
      patch.firme_transaction_id = progress.transactionId
      changed = true
    }
    if (progress.documentCode) {
      patch.firme_document_code = progress.documentCode
      changed = true
    }
    const privateCode = progress.signees?.[0]?.privateCode
    if (privateCode) {
      patch.firme_signee_private_code = privateCode
      changed = true
    }
    if (!changed) return
    await db('firme_signing').where({ id: signingId }).update(patch)
  }

  async function recoverHung(row) {
    if (!row.firme_document_code) {
      await markFailed(row.id, 'ENVIO_INTERRUMPIDO', 'El envío a firma se interrumpió antes de crear el documento.')
      return 'failed'
    }
    let remote
    try {
      remote = await client.getDocument(row.firme_document_code)
    } catch (err) {
      await db('firme_signing').where({ id: row.id, status: 'sending' }).update({
        last_error_code: err.code || 'FIRME_NETWORK_ERROR',
        last_error_message: err.message || 'No se pudo conectar con Firme.',
        updated_at: clock()
      })
      return 'error'
    }
    if (remote?.status === 'DRAFT') {
      try {
        await client.deleteDocument(row.firme_document_code)
      } catch (err) {
        logError(`no se pudo borrar el documento DRAFT (${err.code || 'ERROR'})`)
      }
      await markFailed(
        row.id,
        'ENVIO_INTERRUMPIDO',
        'El envío a firma se interrumpió. Se descartó el documento en borrador.'
      )
      return 'failed'
    }
    if (remote?.status === 'PENDING_SIGNATURE' || LATER.has(remote?.status)) {
      const adopted = await adoptSending(row, remote)
      return adopted ? 'adopted' : 'blocked'
    }
    return 'blocked'
  }

  async function reconcileAfterSendError(row) {
    let remote
    try {
      remote = await client.getDocument(row.firme_document_code)
    } catch (lookupErr) {
      logError(`no se pudo consultar el documento tras el fallo (${lookupErr.code || 'ERROR'})`)
      return { pending: true }
    }
    if (remote?.status === 'PENDING_SIGNATURE' || LATER.has(remote?.status)) {
      const adopted = await adoptSending(row, remote)
      return adopted ? { adopted: true } : { pending: true }
    }
    if (!remote?.status || remote.status === 'DRAFT') {
      try {
        await client.deleteDocument(row.firme_document_code)
      } catch (cleanupErr) {
        logError(`no se pudo borrar el documento tras el fallo (${cleanupErr.code || 'ERROR'})`)
      }
      return { failed: true }
    }
    return { pending: true }
  }

  async function supplierName(supplierId) {
    const supplier = await db('supplier').where({ id: supplierId }).first()
    if (!supplier) return 'Proveedor'
    if (supplier.supplier_type === 'empresa') {
      const empresa = await db('supplier_empresa').where({ supplier_id: supplier.id }).first()
      return empresa?.razon_social || 'Proveedor'
    }
    const persona = await db('supplier_persona_natural').where({ supplier_id: supplier.id }).first()
    return persona?.full_name || 'Proveedor'
  }

  function enFirmaPath({ companyId, supplierId, templateCode, attemptId, suffix }) {
    const { year, month } = yearMonthInSantiago(clock())
    const codePart = sanitizeFilePart(templateCode || 'template')
    return `contratos-en-firma/${companyId}/${supplierId}/${codePart}/${year}/${month}/${attemptId}_${suffix}.pdf`
  }

  async function sendToFirme({ draftDocumentId, signee, approvedByUserProfileId }) {
    const draft = await db('draft_document').where({ id: draftDocumentId }).first()
    if (!draft) return fail(404, 'NOT_FOUND', 'Borrador de contrato no encontrado.')

    const mode = await getSigningMode(draftDocumentId)
    if (mode === 'blocked') return fail(409, 'FIRMA_BLOQUEADA', FIRMA_BLOQUEADA)
    if (mode !== 'firme') return fail(409, 'NO_APLICA_FIRME', 'Este contrato no se envía por Firme.')

    const current = clock()
    const existing = await attemptsFor(draftDocumentId)
    const hung = existing.filter((row) => isHung(row, current))
    const active = existing.filter((row) => ACTIVE.has(row.status) && !isHung(row, current))
    const statusOk = draft.status === 'draft' || (draft.status === 'in_signature' && active.length === 0)
    if (!statusOk) return fail(409, 'INVALID_STATUS', 'Este contrato no está pendiente de envío a firma.')

    const source = signee && typeof signee === 'object' ? signee : {}
    const rut = parseRut(source.documentNumber)
    if (!rut.ok) return fail(422, 'RUT_INVALIDO', RUT_INVALIDO)
    const firstName = typeof source.firstName === 'string' ? source.firstName.trim() : ''
    const lastName = typeof source.lastName === 'string' ? source.lastName.trim() : ''
    const email = typeof source.email === 'string' ? source.email.trim() : ''
    if (!firstName) return fail(422, 'FIRMANTE_INCOMPLETO', 'El campo nombres del firmante está incompleto.')
    if (!lastName) return fail(422, 'FIRMANTE_INCOMPLETO', 'El campo apellido paterno del firmante está incompleto.')
    if (!email || !isEmail(email)) {
      return fail(422, 'FIRMANTE_INCOMPLETO', 'El campo correo del firmante está incompleto.')
    }
    const maternalRaw = typeof source.maternalLastName === 'string' ? source.maternalLastName.trim() : ''
    const maternalLastName = maternalRaw || MATERNAL_PLACEHOLDER

    for (const row of hung) {
      const outcome = await recoverHung(row)
      if (outcome === 'adopted') {
        return { ok: true, status: 202, data: { signingId: row.id, status: 'pending_signature' } }
      }
      if (outcome === 'error' || outcome === 'blocked') {
        return fail(502, 'ENVIO_INTERRUMPIDO', 'No se pudo recuperar el envío anterior. Intente nuevamente.')
      }
    }

    const signer = await db('user_profile').where({ id: approvedByUserProfileId }).first()
    if (!signer) return fail(404, 'SIGNER_NOT_FOUND', 'No se encontró el perfil del firmante.')
    const company = await db('company').where({ id: draft.company_id }).first()
    if (!company) return fail(404, 'COMPANY_NOT_FOUND', 'Empresa asociada al contrato no encontrada.')
    const template = await db('template').where({ id: draft.template_id }).first()
    if (!template) return fail(404, 'TEMPLATE_NOT_FOUND', 'Plantilla asociada al contrato no encontrada.')

    const refreshed = await attemptsFor(draftDocumentId)
    const maxAttempt = refreshed.reduce((max, row) => Math.max(max, Number(row.attempt) || 0), 0)
    const signingId = crypto.randomUUID()
    const documentId = crypto.randomUUID()
    const proveedor = await supplierName(draft.supplier_id)
    try {
      await db('firme_signing').insert({
        id: signingId,
        draft_document_id: draftDocumentId,
        attempt: maxAttempt + 1,
        status: 'sending',
        document_id: documentId,
        approved_by: approvedByUserProfileId,
        approved_at: current,
        signee_first_name: firstName,
        signee_last_name: lastName,
        signee_maternal_last_name: maternalLastName,
        signee_rut: `${rut.rut_body}-${rut.rut_dv}`,
        signee_email: email,
        created_at: current,
        updated_at: current
      })
    } catch (err) {
      if (isUniqueViolation(err)) return fail(409, 'ENVIO_EN_CURSO', ENVIO_EN_CURSO)
      throw err
    }

    let quota
    try {
      quota = await client.getQuota()
    } catch (err) {
      await markFailed(signingId, err.code || 'FIRME_API_ERROR', err.message || 'No se pudo consultar la cuota de Firme.')
      return fail(firmeStatusFor(err), err.code || 'FIRME_API_ERROR', err.message || 'No se pudo consultar la cuota de Firme.')
    }
    if (Number(quota?.simple) < 1) {
      await markFailed(signingId, 'FIRME_NO_CREDITS', NO_CREDITS)
      return fail(402, 'FIRME_NO_CREDITS', NO_CREDITS)
    }

    let stamped
    try {
      stamped = await stampPdf({ draft, company, signer, template })
    } catch (err) {
      const code = err.code === 'RUBRICA_NO_DISPONIBLE' ? 'RUBRICA_NO_DISPONIBLE' : 'PDF_SIGN_FAILED'
      const message = err.code === 'RUBRICA_NO_DISPONIBLE'
        ? err.message
        : 'No se pudo preparar el PDF para el envío a firma.'
      await markFailed(signingId, code, message)
      return fail(err.status || 500, code, message)
    }

    const stampedPath = enFirmaPath({
      companyId: draft.company_id,
      supplierId: draft.supplier_id,
      templateCode: template.code,
      attemptId: signingId,
      suffix: 'estampado'
    })
    try {
      await storageService.uploadBuffer({
        buffer: stamped.buffer,
        gcsPath: stampedPath,
        contentType: 'application/pdf'
      })
    } catch (err) {
      logError(`no se pudo guardar el PDF estampado (${err.code || 'ERROR'})`)
      await markFailed(signingId, 'GCS_UPLOAD_FAILED', 'No se pudo guardar el PDF estampado.')
      return fail(500, 'GCS_UPLOAD_FAILED', 'No se pudo guardar el PDF estampado.')
    }

    await db('firme_signing').where({ id: signingId }).update({
      stamped_gcs_path: stampedPath,
      stamped_sha256: stamped.sha256,
      stamped_byte_length: stamped.byteLength,
      stamp_page: stamped.stamp?.page,
      stamp_x: stamped.stamp?.x,
      stamp_y: stamped.stamp?.y,
      updated_at: clock()
    })

    let sent
    try {
      sent = await client.sendForSignature(
        {
          pdf: stamped.buffer,
          name: clipName(template.name, proveedor),
          signees: [
            {
              firstName,
              lastName,
              maternalLastName,
              documentNumber: `${rut.rut_body}-${rut.rut_dv}`,
              email,
              signature: {
                page: stamped.stamp.page,
                x: stamped.stamp.x,
                y: stamped.stamp.y
              }
            }
          ]
        },
        {
          onProgress: (progress) => persistProgress(signingId, progress)
        }
      )
    } catch (err) {
      await persistProgress(signingId, err.progress)
      const stored = await db('firme_signing').where({ id: signingId }).first()
      const code = stored?.firme_document_code
      if (isFirmeRutRejection(err) && code) {
        try {
          const remote = await client.getDocument(code)
          if (remote?.status === 'DRAFT') await client.deleteDocument(code)
        } catch (cleanupErr) {
          logError(`no se pudo borrar el documento con RUT rechazado (${cleanupErr.code || 'ERROR'})`)
        }
        await markFailed(signingId, 'RUT_INVALIDO', RUT_FIRME)
        return fail(422, 'RUT_INVALIDO', RUT_FIRME)
      }
      if (code) {
        const outcome = await reconcileAfterSendError(stored)
        if (outcome.adopted) {
          return { ok: true, status: 202, data: { signingId, status: 'pending_signature' } }
        }
        if (outcome.pending) {
          return fail(
            502,
            'ENVIO_INTERRUMPIDO',
            'No se pudo confirmar el estado del envío en Firme. Intente nuevamente.'
          )
        }
      }
      const errorCode = err.code || 'FIRME_API_ERROR'
      const errorMessage = err.message || 'No se pudo enviar el contrato a Firme.'
      await markFailed(signingId, errorCode, errorMessage)
      return fail(firmeStatusFor(err), errorCode, errorMessage)
    }

    await db.transaction(async (trx) => {
      await trx('firme_signing').where({ id: signingId }).update({
        status: 'pending_signature',
        firme_transaction_id: sent.transactionId,
        firme_document_code: sent.documentCode,
        firme_signee_private_code: sent.signees?.[0]?.privateCode || null,
        firme_status: 'PENDING_SIGNATURE',
        updated_at: clock()
      })
      await trx('draft_document').where({ id: draftDocumentId }).update({ status: 'in_signature' })
    })

    return { ok: true, status: 202, data: { signingId, status: 'pending_signature' } }
  }

  function rejectionDetail(remote, eventReason) {
    const fromSignee = (remote?.signees || []).map((signee) => signee?.rejectionDetail).find(Boolean)
    return fromSignee || eventReason || null
  }

  function expiredByAge(attempt, current) {
    const approved = new Date(attempt.approved_at).getTime()
    const renewed = attempt.link_renewed_at ? new Date(attempt.link_renewed_at).getTime() : null
    const base = renewed != null && renewed > approved ? renewed : approved
    return current.getTime() - base > LINK_TTL_MS
  }

  function linkExpired(attempt, remote, current) {
    const until = (remote?.signees || []).map((signee) => signee?.approvedUntil).find((value) => value != null)
    if (until != null) return new Date(until).getTime() < current.getTime()
    return expiredByAge(attempt, current)
  }

  async function storeMismatch(attempt, signedBuffer) {
    const draft = await db('draft_document').where({ id: attempt.draft_document_id }).first()
    const template = draft ? await db('template').where({ id: draft.template_id }).first() : null
    const path = enFirmaPath({
      companyId: draft?.company_id,
      supplierId: draft?.supplier_id,
      templateCode: template?.code,
      attemptId: attempt.id,
      suffix: 'recibido'
    })
    await storageService.uploadBuffer({ buffer: signedBuffer, gcsPath: path, contentType: 'application/pdf' })
    logError(`HASH_NO_COINCIDE ${attempt.firme_document_code || attempt.id}`)
    return path
  }

  async function sendEmailSafe({ company, proveedorNombre, templateName, signed, fileName }) {
    if (!company?.email) return
    try {
      const result = await emailService.sendSignedContractEmail({
        to: company.email,
        proveedorNombre,
        templateName,
        pdfBuffer: signed,
        fileName
      })
      if (result?.skipped) logError('correo omitido')
    } catch (err) {
      logError(`falló el correo (${err.code || 'ERROR'})`)
    }
  }

  async function lockPending(signingId) {
    let locked = null
    await db.transaction(async (trx) => {
      const row = await trx('firme_signing')
        .where({ id: signingId, status: 'pending_signature' })
        .forUpdate()
        .skipLocked()
        .first()
      if (row) locked = { ...row }
    })
    return locked
  }

  function refreshData(row, extra = {}) {
    return {
      ok: true,
      ...extra,
      data: {
        id: row.id,
        status: row.status,
        draft_document_id: row.draft_document_id,
        rejection_reason: row.rejection_reason,
        last_error_code: row.last_error_code
      }
    }
  }

  async function prepareSigned(attempt, remote) {
    const signed = await client.downloadSignedPdf(attempt.firme_document_code)
    const stampedLen = Number(attempt.stamped_byte_length)
    const prefix = signed.subarray(0, stampedLen)
    const prefixOk = prefix.length === stampedLen && sha256Hex(prefix) === attempt.stamped_sha256
    const longer = signed.length > stampedLen
    const byteRange = signed.includes(Buffer.from('/ByteRange'))
    if (!prefixOk || !longer || !byteRange) {
      await storeMismatch(attempt, signed)
      await db('firme_signing').where({ id: attempt.id, status: 'pending_signature' }).update({
        status: 'hash_mismatch',
        last_error_code: 'HASH_NO_COINCIDE',
        last_error_message: 'El PDF firmado no coincide con el documento aprobado.',
        firme_status: remote?.status || null,
        last_checked_at: clock(),
        updated_at: clock()
      })
      return { mismatch: true }
    }

    const evidence = await client.collectEvidence(
      attempt.firme_document_code,
      attempt.firme_signee_private_code ? [attempt.firme_signee_private_code] : []
    )
    const draft = await db('draft_document').where({ id: attempt.draft_document_id }).first()
    const template = await db('template').where({ id: draft.template_id }).first()
    const company = await db('company').where({ id: draft.company_id }).first()
    const original = await storageService.downloadBuffer({ gcsPath: draft.gcs_path })
    const gcsPath = buildSignedGcsPath({
      companyId: draft.company_id,
      supplierId: draft.supplier_id,
      templateCode: template?.code,
      docId: attempt.document_id
    })
    await putImmutable(signed, gcsPath, 'application/pdf')
    const verifiedAt = verificationInstant(remote, clock())
    const evidencePath = siblingPath(gcsPath, `${attempt.document_id}_evidencia.json`)
    const evidenceBody = Buffer.from(stableJson({
      events: (evidence?.signees || []).flatMap((item) => item.events || []),
      firmeDocumentCode: attempt.firme_document_code,
      logs: evidence?.logs || [],
      signedOn: remote?.signedOn || null,
      verifiedAt: verifiedAt.toISOString()
    }))
    await putImmutable(evidenceBody, evidencePath, 'application/json')
    let certificateIndex = 0
    for (const signee of evidence?.signees || []) {
      for (const certificate of signee.certificates || []) {
        certificateIndex += 1
        await putImmutable(
          certificate.pdf,
          siblingPath(gcsPath, `${attempt.document_id}_correo_${certificateIndex}.pdf`),
          'application/pdf'
        )
      }
    }

    const fileName = `${attempt.document_id}_firmado.pdf`
    const proveedorNombre = await supplierName(draft.supplier_id)
    return {
      mismatch: false,
      draft,
      gcsPath,
      evidencePath,
      fileName,
      verifiedAt,
      signedSha: sha256Hex(signed),
      originalSha: sha256Hex(original),
      signedAt: remote?.signedOn ? new Date(remote.signedOn) : verifiedAt,
      firmeStatus: remote?.status || 'SIGNED',
      signeeSignedOn: remote?.signedOn ? new Date(remote.signedOn) : null,
      email: {
        company,
        proveedorNombre,
        templateName: template?.name,
        signed,
        fileName
      }
    }
  }

  async function commitSigned(attempt, prepared) {
    let wrote = false
    await db.transaction(async (trx) => {
      const still = await trx('firme_signing')
        .where({ id: attempt.id, status: 'pending_signature' })
        .forUpdate()
        .skipLocked()
        .first()
      if (!still) return
      const draft = prepared.draft
      const existing = await trx('document').where({ id: attempt.document_id }).first()
      if (!existing) {
        const overrides = draft.contract_overrides && typeof draft.contract_overrides === 'object'
          ? draft.contract_overrides
          : null
        await trx('document').insert({
          id: attempt.document_id,
          draft_document_id: draft.id,
          supplier_id: draft.supplier_id,
          company_id: draft.company_id,
          template_id: draft.template_id,
          client_id: draft.client_id ?? null,
          contract_overrides: overrides,
          gcs_path: prepared.gcsPath,
          file_name: prepared.fileName,
          source: 'generated',
          signed_at: prepared.signedAt,
          signed_by: signeeFullName(attempt),
          uploaded_by: attempt.approved_by,
          draft_sha256: prepared.originalSha,
          signed_sha256: prepared.signedSha
        })
      }
      await trx('firme_signing').where({ id: attempt.id, status: 'pending_signature' }).update({
        status: 'signed',
        verified_at: prepared.verifiedAt,
        signed_gcs_path: prepared.gcsPath,
        evidence_gcs_path: prepared.evidencePath,
        signed_sha256: prepared.signedSha,
        firme_status: prepared.firmeStatus,
        signee_signed_on: prepared.signeeSignedOn,
        last_checked_at: clock(),
        updated_at: clock()
      })
      await trx('draft_document').where({ id: draft.id }).update({ status: 'signed' })
      wrote = true
    })
    return wrote
  }

  async function applyRemote(trx, attempt, remote, eventReason) {
    const status = remote?.status
    const checked = {
      firme_status: status || null,
      last_checked_at: clock(),
      updated_at: clock()
    }
    if (status === 'SIGNED' || status === 'COMPLETED') {
      return { signed: true }
    }
    if (status === 'REJECTED') {
      await trx('firme_signing').where({ id: attempt.id }).update({
        ...checked,
        status: 'rejected',
        rejection_reason: rejectionDetail(remote, eventReason)
      })
      return { rejected: true }
    }
    if (status === 'CANCELLED' || status === 'REFUNDED') {
      await trx('firme_signing').where({ id: attempt.id }).update({ ...checked, status: 'cancelled' })
      return { cancelled: true }
    }
    if (linkExpired(attempt, remote, clock())) {
      await trx('firme_signing').where({ id: attempt.id }).update({ ...checked, status: 'expired' })
      return { expired: true }
    }
    await trx('firme_signing').where({ id: attempt.id }).update(checked)
    return { waiting: true }
  }

  async function refresh(signingId, options = {}) {
    const current = await db('firme_signing').where({ id: signingId }).first()
    if (!current) return fail(404, 'NOT_FOUND', 'Intento de firma no encontrado.')
    if (current.status !== 'pending_signature') {
      return { ok: true, data: { id: current.id, status: current.status, draft_document_id: current.draft_document_id } }
    }

    const locked = await lockPending(signingId)
    if (!locked) {
      return {
        ok: true,
        skipped: true,
        data: { id: current.id, status: current.status, draft_document_id: current.draft_document_id }
      }
    }

    let remote
    try {
      remote = await client.getDocument(locked.firme_document_code)
    } catch (err) {
      await db('firme_signing').where({ id: signingId, status: 'pending_signature' }).update({
        last_error_code: err.code || 'FIRME_NETWORK_ERROR',
        last_error_message: err.message || 'No se pudo conectar con Firme.',
        last_checked_at: clock(),
        updated_at: clock()
      })
      const row = await db('firme_signing').where({ id: signingId }).first()
      return refreshData(row, { networkError: true })
    }

    if (remote?.status === 'SIGNED' || remote?.status === 'COMPLETED') {
      let prepared
      try {
        prepared = await prepareSigned(locked, remote)
      } catch (err) {
        if (err.code === 'STORAGE_CONFLICT') {
          await db('firme_signing').where({ id: signingId, status: 'pending_signature' }).update({
            last_error_code: 'STORAGE_CONFLICT',
            last_error_message: 'Ya existe un archivo distinto en la ruta reservada.',
            last_checked_at: clock(),
            updated_at: clock()
          })
          return fail(409, 'STORAGE_CONFLICT', 'Ya existe un archivo distinto en la ruta reservada.')
        }
        logError(`refresh no pudo cerrar (${err.code || 'ERROR'})`)
        try {
          await db('firme_signing').where({ id: signingId }).update({
            last_error_code: err.code || 'PERSIST_FAILED',
            last_error_message: 'No se pudo registrar el contrato firmado.',
            updated_at: clock()
          })
        } catch (updateErr) {
          logError(`no se pudo guardar el error de cierre (${updateErr.code || 'ERROR'})`)
        }
        return fail(500, err.code || 'PERSIST_FAILED', 'No se pudo registrar el contrato firmado.')
      }
      if (prepared.mismatch) {
        const row = await db('firme_signing').where({ id: signingId }).first()
        return refreshData(row, { networkError: false })
      }
      try {
        const wrote = await commitSigned(locked, prepared)
        if (!wrote) {
          return {
            ok: true,
            skipped: true,
            data: { id: current.id, status: current.status, draft_document_id: current.draft_document_id }
          }
        }
      } catch (err) {
        logError(`refresh no pudo cerrar (${err.code || 'ERROR'})`)
        try {
          await db('firme_signing').where({ id: signingId }).update({
            last_error_code: err.code || 'PERSIST_FAILED',
            last_error_message: 'No se pudo registrar el contrato firmado.',
            updated_at: clock()
          })
        } catch (updateErr) {
          logError(`no se pudo guardar el error de cierre (${updateErr.code || 'ERROR'})`)
        }
        return fail(500, err.code || 'PERSIST_FAILED', 'No se pudo registrar el contrato firmado.')
      }
      await sendEmailSafe(prepared.email)
      const row = await db('firme_signing').where({ id: signingId }).first()
      return refreshData(row, { networkError: false })
    }

    try {
      await db.transaction(async (trx) => {
        const still = await trx('firme_signing')
          .where({ id: signingId, status: 'pending_signature' })
          .forUpdate()
          .skipLocked()
          .first()
        if (!still) return
        await applyRemote(trx, still, remote, options.rejectionReason)
      })
    } catch (err) {
      logError(`refresh no pudo cerrar (${err.code || 'ERROR'})`)
      return fail(500, err.code || 'PERSIST_FAILED', 'No se pudo registrar el contrato firmado.')
    }
    const row = await db('firme_signing').where({ id: signingId }).first()
    return refreshData(row, { networkError: false })
  }

  async function latestAttempt(draftDocumentId, statuses) {
    const all = await attemptsFor(draftDocumentId)
    const filtered = statuses ? all.filter((row) => statuses.includes(row.status)) : all
    filtered.sort((a, b) => Number(b.attempt) - Number(a.attempt))
    return filtered[0] || null
  }

  async function refreshForDraft(draftDocumentId) {
    const attempt = await latestAttempt(draftDocumentId)
    if (!attempt) return fail(404, 'NOT_FOUND', 'No hay un envío a firma para este contrato.')
    return refresh(attempt.id)
  }

  async function resendLink(signingId) {
    const attempt = await db('firme_signing').where({ id: signingId }).first()
    if (!attempt) return fail(404, 'NOT_FOUND', 'Intento de firma no encontrado.')
    if (attempt.status !== 'pending_signature' && attempt.status !== 'expired') {
      return fail(409, 'INVALID_STATUS', 'Este intento no admite reenviar el enlace.')
    }
    const siblings = await attemptsFor(attempt.draft_document_id)
    const otherActive = siblings.some((row) => row.id !== attempt.id && ACTIVE.has(row.status))
    if (otherActive) return fail(409, 'ENVIO_EN_CURSO', ENVIO_EN_CURSO)

    try {
      await client.resendInvitation(attempt.firme_document_code, attempt.firme_signee_private_code)
    } catch (err) {
      if (err.status === 422) return fail(409, 'ENLACE_NO_RENOVABLE', ENLACE_NO_RENOVABLE)
      return fail(firmeStatusFor(err), err.code || 'FIRME_API_ERROR', err.message || 'No se pudo reenviar el enlace.')
    }

    if (attempt.status === 'expired') {
      await db('firme_signing').where({ id: attempt.id }).update({
        status: 'pending_signature',
        link_renewed_at: clock(),
        updated_at: clock()
      })
    }
    return { ok: true, data: { id: attempt.id, status: attempt.status === 'expired' ? 'pending_signature' : attempt.status } }
  }

  async function resendLinkForDraft(draftDocumentId) {
    const attempt = await latestAttempt(draftDocumentId, ['pending_signature', 'expired'])
    if (!attempt) return fail(409, 'INVALID_STATUS', 'Este contrato no tiene un enlace para reenviar.')
    return resendLink(attempt.id)
  }

  async function listInSignature() {
    const drafts = await rows(db, 'draft_document', { status: 'in_signature' })
    const items = []
    for (const draft of drafts) {
      const latest = await latestAttempt(draft.id)
      if (!latest) continue
      items.push({
        id: draft.id,
        signing_id: latest.id,
        supplier_name: await supplierName(draft.supplier_id),
        signee_first_name: latest.signee_first_name,
        signee_last_name: latest.signee_last_name,
        signee_maternal_last_name: latest.signee_maternal_last_name,
        signee_rut: latest.signee_rut,
        signee_email: latest.signee_email,
        status: latest.status,
        last_error_code: latest.last_error_code ?? null,
        last_error_message: latest.last_error_message ?? null,
        rejection_reason: latest.rejection_reason ?? null,
        approved_at: latest.approved_at,
        attempt: latest.attempt
      })
    }
    return items
  }

  async function getInSignature() {
    const current = clock()
    const pending = await rows(db, 'firme_signing', { status: 'pending_signature' })
    const stale = pending
      .filter((row) => {
        if (!row.last_checked_at) return true
        return current.getTime() - new Date(row.last_checked_at).getTime() > SCREEN_STALE_MS
      })
      .slice(0, 5)
    await Promise.all(stale.map((row) => refresh(row.id).catch((err) => {
      logError(`refresh de pantalla omitido (${err.code || 'ERROR'})`)
    })))
    const items = await listInSignature()
    const body = { ok: true, data: { items } }
    try {
      const quota = await client.getQuota()
      if (quota && Number.isFinite(Number(quota.simple))) body.meta = { credits: Number(quota.simple) }
    } catch (err) {
      logError(`cuota no disponible (${err.code || 'ERROR'})`)
    }
    return body
  }

  async function sweepPending() {
    const summary = { revisados: 0, finalizados: 0, rechazados: 0, vencidos: 0, saltados: 0, errores: 0 }
    const current = clock()
    const sending = await rows(db, 'firme_signing', { status: 'sending' })
    for (const row of sending.filter((item) => isHung(item, current))) {
      try {
        await recoverHung(row)
        summary.revisados += 1
      } catch (err) {
        logError(`barrido de envío colgado (${err.code || 'ERROR'})`)
        summary.errores += 1
      }
    }
    const pending = await rows(db, 'firme_signing', { status: 'pending_signature' })
    const stale = pending
      .filter((row) => {
        if (!row.last_checked_at) return true
        return current.getTime() - new Date(row.last_checked_at).getTime() > SWEEP_STALE_MS
      })
      .slice(0, 20)
    for (const row of stale) {
      try {
        const result = await refresh(row.id)
        if (result.skipped) {
          summary.saltados += 1
          continue
        }
        if (result.networkError || result.ok === false) {
          summary.errores += 1
          continue
        }
        summary.revisados += 1
        if (result.data?.status === 'signed') summary.finalizados += 1
        else if (result.data?.status === 'rejected') summary.rechazados += 1
        else if (result.data?.status === 'expired') summary.vencidos += 1
      } catch (err) {
        logError(`barrido (${err.code || 'ERROR'})`)
        summary.errores += 1
      }
    }
    return summary
  }

  function codeFromPayload(payload) {
    if (payload?.data?.document_code) return String(payload.data.document_code)
    if (payload?.resource_id) return String(payload.resource_id)
    return null
  }

  async function matchPendingCode(code) {
    if (!code) return null
    const pending = await rows(db, 'firme_signing', { status: 'pending_signature' })
    return pending.find((row) => row.firme_document_code === code) || null
  }

  async function insertWebhookEvent(row) {
    if (row.event_id == null) {
      await db('firme_webhook_event').insert(row)
      return
    }
    await db('firme_webhook_event').insert(row).onConflict('event_id').ignore()
  }

  async function handleWebhook({ rawBody, headers }) {
    void headers
    try {
      let message
      try {
        message = JSON.parse(rawBody)
      } catch {
        logError('webhook con cuerpo que no es JSON')
        return { ok: true }
      }

      const verified = await verifySnsMessage(message, { fetchImpl: fetchFn, expectedTopicArn })
      if (!verified.ok) {
        logError(`webhook SNS rechazado (${verified.reason || 'firma'})`)
        return { ok: true }
      }

      let inner = null
      if (message.Type === 'Notification' && typeof message.Message === 'string') {
        try {
          inner = JSON.parse(message.Message)
        } catch {
          inner = null
        }
      }

      let attempt = null
      if (message.Type === 'Notification') {
        let code = inner ? codeFromPayload(inner) : null
        if (!code) {
          const haystack = `${message.Message || ''} ${JSON.stringify(inner || {})}`
          const uuids = haystack.match(UUID_RE) || []
          for (const uuid of uuids) {
            const found = await matchPendingCode(uuid)
            if (found) {
              code = uuid
              attempt = found
              break
            }
          }
        } else {
          attempt = await matchPendingCode(code)
        }
      }

      await insertWebhookEvent({
        id: crypto.randomUUID(),
        event_id: message.MessageId || null,
        sns_message_id: message.MessageId || null,
        received_at: clock(),
        message_type: message.Type || null,
        body: message,
        firme_signing_id: attempt?.id || null
      })

      if (message.Type === 'SubscriptionConfirmation') {
        if (isSnsHttpsUrl(message.SubscribeURL)) {
          try {
            await fetchFn(message.SubscribeURL, { redirect: 'error' })
          } catch (err) {
            logError(`no se pudo confirmar la suscripción (${err.code || 'ERROR'})`)
          }
        } else {
          logError('SubscribeURL ignorada')
        }
      } else if (message.Type === 'Notification' && attempt) {
        await refresh(attempt.id)
      }
    } catch (err) {
      logError(`webhook no procesado (${err.code || 'ERROR'})`)
    }
    return { ok: true }
  }

  return {
    getSigningMode,
    sendToFirme,
    refresh,
    refreshForDraft,
    listInSignature,
    getInSignature,
    handleWebhook,
    resendLink,
    resendLinkForDraft,
    sweepPending
  }
}

module.exports = { createFirmeSigningService, MATERNAL_PLACEHOLDER }
