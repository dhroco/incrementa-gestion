const config = require('../config')

/**
 * Cliente HTTP de la API de Firme (firma electrónica simple).
 * La fábrica no llama a la red: la falta de config se detecta al invocar un método.
 */

class FirmeClientError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, status?: number, step?: string, progress?: object }} [opts]
   */
  constructor(message, opts = {}) {
    super(message)
    this.name = 'FirmeClientError'
    this.code = opts.code
    this.status = opts.status
    this.step = opts.step
    this.progress = opts.progress
  }
}

function isFirmeConfigured() {
  return Boolean(config.FIRME_API_URL && config.FIRME_API_TOKEN && config.FIRME_LEGAL_ENTITY_ID)
}

function isBlank(value) {
  return value == null || value === ''
}

function asObject(data) {
  if (data && typeof data === 'object' && !Array.isArray(data)) return data
  return {}
}

function copyProgress(progress) {
  const source = progress || { signees: [] }
  const copy = {
    signees: (source.signees || []).map((signee) => ({
      email: signee.email,
      privateCode: signee.privateCode
    }))
  }
  if (source.transactionId !== undefined) copy.transactionId = source.transactionId
  if (source.documentCode !== undefined) copy.documentCode = source.documentCode
  return copy
}

function clipDetail(detail, secret) {
  if (detail == null || detail === '') return ''
  let text
  if (typeof detail === 'string') {
    text = detail
  } else {
    try {
      text = JSON.stringify(detail)
    } catch {
      return ''
    }
  }
  if (!text) return ''
  if (secret) text = text.split(secret).join('')
  return text.slice(0, 200)
}

function invalidInput(message) {
  return new FirmeClientError(message, { code: 'FIRME_INVALID_INPUT' })
}

