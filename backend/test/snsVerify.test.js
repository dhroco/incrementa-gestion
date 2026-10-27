const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { verifySnsMessage } = require('../lib/snsVerify')

const CERT_URL = 'https://sns.us-east-1.amazonaws.com/SimpleNotificationService.pem'

function keys() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
}

function stringToSign(message) {
  const type = message.Type
  const fields =
    type === 'Notification'
      ? ['Message', 'MessageId', ...(message.Subject != null ? ['Subject'] : []), 'Timestamp', 'TopicArn', 'Type']
      : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
  return fields.map((key) => `${key}\n${message[key]}\n`).join('')
}

function sign(message, privateKey, algorithm) {
  const signer = crypto.createSign(algorithm)
  signer.update(stringToSign(message))
  return { ...message, Signature: signer.sign(privateKey, 'base64') }
}

function certFetch(publicKey) {
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(String(url))
    return { ok: true, text: async () => publicKey }
  }
  return { urls, fetchImpl }
}

test('version 1 and version 2 signatures are valid and the certificate is fetched once', async () => {
  const pair = keys()
  const { urls, fetchImpl } = certFetch(pair.publicKey)
  const notification = sign(
    {
      Type: 'Notification',
      MessageId: 'm-1',
      TopicArn: 'arn:aws:sns:us-east-1:1:topic',
      Subject: 'aviso',
      Message: '{"data":{"document_code":"doc"}}',
      Timestamp: '2026-10-26T15:00:00.000Z',
      SignatureVersion: '1',
      SigningCertURL: CERT_URL
    },
    pair.privateKey,
    'RSA-SHA1'
  )
  const confirmation = sign(
    {
      Type: 'SubscriptionConfirmation',
      MessageId: 'm-2',
      Token: 'token-sns',
      TopicArn: 'arn:aws:sns:us-east-1:1:topic',
      Message: 'confirme',
      SubscribeURL: 'https://sns.us-east-1.amazonaws.com/confirm',
      Timestamp: '2026-10-26T15:00:00.000Z',
      SignatureVersion: '2',
      SigningCertURL: CERT_URL
    },
    pair.privateKey,
    'RSA-SHA256'
  )
  assert.deepEqual(await verifySnsMessage(notification, { fetchImpl }), { ok: true })
  assert.deepEqual(await verifySnsMessage(confirmation, { fetchImpl }), { ok: true })
  assert.deepEqual(urls, [CERT_URL])
})

test('tampered messages and foreign certificates are invalid', async () => {
  const pair = keys()
  const { fetchImpl } = certFetch(pair.publicKey)
  const signed = sign(
    {
      Type: 'Notification',
      MessageId: 'm-3',
      TopicArn: 'arn:aws:sns:us-east-1:1:topic',
      Message: 'original',
      Timestamp: '2026-10-26T15:00:00.000Z',
      SignatureVersion: '2',
      SigningCertURL: CERT_URL
    },
    pair.privateKey,
    'RSA-SHA256'
  )
  const tampered = { ...signed, Message: 'cambiado' }
  assert.equal((await verifySnsMessage(tampered, { fetchImpl })).ok, false)
  assert.equal((await verifySnsMessage({ ...signed, SignatureVersion: '9' }, { fetchImpl })).ok, false)
  for (const url of [
    'http://sns.us-east-1.amazonaws.com/cert.pem',
    'https://evil.example/cert.pem',
    'https://sns.us-east-1.amazonaws.com/cert.txt'
  ]) {
    const result = await verifySnsMessage({ ...signed, SigningCertURL: url }, { fetchImpl })
    assert.equal(result.ok, false)
  }
})
