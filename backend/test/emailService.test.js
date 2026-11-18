const test = require('node:test')
const assert = require('node:assert/strict')

const emailMod = require.resolve('../services/emailService')
const KEYS = ['ACS_EMAIL_ENDPOINT', 'ACS_EMAIL_FROM']

function loadEmailService(envPatch = {}) {
  const prev = {}
  for (const key of KEYS) {
    prev[key] = process.env[key]
    if (envPatch[key] === null || envPatch[key] === '') delete process.env[key]
    else if (envPatch[key] !== undefined) process.env[key] = envPatch[key]
  }

  delete require.cache[emailMod]
  const api = require('../services/emailService')

  return {
    api,
    restore() {
      delete require.cache[emailMod]
      for (const key of KEYS) {
        if (prev[key] === undefined) delete process.env[key]
        else process.env[key] = prev[key]
      }
    }
  }
}

test('sendSignedContractEmail logs to stderr when ACS is not configured', async () => {
  const logs = []
  const origErr = console.error
  console.error = (...args) => logs.push(args.join(' '))

  const { api, restore } = loadEmailService({ ACS_EMAIL_ENDPOINT: '', ACS_EMAIL_FROM: '' })

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
    assert.ok(logs.join('\n').includes('ACS_EMAIL_ENDPOINT'))
  } finally {
    console.error = origErr
    restore()
  }
})
