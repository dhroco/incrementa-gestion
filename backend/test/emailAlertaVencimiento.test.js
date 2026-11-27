const test = require('node:test')
const assert = require('node:assert/strict')

function stubModule(name, exports) {
  const path = require.resolve(name)
  const previous = require.cache[path]
  require.cache[path] = { id: path, filename: path, loaded: true, exports }
  return () => {
    if (previous) require.cache[path] = previous
    else delete require.cache[path]
  }
}

function load() {
  const calls = { messages: [] }
  const r1 = stubModule('@azure/communication-email', {
    EmailClient: class {
      async beginSend(message) {
        calls.messages.push(message)
        return { pollUntilDone: async () => ({ status: 'Succeeded' }) }
      }
    }
  })
  const r2 = stubModule('@azure/identity', { DefaultAzureCredential: class {} })
  delete require.cache[require.resolve('../services/emailService')]
  const api = require('../services/emailService')
  return { api, calls, restore() { r1(); r2(); delete require.cache[require.resolve('../services/emailService')] } }
}

const ITEMS = [
  { signeeName: 'Laura Iturrieta', templateName: 'Canje más Pago', productName: 'Kayser', expiresAtText: '29 de noviembre de 2026, 15:38' },
  { signeeName: 'Ana <b>X</b>', templateName: 'Servicios', productName: '', expiresAtText: '30 de noviembre de 2026' }
]

test('el aviso de vencimiento va a todos los destinatarios, sin adjuntos y con los contratos listados', async () => {
  process.env.ACS_EMAIL_ENDPOINT = 'https://acs-test.brazil.communication.azure.com'
  process.env.ACS_EMAIL_FROM = 'DoNotReply@abc.azurecomm.net'
  const { api, calls, restore } = load()
  try {
    const out = await api.sendExpiryAlertEmail({ to: 'yerko@x.cl, marcela@x.cl, david@x.cl', hours: 48, items: ITEMS })
    assert.deepEqual(out, { ok: true })
    const [m] = calls.messages
    assert.deepEqual(m.recipients.to.map((r) => r.address), ['yerko@x.cl', 'marcela@x.cl', 'david@x.cl'])
    assert.equal(m.content.subject, 'Firma por vencer en 48 horas — 2 contratos pendientes')
    assert.equal(m.attachments, undefined)
    assert.match(m.content.html, /Laura Iturrieta/)
    assert.match(m.content.html, /Kayser/)
    assert.match(m.content.html, /Reenviar enlace/)
    assert.doesNotMatch(m.content.html, /<b>X<\/b>/)
  } finally {
    restore()
    delete process.env.ACS_EMAIL_ENDPOINT
    delete process.env.ACS_EMAIL_FROM
  }
})

test('singular en el asunto con un solo contrato; sin destinatarios o sin ACS se omite', async () => {
  process.env.ACS_EMAIL_ENDPOINT = 'https://acs-test.brazil.communication.azure.com'
  process.env.ACS_EMAIL_FROM = 'DoNotReply@abc.azurecomm.net'
  const { api, calls, restore } = load()
  try {
    await api.sendExpiryAlertEmail({ to: 'a@x.cl', hours: 24, items: [ITEMS[0]] })
    assert.equal(calls.messages[0].content.subject, 'Firma por vencer en 24 horas — 1 contrato pendiente')
    assert.deepEqual(await api.sendExpiryAlertEmail({ to: '', hours: 24, items: ITEMS }), { ok: true, skipped: true })
    delete process.env.ACS_EMAIL_FROM
    assert.deepEqual(await api.sendExpiryAlertEmail({ to: 'a@x.cl', hours: 24, items: ITEMS }), { ok: true, skipped: true })
    assert.equal(calls.messages.length, 1)
  } finally {
    restore()
    delete process.env.ACS_EMAIL_ENDPOINT
    delete process.env.ACS_EMAIL_FROM
  }
})
