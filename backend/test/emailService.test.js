const test = require('node:test')
const assert = require('node:assert/strict')

const configPath = require.resolve('../config')
const emailMod = require.resolve('../services/emailService')

function loadEmailService(envPatch = {}) {
  const prev = {}
  for (const key of ['RESEND_API_KEY', 'RESEND_FROM_EMAIL']) {
    prev[key] = process.env[key]
    if (envPatch[key] !== undefined) {
      if (envPatch[key] === null) delete process.env[key]
      else process.env[key] = envPatch[key]
    }
  }

  delete require.cache[configPath]
  delete require.cache[emailMod]
  const config = require('../config')
  for (const key of Object.keys(envPatch)) {
    if (envPatch[key] === '') config[key] = ''
    if (envPatch[key] === null) config[key] = ''
  }

  const api = require('../services/emailService')

  return {
    api,
    restore() {
      delete require.cache[configPath]
      delete require.cache[emailMod]
      for (const key of ['RESEND_API_KEY', 'RESEND_FROM_EMAIL']) {
        if (prev[key] === undefined) delete process.env[key]
        else process.env[key] = prev[key]
      }
    }
  }
}

test('sendSignedContractEmail logs to stderr when RESEND_API_KEY is missing', async () => {
  const logs = []
  const origErr = console.error
  console.error = (...args) => logs.push(args.join(' '))

  const { api, restore } = loadEmailService({ RESEND_API_KEY: '', RESEND_FROM_EMAIL: 'onboarding@resend.dev' })

  try {
    const result = await api.sendSignedContractEmail({
      to: 'empresa@test.cl',
      proveedorNombre: 'Proveedor SpA',
      templateName: 'Plantilla test',
      pdfBuffer: Buffer.from('%PDF'),
      fileName: 'contrato_firmado.pdf'
    })

    assert.equal(result.ok, true)
    assert.equal(result.skipped, true)
    assert.ok(logs.length >= 1)
    assert.ok(logs.join('\n').includes('RESEND_API_KEY'))
  } finally {
    console.error = origErr
    restore()
  }
})
