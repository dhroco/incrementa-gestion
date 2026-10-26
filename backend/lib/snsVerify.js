const crypto = require('crypto')

const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com$/
const certCache = new Map()

function isSnsHttpsUrl(value) {
  let url
  try {
    url = new URL(String(value))
  } catch {
    return false
  }
  return url.protocol === 'https:' && SNS_HOST.test(url.hostname)
}

function isSigningCertUrl(value) {
  let url
  try {
    url = new URL(String(value))
  } catch {
    return false
  }
  return url.protocol === 'https:' && SNS_HOST.test(url.hostname) && url.pathname.endsWith('.pem')
}

function stringToSign(message) {
  const type = message?.Type
  let keys
  if (type === 'Notification') {
    keys = ['Message', 'MessageId']
    if (message.Subject != null) keys.push('Subject')
    keys.push('Timestamp', 'TopicArn', 'Type')
  } else if (type === 'SubscriptionConfirmation' || type === 'UnsubscribeConfirmation') {
    keys = ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
  } else {
    return null
  }
  return keys.map((key) => `${key}\n${message[key] == null ? '' : message[key]}\n`).join('')
}

async function loadCertificate(url, fetchImpl) {
  const cached = certCache.get(url)
  if (cached) return cached
  let res
  try {
    res = await fetchImpl(url, { redirect: 'error' })
  } catch {
    return null
  }
  if (res && res.ok === false) return null
  const pem = typeof res?.text === 'function' ? await res.text() : ''
  if (!pem) return null
  certCache.set(url, pem)
  return pem
}

async function verifySnsMessage(message, { fetchImpl = global.fetch, expectedTopicArn } = {}) {
  if (!message || typeof message !== 'object') return { ok: false, reason: 'message' }
  const version = String(message.SignatureVersion ?? '')
  const algorithm = version === '1' ? 'RSA-SHA1' : version === '2' ? 'RSA-SHA256' : null
  if (!algorithm) return { ok: false, reason: 'version' }
  if (!isSigningCertUrl(message.SigningCertURL)) return { ok: false, reason: 'cert_url' }
  const payload = stringToSign(message)
  if (!payload || !message.Signature) return { ok: false, reason: 'signature' }

  const pem = await loadCertificate(message.SigningCertURL, fetchImpl)
  if (!pem) return { ok: false, reason: 'cert_fetch' }

  try {
    const verifier = crypto.createVerify(algorithm)
    verifier.update(payload, 'utf8')
    if (!verifier.verify(pem, message.Signature, 'base64')) return { ok: false, reason: 'signature' }
    if (expectedTopicArn && message.TopicArn !== expectedTopicArn) return { ok: false, reason: 'topic' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'signature' }
  }
}

module.exports = { verifySnsMessage, isSnsHttpsUrl, isSigningCertUrl }
