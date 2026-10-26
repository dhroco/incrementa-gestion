const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { createFirmeSigningService } = require('../services/firmeSigningService')
const { createMemoryDb } = require('./firmeMemoryDb')

const CERT_URL = 'https://sns.sa-east-1.amazonaws.com/SimpleNotificationService.pem'
const PENDING_CODE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const PAIR = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
})

function stringToSign(message) {
  const fields =
    message.Type === 'Notification'
      ? ['Message', 'MessageId', ...(message.Subject != null ? ['Subject'] : []), 'Timestamp', 'TopicArn', 'Type']
      : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
  return fields.map((key) => `${key}\n${message[key]}\n`).join('')
}

function sign(message, privateKey) {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(stringToSign(message))
  return { ...message, Signature: signer.sign(privateKey, 'base64'), SignatureVersion: '2', SigningCertURL: CERT_URL }
}

function serviceWith(attempts = []) {
  const pair = PAIR
  const fetches = []
  const refreshed = []
  const errors = []
  const db = createMemoryDb({
    firme_signing: attempts,
    firme_webhook_event: [],
    draft_document: []
  })
  const fetchImpl = async (url) => {
    fetches.push(String(url))
    if (String(url).endsWith('.pem')) return { ok: true, text: async () => pair.publicKey }
    return { ok: true, text: async () => '' }
  }
  const firmeClient = {
    async getDocument() {
      refreshed.push('getDocument')
      return { status: 'PENDING_SIGNATURE', signees: [{}] }
    },
    async getQuota() {
      return { simple: 1 }
    }
  }
  const service = createFirmeSigningService({
    db,
    firmeClient,
    storageService: {},
    emailService: {},
    fetchImpl,
    firmeConfigured: true,
    environment: 'dev',
    logger: {
      error(message) {
        errors.push(String(message))
      }
    }
  })
  return { service, db, fetches, refreshed, errors }
}

function notification(message, privateKey, extra = {}) {
  return sign(
    {
      Type: 'Notification',
      MessageId: extra.messageId || 'msg-1',
      TopicArn: 'arn:aws:sns:sa-east-1:1:topic',
      Message: typeof message === 'string' ? message : JSON.stringify(message),
      Timestamp: '2026-10-26T15:00:00.000Z',
      ...extra.fields
    },
    privateKey
  )
}

const attempt = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  draft_document_id: '11111111-1111-4111-8111-111111111111',
  attempt: 1,
  status: 'pending_signature',
  document_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  approved_at: '2026-10-26T12:00:00.000Z',
  firme_document_code: PENDING_CODE,
  signee_first_name: 'Ana',
  signee_last_name: 'Pérez',
  signee_maternal_last_name: '.',
  signee_rut: '12345678-5',
  signee_email: 'ana@ejemplo.cl'
}

