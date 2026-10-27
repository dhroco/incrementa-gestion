const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { verifySnsMessage } = require('../lib/snsVerify')
const { createFirmeSigningService } = require('../services/firmeSigningService')
const { createMemoryDb } = require('./firmeMemoryDb')

const CERT_URL = 'https://sns.sa-east-1.amazonaws.com/SimpleNotificationService.pem'
const EXPECTED_TOPIC = 'arn:aws:sns:sa-east-1:1:firme'
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

function sign(message) {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(stringToSign(message))
  return {
    ...message,
    Signature: signer.sign(PAIR.privateKey, 'base64'),
    SignatureVersion: '2',
    SigningCertURL: CERT_URL
  }
}

function serviceWith({ attempts = [], topic = EXPECTED_TOPIC, remote } = {}) {
  const fetches = []
  const db = createMemoryDb({
    firme_signing: attempts,
    firme_webhook_event: [],
    draft_document: attempts[0]
      ? [{ id: attempts[0].draft_document_id, status: 'in_signature' }]
      : []
  })
  const fetchImpl = async (url, init) => {
    fetches.push({ url: String(url), redirect: init && init.redirect })
    if (String(url).endsWith('.pem')) return { ok: true, text: async () => PAIR.publicKey }
    return { ok: true, text: async () => '' }
  }
  const service = createFirmeSigningService({
    db,
    firmeClient: {
      async getDocument() {
        return remote || { status: 'PENDING_SIGNATURE', signees: [{}] }
      },
      async getQuota() {
        return { simple: 1 }
      }
    },
    storageService: {},
    emailService: {},
    fetchImpl,
    snsTopicArn: topic,
    firmeConfigured: true,
    environment: 'dev',
    logger: { error() {} }
  })
  return { service, db, fetches }
}

test('certificate download asks fetch not to follow redirects', async () => {
  const fetches = []
  const fetchImpl = async (url, init) => {
    fetches.push({ url: String(url), redirect: init && init.redirect })
    return { ok: true, text: async () => PAIR.publicKey }
  }
  const message = sign({
    Type: 'Notification',
    MessageId: 'm-topic',
    TopicArn: EXPECTED_TOPIC,
    Message: '{}',
    Timestamp: '2026-10-26T15:00:00.000Z'
  })
  const result = await verifySnsMessage(message, { fetchImpl, expectedTopicArn: EXPECTED_TOPIC })
  assert.deepEqual(result, { ok: true })
  assert.equal(fetches[0].redirect, 'error')
})

test('a notification from another topic is rejected', async () => {
  const message = sign({
    Type: 'Notification',
    MessageId: 'm-other',
    TopicArn: 'arn:aws:sns:sa-east-1:999:ajeno',
    Message: JSON.stringify({ data: { document_code: PENDING_CODE } }),
    Timestamp: '2026-10-26T15:00:00.000Z'
  })
  const ctx = serviceWith({
    attempts: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        draft_document_id: '11111111-1111-4111-8111-111111111111',
        attempt: 1,
        status: 'pending_signature',
        document_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        approved_at: '2026-10-26T12:00:00.000Z',
        firme_document_code: PENDING_CODE
      }
    ]
  })
  const result = await ctx.service.handleWebhook({ rawBody: JSON.stringify(message), headers: {} })
  assert.deepEqual(result, { ok: true })
  assert.equal(ctx.db.tables.firme_signing[0].status, 'pending_signature')
  assert.equal(ctx.db.tables.firme_webhook_event.length, 0)
})

test('confirmation fetches the subscribe URL without following redirects', async () => {
  const ctx = serviceWith()
  const message = sign({
    Type: 'SubscriptionConfirmation',
    MessageId: 'sub-topic',
    Token: 'tok',
    TopicArn: EXPECTED_TOPIC,
    Message: 'confirme',
    SubscribeURL: 'https://sns.sa-east-1.amazonaws.com/?Action=ConfirmSubscription',
    Timestamp: '2026-10-26T15:00:00.000Z'
  })
  await ctx.service.handleWebhook({ rawBody: JSON.stringify(message), headers: {} })
  const confirm = ctx.fetches.find((item) => item.url.includes('ConfirmSubscription'))
  assert.ok(confirm)
  assert.equal(confirm.redirect, 'error')
  assert.equal(ctx.fetches.every((item) => item.redirect === 'error'), true)
})

test('the webhook does not store a rejection reason that Firme did not report', async () => {
  const ctx = serviceWith({
    remote: { status: 'REJECTED', signees: [{}] },
    attempts: [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        draft_document_id: '11111111-1111-4111-8111-111111111111',
        attempt: 1,
        status: 'pending_signature',
        document_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        approved_at: '2026-10-26T12:00:00.000Z',
        firme_document_code: PENDING_CODE
      }
    ]
  })
  const message = sign({
    Type: 'Notification',
    MessageId: 'm-reason',
    TopicArn: EXPECTED_TOPIC,
    Message: JSON.stringify({
      data: { document_code: PENDING_CODE, rejectionReason: 'motivo inyectado' }
    }),
    Timestamp: '2026-10-26T15:00:00.000Z'
  })
  await ctx.service.handleWebhook({ rawBody: JSON.stringify(message), headers: {} })
  assert.equal(ctx.db.tables.firme_signing[0].status, 'rejected')
  assert.equal(ctx.db.tables.firme_signing[0].rejection_reason ?? null, null)
})
