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

function loadWithAcs() {
  const calls = { ctor: null, messages: [] }
  const restoreEmail = stubModule('@azure/communication-email', {
    EmailClient: class {
      constructor(endpoint, credential) {
        calls.ctor = { endpoint, hasCredential: Boolean(credential) }
      }
      async beginSend(message) {
        calls.messages.push(message)
        return { pollUntilDone: async () => ({ status: 'Succeeded' }) }
      }
    }
  })
  const restoreIdentity = stubModule('@azure/identity', {
    DefaultAzureCredential: class {}
  })
  delete require.cache[require.resolve('../services/emailService')]
  const api = require('../services/emailService')
  return {
    api,
    calls,
    restore() {
      restoreEmail()
      restoreIdentity()
      delete require.cache[require.resolve('../services/emailService')]
    }
  }
}

test('con ACS configurado envía a todas las direcciones con el PDF adjunto', async () => {
  process.env.ACS_EMAIL_ENDPOINT = 'https://acs-test.brazil.communication.azure.com'
  process.env.ACS_EMAIL_FROM = 'DoNotReply@abc.azurecomm.net'
  const { api, calls, restore } = loadWithAcs()
  try {
    const out = await api.sendSignedContractEmail({
      to: 'yerko@x.cl, marcela@x.cl',
      proveedorNombre: 'Proveedor',
      templateName: 'Plantilla',
      pdfBuffer: Buffer.from('pdf'),
      fileName: 'contrato.pdf'
    })
    assert.deepEqual(out, { ok: true })
    assert.equal(calls.ctor.endpoint, 'https://acs-test.brazil.communication.azure.com')
    assert.equal(calls.ctor.hasCredential, true)
    const [message] = calls.messages
    assert.equal(message.senderAddress, 'DoNotReply@abc.azurecomm.net')
    assert.deepEqual(message.recipients.to, [{ address: 'yerko@x.cl' }, { address: 'marcela@x.cl' }])
    assert.equal(message.content.subject, 'Contrato firmado — Proveedor — Plantilla')
    assert.equal(message.attachments[0].name, 'contrato.pdf')
    assert.equal(message.attachments[0].contentType, 'application/pdf')
    assert.equal(message.attachments[0].contentInBase64, Buffer.from('pdf').toString('base64'))
  } finally {
    restore()
    delete process.env.ACS_EMAIL_ENDPOINT
    delete process.env.ACS_EMAIL_FROM
  }
})

test('con ACS sin remitente o sin destinatarios se omite el envío', async () => {
  process.env.ACS_EMAIL_ENDPOINT = 'https://acs-test.brazil.communication.azure.com'
  delete process.env.ACS_EMAIL_FROM
  const { api, calls, restore } = loadWithAcs()
  try {
    const base = { proveedorNombre: 'P', templateName: 'T', pdfBuffer: Buffer.from('x'), fileName: 'c.pdf' }
    const sinRemitente = await api.sendSignedContractEmail({ ...base, to: 'a@x.cl' })
    assert.equal(sinRemitente.skipped, true)
    process.env.ACS_EMAIL_FROM = 'DoNotReply@abc.azurecomm.net'
    const sinDestino = await api.sendSignedContractEmail({ ...base, to: '' })
    assert.equal(sinDestino.skipped, true)
    assert.equal(calls.messages.length, 0)
  } finally {
    restore()
    delete process.env.ACS_EMAIL_ENDPOINT
    delete process.env.ACS_EMAIL_FROM
  }
})

test('si ACS rechaza el envío, el error sube (el llamador lo registra)', async () => {
  process.env.ACS_EMAIL_ENDPOINT = 'https://acs-test.brazil.communication.azure.com'
  process.env.ACS_EMAIL_FROM = 'DoNotReply@abc.azurecomm.net'
  const restoreEmail = stubModule('@azure/communication-email', {
    EmailClient: class {
      async beginSend() {
        throw Object.assign(new Error('prohibido'), { code: 'Forbidden' })
      }
    }
  })
  const restoreIdentity = stubModule('@azure/identity', { DefaultAzureCredential: class {} })
  delete require.cache[require.resolve('../services/emailService')]
  const { sendSignedContractEmail } = require('../services/emailService')
  try {
    await assert.rejects(
      sendSignedContractEmail({ to: 'a@x.cl', proveedorNombre: 'P', templateName: 'T', pdfBuffer: Buffer.from('x'), fileName: 'c.pdf' }),
      { code: 'Forbidden' }
    )
  } finally {
    restoreEmail()
    restoreIdentity()
    delete require.cache[require.resolve('../services/emailService')]
    delete process.env.ACS_EMAIL_ENDPOINT
    delete process.env.ACS_EMAIL_FROM
  }
})