function isUnitInterval(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

function validateSendInput(input) {
  const source = input && typeof input === 'object' ? input : {}
  if (!Buffer.isBuffer(source.pdf)) {
    throw invalidInput('El campo pdf debe ser un Buffer.')
  }
  if (!Array.isArray(source.signees) || source.signees.length === 0) {
    throw invalidInput('El campo signees debe incluir al menos un firmante.')
  }

  const fields = ['firstName', 'lastName', 'maternalLastName', 'documentNumber', 'email', 'signature']
  source.signees.forEach((signee, index) => {
    const position = index + 1
    const current = signee && typeof signee === 'object' ? signee : {}
    for (const field of fields) {
      if (isBlank(current[field])) {
        throw invalidInput(`Al firmante ${position} le falta el campo ${field}.`)
      }
    }
    const signature = current.signature
    for (const field of ['page', 'x', 'y']) {
      if (isBlank(signature[field])) {
        throw invalidInput(`Al firmante ${position} le falta el campo ${field}.`)
      }
    }
    if (!Number.isInteger(signature.page) || signature.page < 0) {
      throw invalidInput(
        `El campo page del firmante ${position} debe ser un entero mayor o igual a 0.`
      )
    }
    for (const field of ['x', 'y']) {
      if (!isUnitInterval(signature[field])) {
        throw invalidInput(`El campo ${field} del firmante ${position} debe estar entre 0 y 1.`)
      }
    }
  })
}

function createFirmeClient({ apiUrl, token, legalEntityId, fetchImpl } = {}) {
  const resolvedUrl = apiUrl === undefined ? config.FIRME_API_URL : apiUrl
  const resolvedToken = token === undefined ? config.FIRME_API_TOKEN : token
  const resolvedEntity = legalEntityId === undefined ? config.FIRME_LEGAL_ENTITY_ID : legalEntityId
  const doFetch = fetchImpl === undefined ? global.fetch : fetchImpl

  function ensureConfigured() {
    if (!resolvedUrl || !resolvedToken || !resolvedEntity) {
      throw new FirmeClientError(
        'Firme no está configurado (revise FIRME_API_URL, FIRME_API_TOKEN y FIRME_LEGAL_ENTITY_ID).',
        { code: 'FIRME_NOT_CONFIGURED' }
      )
    }
  }

  function apiUrlFor(path) {
    return `${String(resolvedUrl).replace(/\/+$/, '')}${path}`
  }

  function networkError(step, progress) {
    return new FirmeClientError('No se pudo conectar con Firme.', {
      code: 'FIRME_NETWORK_ERROR',
      step,
      progress: copyProgress(progress)
    })
  }

  function apiError(step, status, progress, detail) {
    let message = `Error al comunicarse con Firme (paso ${step}, HTTP ${status}).`
    const extra = clipDetail(detail, resolvedToken)
    if (extra) message += ` (${extra})`
    return new FirmeClientError(message, {
      code: 'FIRME_API_ERROR',
      status,
      step,
      progress: copyProgress(progress)
    })
  }

  function mapHttpError({ step, status, detail, sentAuth, progress }) {
    if (sentAuth && (status === 401 || status === 403)) {
      return new FirmeClientError(
        'Firme rechazó la autenticación (revise FIRME_API_TOKEN).',
        { code: 'FIRME_AUTH_FAILED', status, step, progress: copyProgress(progress) }
      )
    }
    if (step === 'complete' && status === 422) {
      return new FirmeClientError(
        'No quedan créditos de firma en Firme para completar el envío.',
        { code: 'FIRME_NO_CREDITS', status, step, progress: copyProgress(progress) }
      )
    }
    return apiError(step, status, progress, detail)
  }

  function responseStatus(res) {
    return typeof res?.status === 'number' ? res.status : undefined
  }

  function responseOk(res) {
    if (typeof res?.status === 'number') return res.status >= 200 && res.status < 300
    return Boolean(res?.ok)
  }

  function parseDetail(text) {
    if (!text) return undefined
    try {
      const parsed = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'detail' in parsed) {
        return parsed.detail
      }
    } catch {
      return undefined
    }
    return undefined
  }

  function parseSuccessJson(text, step, status, progress) {
    if (!text || !String(text).trim()) return {}
    try {
      return JSON.parse(text)
    } catch {
      throw apiError(step, status, progress)
    }
  }

  async function callFetch(step, url, init, progress) {
    try {
      return await doFetch(url, init)
    } catch {
      throw networkError(step, progress)
    }
  }

  async function readText(res) {
    if (typeof res?.text !== 'function') return ''
    return res.text()
  }

  const USER_AGENT = 'Incrementa-Contratos/1.0'

  async function apiRequest(step, method, path, progress, body) {
    const headers = {
      Authorization: `Bearer ${resolvedToken}`,
      'User-Agent': USER_AGENT
    }
    const init = { method, headers }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const res = await callFetch(step, apiUrlFor(path), init, progress)
    const status = responseStatus(res)
    const text = await readText(res)
    if (!responseOk(res)) {
      throw mapHttpError({
        step,
        status,
        detail: parseDetail(text),
        sentAuth: true,
        progress
      })
    }
    return { status, data: asObject(parseSuccessJson(text, step, status, progress)) }
  }

  async function apiRequestValue(step, method, path, body) {
    const headers = {
      Authorization: `Bearer ${resolvedToken}`,
      'User-Agent': USER_AGENT
    }
    const init = { method, headers }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const progress = { signees: [] }
    const res = await callFetch(step, apiUrlFor(path), init, progress)
    const status = responseStatus(res)
    const text = await readText(res)
    if (!responseOk(res)) {
      throw mapHttpError({
        step,
        status,
        detail: parseDetail(text),
        sentAuth: true,
        progress
      })
    }
    if (!text || !String(text).trim()) return null
    try {
      return JSON.parse(text)
    } catch {
      throw apiError(step, status, progress)
    }
  }

  async function absoluteRequest(step, url, progress, { method, headers, body, binary }) {
    const init = { method, headers: headers || {} }
    if (body !== undefined) init.body = body
    const res = await callFetch(step, url, init, progress)
    const status = responseStatus(res)
    if (!responseOk(res)) {
      const text = await readText(res)
      throw mapHttpError({
        step,
        status,
        detail: parseDetail(text),
        sentAuth: false,
        progress
      })
    }
    if (!binary) return null
    const raw = await res.arrayBuffer()
    return Buffer.from(raw)
  }

  function requireField(data, field, step, status, progress) {
    const value = data == null ? undefined : data[field]
    if (isBlank(value)) throw apiError(step, status, progress)
    return value
  }

  async function notifyProgress(onProgress, progress) {
    if (typeof onProgress !== 'function') return
    try {
      await onProgress(copyProgress(progress))
    } catch {
      // Un error del aviso no corta el envío.
    }
  }

  async function sendForSignature(input, options) {
    ensureConfigured()
    validateSendInput(input)
    const onProgress = options && typeof options.onProgress === 'function' ? options.onProgress : null
    const progress = { signees: [] }
    const { pdf, name, signees } = input

    const transaction = await apiRequest('transactions', 'POST', '/transactions', progress, {
      legalEntityId: resolvedEntity
    })
    progress.transactionId = requireField(transaction.data, 'id', 'transactions', transaction.status, progress)
    await notifyProgress(onProgress, progress)

    const document = await apiRequest('documents', 'POST', '/documents', progress, {
      name,
      transactionId: progress.transactionId
    })
    progress.documentCode = requireField(document.data, 'code', 'documents', document.status, progress)
    await notifyProgress(onProgress, progress)
    const uploadUrl = requireField(document.data, 'uploadUrl', 'documents', document.status, progress)

    await absoluteRequest('upload-pdf', uploadUrl, progress, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: pdf
    })

    const documentCode = progress.documentCode
    await apiRequest('confirm-upload', 'PUT', `/documents/${documentCode}/upload`, progress)
    await apiRequest('metadata', 'PUT', `/documents/${documentCode}`, progress, {
      category: 'CONTRATOS',
      subcategory: 'Contrato de Prestación de Servicios',
      procedureType: 'SIMPLE'
    })

    for (const signee of signees) {
      const created = await apiRequest(
        'signees',
        'POST',
        `/documents/${documentCode}/signees`,
        progress,
        {
          firstName: signee.firstName,
          lastName: signee.lastName,
          maternalLastName: signee.maternalLastName,
          documentNumber: signee.documentNumber,
          email: signee.email
        }
      )
      const privateCode = requireField(created.data, 'privateCode', 'signees', created.status, progress)
      progress.signees.push({ email: signee.email, privateCode })
      await apiRequest('signatures', 'POST', `/documents/${documentCode}/signatures`, progress, {
        privateCode,
        page: signee.signature.page,
        x: signee.signature.x,
        y: signee.signature.y
      })
      await notifyProgress(onProgress, progress)
    }

    await notifyProgress(onProgress, progress)
    await apiRequest(
      'complete',
      'POST',
      `/transactions/${progress.transactionId}/complete`,
      progress,
      { paymentMethod: 'CREDITS' }
    )

    return {
      transactionId: progress.transactionId,
      documentCode: progress.documentCode,
      signees: progress.signees.map((signee) => ({
        email: signee.email,
        privateCode: signee.privateCode
      }))
    }
  }

  async function getDocument(documentCode) {
    ensureConfigured()
    const progress = { signees: [] }
    const res = await apiRequest('document', 'GET', `/documents/${documentCode}`, progress)
    const data = res.data
    const signees = Array.isArray(data.signees)
      ? data.signees.map((signee) => {
          const mapped = {
            email: signee?.email,
            signedOn: signee?.signedOn == null ? null : signee.signedOn
          }
          if (signee?.approvedUntil != null) mapped.approvedUntil = signee.approvedUntil
          if (signee?.rejectionDetail != null) mapped.rejectionDetail = signee.rejectionDetail
          return mapped
        })
      : []
    return {
      status: data.status,
      signedOn: data.signedOn == null ? null : data.signedOn,
      signees
    }
  }

  async function downloadSignedPdf(documentCode) {
    ensureConfigured()
    const progress = { signees: [] }
    const res = await apiRequest(
      'signed-file-url',
      'GET',
      `/documents/${documentCode}/files/SIGNED_DOCUMENT`,
      progress
    )
    const downloadUrl = requireField(res.data, 'download_url', 'signed-file-url', res.status, progress)
    return absoluteRequest('download-signed-pdf', downloadUrl, progress, {
      method: 'GET',
      binary: true
    })
  }

  async function collectEvidence(documentCode, privateCodes) {
    ensureConfigured()
    const progress = { signees: [] }
    const logsRes = await apiRequest('logs', 'GET', `/documents/${documentCode}/logs`, progress)
    const logs = Array.isArray(logsRes.data.items) ? logsRes.data.items : []
    const signees = []

    for (const privateCode of privateCodes) {
      const eventsRes = await apiRequest(
        'email-events',
        'GET',
        `/documents/${documentCode}/signees/${privateCode}/emails/events`,
        progress
      )
      const events = Array.isArray(eventsRes.data.items) ? eventsRes.data.items : []
      const certificates = []
      const seen = new Set()
      for (const event of events) {
        const emailId = event?.hub_email_id
        if (isBlank(emailId) || seen.has(emailId)) continue
        seen.add(emailId)
        const certRes = await apiRequest(
          'email-certificate',
          'GET',
          `/documents/${documentCode}/signees/${privateCode}/emails/${emailId}/certificate`,
          progress
        )
        const downloadUrl = requireField(
          certRes.data,
          'download_url',
          'email-certificate',
          certRes.status,
          progress
        )
        const pdf = await absoluteRequest('download-certificate', downloadUrl, progress, {
          method: 'GET',
          binary: true
        })
        certificates.push({ emailId, pdf })
      }
      signees.push({ privateCode, events, certificates })
    }

    return { logs, signees }
  }

  async function getQuota() {
    ensureConfigured()
    const res = await apiRequest('quota', 'GET', `/legal-entities/${resolvedEntity}/quota`, { signees: [] })
    const simple = Number(res.data.simple)
    return { simple: Number.isFinite(simple) ? simple : 0 }
  }

  async function deleteDocument(documentCode) {
    ensureConfigured()
    await apiRequest('delete-document', 'DELETE', `/documents/${documentCode}`, { signees: [] })
    return { deleted: true }
  }

  async function resendInvitation(documentCode, privateCode) {
    ensureConfigured()
    await apiRequest(
      'resend-invitation',
      'POST',
      `/documents/${documentCode}/signees/${privateCode}/resend`,
      { signees: [] }
    )
    return { resent: true }
  }

  async function createWebhook({ url, eventTypes }) {
    ensureConfigured()
    const res = await apiRequest('create-webhook', 'POST', '/webhooks/subscriptions', { signees: [] }, {
      legalEntityId: resolvedEntity,
      url,
      eventTypes
    })
    return res.data
  }

  function asList(value) {
    if (Array.isArray(value)) return value
    if (value && Array.isArray(value.items)) return value.items
    return []
  }

  async function listWebhooks() {
    ensureConfigured()
    const value = await apiRequestValue(
      'list-webhooks',
      'GET',
      `/webhooks/subscriptions?legalEntityId=${encodeURIComponent(resolvedEntity)}`
    )
    return asList(value)
  }

  async function deleteWebhook(id) {
    ensureConfigured()
    await apiRequest('delete-webhook', 'DELETE', `/webhooks/subscriptions/${id}`, { signees: [] })
    return { deleted: true }
  }

  async function getWebhook(id) {
    ensureConfigured()
    const res = await apiRequest('webhook-status', 'GET', `/webhooks/subscriptions/${id}/status`, { signees: [] })
    return res.data
  }

  return {
    sendForSignature,
    getDocument,
    downloadSignedPdf,
    collectEvidence,
    getQuota,
    deleteDocument,
    resendInvitation,
    createWebhook,
    listWebhooks,
    deleteWebhook,
    getWebhook
  }
}

module.exports = {
  createFirmeClient,
  isFirmeConfigured,
  FirmeClientError
}
