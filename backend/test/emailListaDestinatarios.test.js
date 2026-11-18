const test = require('node:test')
const assert = require('node:assert/strict')
const { parseEmailList, isValidEmailList } = require('../utils/emailList')

test('parseEmailList separa por coma, punto y coma y espacios, sin repetidas', () => {
  assert.deepEqual(parseEmailList('a@x.cl, b@x.cl;c@x.cl  A@X.cl'), ['a@x.cl', 'b@x.cl', 'c@x.cl'])
  assert.deepEqual(parseEmailList('solo@x.cl'), ['solo@x.cl'])
  assert.deepEqual(parseEmailList('  ,; '), [])
  assert.deepEqual(parseEmailList(null), [])
})

test('isValidEmailList exige todas válidas', () => {
  assert.equal(isValidEmailList('a@x.cl'), true)
  assert.equal(isValidEmailList('a@x.cl, b@y.com'), true)
  assert.equal(isValidEmailList('a@x.cl, malo'), false)
  assert.equal(isValidEmailList('bad'), false)
  assert.equal(isValidEmailList(''), false)
})

test('sendSignedContractEmail envía a todas las direcciones de la lista', async () => {
  process.env.RESEND_API_KEY = 're_test'
  const resendPath = require.resolve('resend')
  const sent = []
  require.cache[resendPath] = {
    id: resendPath,
    filename: resendPath,
    loaded: true,
    exports: { Resend: class { constructor() { this.emails = { send: async (m) => { sent.push(m) } } } } }
  }
  delete require.cache[require.resolve('../services/emailService')]
  const { sendSignedContractEmail } = require('../services/emailService')
  const out = await sendSignedContractEmail({
    to: 'yerko@x.cl, marcela@x.cl',
    proveedorNombre: 'P',
    templateName: 'T',
    pdfBuffer: Buffer.from('pdf'),
    fileName: 'c.pdf'
  })
  assert.equal(out.ok, true)
  assert.deepEqual(sent[0].to, ['yerko@x.cl', 'marcela@x.cl'])
  assert.equal(sent[0].attachments[0].filename, 'c.pdf')
  const none = await sendSignedContractEmail({ to: '', proveedorNombre: 'P', templateName: 'T', pdfBuffer: Buffer.from('x'), fileName: 'c.pdf' })
  assert.equal(none.skipped, true)
  assert.equal(sent.length, 1)
  delete process.env.RESEND_API_KEY
  delete require.cache[resendPath]
  delete require.cache[require.resolve('../services/emailService')]
})