test('confirmation fetches only an SNS https URL', async () => {
  const pair = PAIR
  const good = serviceWith()
  const message = sign(
    {
      Type: 'SubscriptionConfirmation',
      MessageId: 'sub-1',
      Token: 'tok',
      TopicArn: 'arn:aws:sns:sa-east-1:1:topic',
      Message: 'confirme',
      SubscribeURL: 'https://sns.sa-east-1.amazonaws.com/?Action=ConfirmSubscription',
      Timestamp: '2026-10-26T15:00:00.000Z'
    },
    pair.privateKey
  )
  const result = await good.service.handleWebhook({ rawBody: JSON.stringify(message), headers: {} })
  assert.deepEqual(result, { ok: true })
  assert.equal(good.fetches.filter((url) => url.includes('ConfirmSubscription')).length, 1)

  const foreign = serviceWith()
  const badHost = sign(
    {
      Type: 'SubscriptionConfirmation',
      MessageId: 'sub-2',
      Token: 'tok',
      TopicArn: 'arn:aws:sns:sa-east-1:1:topic',
      Message: 'confirme',
      SubscribeURL: 'https://evil.example/confirm',
      Timestamp: '2026-10-26T15:00:00.000Z'
    },
    pair.privateKey
  )
  await foreign.service.handleWebhook({ rawBody: JSON.stringify(badHost), headers: {} })
  assert.equal(foreign.fetches.some((url) => url.includes('evil.example')), false)

  const http = serviceWith()
  const badProto = sign(
    {
      Type: 'SubscriptionConfirmation',
      MessageId: 'sub-3',
      Token: 'tok',
      TopicArn: 'arn:aws:sns:sa-east-1:1:topic',
      Message: 'confirme',
      SubscribeURL: 'http://sns.sa-east-1.amazonaws.com/confirm',
      Timestamp: '2026-10-26T15:00:00.000Z'
    },
    pair.privateKey
  )
  await http.service.handleWebhook({ rawBody: JSON.stringify(badProto), headers: {} })
  assert.equal(http.fetches.some((url) => url.startsWith('http://')), false)

  const invalid = serviceWith()
  const tampered = { ...message, Signature: 'aaaa' }
  await invalid.service.handleWebhook({ rawBody: JSON.stringify(tampered), headers: {} })
  assert.equal(invalid.fetches.some((url) => url.includes('ConfirmSubscription')), false)
})

test('an invalid notification does not refresh and still returns ok', async () => {
  const pair = PAIR
  const ctx = serviceWith([{ ...attempt }])
  const message = notification({ data: { document_code: PENDING_CODE } }, pair.privateKey)
  message.Message = '{"data":{"document_code":"otro"}}'
  const result = await ctx.service.handleWebhook({ rawBody: JSON.stringify(message), headers: {} })
  assert.deepEqual(result, { ok: true })
  assert.equal(ctx.refreshed.length, 0)
})

test('the same event id is stored once and refresh may run both times', async () => {
  const pair = PAIR
  const ctx = serviceWith([{ ...attempt }])
  const message = notification({ data: { document_code: PENDING_CODE } }, pair.privateKey, { messageId: 'same-id' })
  const body = JSON.stringify(message)
  await ctx.service.handleWebhook({ rawBody: body, headers: {} })
  await ctx.service.handleWebhook({ rawBody: body, headers: {} })
  const rows = ctx.db.tables.firme_webhook_event.filter((row) => row.event_id === 'same-id')
  assert.equal(rows.length, 1)
  assert.equal(ctx.refreshed.length, 2)
})

test('document code is found in each allowed place and an unknown code does not refresh', async () => {
  const pair = PAIR
  async function deliver(inner) {
    const ctx = serviceWith([{ ...attempt }])
    const message = notification(inner, pair.privateKey, { messageId: crypto.randomUUID() })
    await ctx.service.handleWebhook({ rawBody: JSON.stringify(message), headers: {} })
    return ctx
  }

  const byData = await deliver({ data: { document_code: PENDING_CODE } })
  assert.equal(byData.refreshed.length, 1)

  const byResource = await deliver({ resource_id: PENDING_CODE })
  assert.equal(byResource.refreshed.length, 1)

  const loose = await deliver({ note: `codigo ${PENDING_CODE} suelto` })
  assert.equal(loose.refreshed.length, 1)

  const unknown = await deliver({ data: { document_code: 'desconocido' } })
  assert.equal(unknown.refreshed.length, 0)
  assert.equal(unknown.db.tables.firme_webhook_event.length, 1)
})

test('a non-JSON body is not stored and the handler returns ok', async () => {
  const ctx = serviceWith()
  const rawBody = 'no-es-json'
  const result = await ctx.service.handleWebhook({ rawBody, headers: {} })
  assert.deepEqual(result, { ok: true })
  assert.equal(ctx.db.tables.firme_webhook_event.length, 0)
  assert.equal(ctx.errors.length, 1)
  assert.equal(ctx.errors.some((message) => message.includes(rawBody)), false)
})
