const test = require('node:test')
const assert = require('node:assert/strict')

const { createFirmeClient } = require('../lib/firmeClient')

const firmeMod = require.resolve('../lib/firmeClient')
const configMod = require.resolve('../config')

const API = 'https://api.firme.test'
const TOKEN = 'firme-token-test'
const ENTITY = 'entity-test-1'
const TX_ID = 'tx-9f3'
const DOC_CODE = 'doc-7c1'
const UPLOAD_URL = 'https://files.example/presigned-upload?sig=abc'
const SIGNED_URL = 'https://files.example/signed.pdf?sig=xyz'

const CFG_URL = 'https://config-firme.example'
const CFG_TOKEN = 'config-token-value'
const CFG_ENTITY = 'config-entity-value'

const NOT_CONFIGURED = 'Firme no está configurado (revise FIRME_API_URL, FIRME_API_TOKEN y FIRME_LEGAL_ENTITY_ID).'

const pdf = Buffer.from('%PDF-1.4 test')

function jsonRes(status, payload) {
  const body = payload === undefined ? '' : JSON.stringify(payload)
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => body
  }
}

function binRes(buf) {
  const bytes = Uint8Array.from(buf)
  return {
    status: 200,
    ok: true,
    arrayBuffer: async () => bytes.buffer
  }
}

function createFetch(handler) {
  const calls = []
  const fetchImpl = async (url, init = {}) => {
    const call = {
      url: String(url),
      method: init.method,
      headers: init.headers || {},
      body: init.body
    }
    calls.push(call)
    return handler(call)
  }
  return { calls, fetchImpl }
}

function createSendMock(options = {}) {
  let signeeCount = 0
  return (call) => {
    if (options.failNetwork) throw new Error('ECONNREFUSED')
    const path = new URL(call.url).pathname
    const method = call.method
    if (call.url === UPLOAD_URL) {
      if (options.uploadStatus) {
        return jsonRes(options.uploadStatus, { detail: options.uploadDetail || 'denied' })
      }
      return jsonRes(200, {})
    }
    if (method === 'POST' && path === '/transactions') {
      if (options.transactionStatus) {
        return jsonRes(options.transactionStatus, {
          detail: options.transactionDetail === undefined ? 'auth' : options.transactionDetail
        })
      }
      return jsonRes(201, { id: TX_ID })
    }
    if (method === 'POST' && path === '/documents') {
      if (options.documentStatus) {
        return jsonRes(options.documentStatus, { detail: options.documentDetail })
      }
      return jsonRes(201, { code: DOC_CODE, uploadUrl: UPLOAD_URL })
    }
    if (method === 'PUT' && path === `/documents/${DOC_CODE}/upload`) return jsonRes(200, {})
    if (method === 'PUT' && path === `/documents/${DOC_CODE}`) return jsonRes(200, {})
    if (method === 'POST' && path === `/documents/${DOC_CODE}/signees`) {
      signeeCount += 1
      if (options.signeeFailOn === signeeCount) {
        return jsonRes(options.signeeFailStatus || 500, { detail: options.signeeFailDetail })
      }
      return jsonRes(201, { privateCode: signeeCount === 1 ? 'signee-a' : 'signee-b' })
    }
    if (method === 'POST' && path === `/documents/${DOC_CODE}/signatures`) return jsonRes(201, {})
    if (method === 'POST' && path === `/transactions/${TX_ID}/complete`) {
      if (options.completeStatus) {
        return jsonRes(options.completeStatus, {
          detail: options.completeDetail === undefined ? 'no credits' : options.completeDetail
        })
      }
      return jsonRes(200, {})
    }
    return jsonRes(599, { detail: `inesperado ${method} ${call.url}` })
  }
}

function clientWith(fetchImpl, overrides = {}) {
  return createFirmeClient({
    apiUrl: API,
    token: TOKEN,
    legalEntityId: ENTITY,
    fetchImpl,
    ...overrides
  })
}

function person(over = {}) {
  return {
    firstName: 'Ana',
    lastName: 'Pérez',
    maternalLastName: 'Soto',
    documentNumber: '12.345.678-5',
    email: 'ana@ejemplo.cl',
    signature: { page: 0, x: 0, y: 1 },
    ...over
  }
}

const luis = {
  firstName: 'Luis',
  lastName: 'Rojas',
  maternalLastName: 'Díaz',
  documentNumber: '9.876.543-2',
  email: 'luis@ejemplo.cl',
  signature: { page: 1, x: 1, y: 0 }
}

function sendInput(signees, extra = {}) {
  return { pdf, name: 'Contrato de servicios', signees, ...extra }
}

function summarize(call) {
  return {
    method: call.method,
    url: call.url,
    authorization: call.headers.Authorization ?? null,
    contentType: call.headers['Content-Type'] ?? null,
    body: typeof call.body === 'string' ? JSON.parse(call.body) : call.body
  }
}

function assertBearerScope(calls, apiBase, token) {
  assert.ok(calls.length > 0)
  for (const call of calls) {
    const onApi = call.url.startsWith(apiBase)
    const headers = call.headers || {}
    if (onApi) assert.equal(headers.Authorization, `Bearer ${token}`)
    else assert.equal(headers.Authorization, undefined)
    for (const [key, value] of Object.entries(headers)) {
      if (key === 'Authorization' && onApi) continue
      assert.equal(String(value).includes(token), false)
    }
    assert.equal(call.url.includes(token), false)
    if (typeof call.body === 'string') assert.equal(call.body.includes(token), false)
  }
}

async function expectError(run, check) {
  await assert.rejects(run, (err) => {
    check(err)
    return true
  })
}

function loadFirmeClient() {
  delete require.cache[firmeMod]
  delete require.cache[configMod]
  return require('../lib/firmeClient')
}

function assignEnv(name, value) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

async function withFirmeEnv(values, fn) {
  const prev = {
    FIRME_API_URL: process.env.FIRME_API_URL,
    FIRME_API_TOKEN: process.env.FIRME_API_TOKEN,
    FIRME_LEGAL_ENTITY_ID: process.env.FIRME_LEGAL_ENTITY_ID
  }
  assignEnv('FIRME_API_URL', values.url)
  assignEnv('FIRME_API_TOKEN', values.token)
  assignEnv('FIRME_LEGAL_ENTITY_ID', values.entity)
  try {
    return await fn(loadFirmeClient())
  } finally {
    assignEnv('FIRME_API_URL', prev.FIRME_API_URL)
    assignEnv('FIRME_API_TOKEN', prev.FIRME_API_TOKEN)
    assignEnv('FIRME_LEGAL_ENTITY_ID', prev.FIRME_LEGAL_ENTITY_ID)
    delete require.cache[firmeMod]
    delete require.cache[configMod]
  }
}

test('send with two signees keeps input order, bodies and private codes', async () => {
  const { calls, fetchImpl } = createFetch(createSendMock())
  const client = clientWith(fetchImpl)
  const result = await client.sendForSignature(sendInput([person(), luis]))

  assert.deepEqual(calls.map(summarize), [
    {
      method: 'POST',
      url: `${API}/transactions`,
      authorization: `Bearer ${TOKEN}`,
      contentType: 'application/json',
      body: { legalEntityId: ENTITY }
    },
    {
      method: 'POST',
      url: `${API}/documents`,
      authorization: `Bearer ${TOKEN}`,
      contentType: 'application/json',
      body: { name: 'Contrato de servicios', transactionId: TX_ID }
    },
    {
      method: 'PUT',
      url: UPLOAD_URL,
      authorization: null,
      contentType: 'application/pdf',
      body: pdf
    },
    {
      method: 'PUT',
      url: `${API}/documents/${DOC_CODE}/upload`,
      authorization: `Bearer ${TOKEN}`,
      contentType: null,
      body: undefined
    },
    {
      method: 'PUT',
      url: `${API}/documents/${DOC_CODE}`,
      authorization: `Bearer ${TOKEN}`,
      contentType: 'application/json',
      body: {
        category: 'CONTRATOS',
        subcategory: 'Contrato de Prestación de Servicios',
        procedureType: 'SIMPLE'
      }
    },
    {
      method: 'POST',
      url: `${API}/documents/${DOC_CODE}/signees`,
      authorization: `Bearer ${TOKEN}`,
      contentType: 'application/json',
      body: {
        firstName: 'Ana',
        lastName: 'Pérez',
        maternalLastName: 'Soto',
        documentNumber: '12.345.678-5',
        email: 'ana@ejemplo.cl'
      }
    },
    {
      method: 'POST',
      url: `${API}/documents/${DOC_CODE}/signatures`,
      authorization: `Bearer ${TOKEN}`,
      contentType: 'application/json',
      body: { privateCode: 'signee-a', page: 0, x: 0, y: 1 }
    },
    {
      method: 'POST',
      url: `${API}/documents/${DOC_CODE}/signees`,
      authorization: `Bearer ${TOKEN}`,
      contentType: 'application/json',
      body: {
        firstName: 'Luis',
        lastName: 'Rojas',
        maternalLastName: 'Díaz',
        documentNumber: '9.876.543-2',
        email: 'luis@ejemplo.cl'
      }
    },
    {
      method: 'POST',
      url: `${API}/documents/${DOC_CODE}/signatures`,
      authorization: `Bearer ${TOKEN}`,
      contentType: 'application/json',
      body: { privateCode: 'signee-b', page: 1, x: 1, y: 0 }
    },
    {
      method: 'POST',
      url: `${API}/transactions/${TX_ID}/complete`,
      authorization: `Bearer ${TOKEN}`,
      contentType: 'application/json',
      body: { paymentMethod: 'CREDITS' }
    }
  ])
  assert.equal(calls[2].body, pdf)
  assertBearerScope(calls, API, TOKEN)
  assert.deepEqual(result, {
    transactionId: TX_ID,
    documentCode: DOC_CODE,
    signees: [
      { email: 'ana@ejemplo.cl', privateCode: 'signee-a' },
      { email: 'luis@ejemplo.cl', privateCode: 'signee-b' }
    ]
  })
})

test('send with one signee makes a single signee and signature request', async () => {
  const { calls, fetchImpl } = createFetch(createSendMock())
  const client = clientWith(fetchImpl)
  const result = await client.sendForSignature(sendInput([person()]))
  const urls = calls.map((call) => `${call.method} ${call.url}`)
  assert.deepEqual(urls, [
    `POST ${API}/transactions`,
    `POST ${API}/documents`,
    `PUT ${UPLOAD_URL}`,
    `PUT ${API}/documents/${DOC_CODE}/upload`,
    `PUT ${API}/documents/${DOC_CODE}`,
    `POST ${API}/documents/${DOC_CODE}/signees`,
    `POST ${API}/documents/${DOC_CODE}/signatures`,
    `POST ${API}/transactions/${TX_ID}/complete`
  ])
  assert.equal(calls.filter((call) => call.url.endsWith('/signees')).length, 1)
  assert.equal(calls.filter((call) => call.url.endsWith('/signatures')).length, 1)
  assert.deepEqual(result.signees, [{ email: 'ana@ejemplo.cl', privateCode: 'signee-a' }])
})

test('401 on POST /transactions is FIRME_AUTH_FAILED and hides the token', async () => {
  const { calls, fetchImpl } = createFetch(createSendMock({
    transactionStatus: 401,
    transactionDetail: `rechazado ${TOKEN}`
  }))
  const client = clientWith(fetchImpl)
  await expectError(() => client.sendForSignature(sendInput([person()])), (err) => {
    assert.equal(err.name, 'FirmeClientError')
    assert.equal(err.code, 'FIRME_AUTH_FAILED')
    assert.equal(err.status, 401)
    assert.equal(err.step, 'transactions')
    assert.equal(err.message, 'Firme rechazó la autenticación (revise FIRME_API_TOKEN).')
    assert.equal(err.message.includes(TOKEN), false)
    assert.deepEqual(err.progress, { signees: [] })
    assert.equal(JSON.stringify(err.progress).includes(TOKEN), false)
    assert.equal(calls.length, 1)
  })
})

test('403 on an authorized API call is FIRME_AUTH_FAILED', async () => {
  const { fetchImpl } = createFetch(createSendMock({ transactionStatus: 403 }))
  const client = clientWith(fetchImpl)
  await expectError(() => client.sendForSignature(sendInput([person()])), (err) => {
    assert.equal(err.code, 'FIRME_AUTH_FAILED')
    assert.equal(err.status, 403)
    assert.equal(err.step, 'transactions')
  })
})

test('422 on complete is FIRME_NO_CREDITS and keeps both signees', async () => {
  const { fetchImpl } = createFetch(createSendMock({
    completeStatus: 422,
    completeDetail: `sin cupo ${TOKEN}`
  }))
  const client = clientWith(fetchImpl)
  await expectError(() => client.sendForSignature(sendInput([person(), luis])), (err) => {
    assert.equal(err.code, 'FIRME_NO_CREDITS')
    assert.equal(err.step, 'complete')
    assert.equal(err.status, 422)
    assert.equal(err.message, 'No quedan créditos de firma en Firme para completar el envío.')
    assert.equal(err.message.includes(TOKEN), false)
    assert.deepEqual(err.progress, {
      transactionId: TX_ID,
      documentCode: DOC_CODE,
      signees: [
        { email: 'ana@ejemplo.cl', privateCode: 'signee-a' },
        { email: 'luis@ejemplo.cl', privateCode: 'signee-b' }
      ]
    })
    assert.equal(JSON.stringify(err.progress).includes(TOKEN), false)
  })
})

test('500 on the second signee keeps only the first and clips detail', async () => {
  const detail = `${TOKEN}${'d'.repeat(250)}`
  const { calls, fetchImpl } = createFetch(createSendMock({
    signeeFailOn: 2,
    signeeFailStatus: 500,
    signeeFailDetail: detail
  }))
  const client = clientWith(fetchImpl)
  await expectError(() => client.sendForSignature(sendInput([person(), luis])), (err) => {
    assert.equal(err.code, 'FIRME_API_ERROR')
    assert.equal(err.step, 'signees')
    assert.equal(err.status, 500)
    assert.equal(
      err.message,
      `Error al comunicarse con Firme (paso signees, HTTP 500). (${'d'.repeat(200)})`
    )
    assert.equal(err.message.includes(TOKEN), false)
    assert.equal(err.message.includes('d'.repeat(201)), false)
    assert.deepEqual(err.progress, {
      transactionId: TX_ID,
      documentCode: DOC_CODE,
      signees: [{ email: 'ana@ejemplo.cl', privateCode: 'signee-a' }]
    })
    assert.equal(JSON.stringify(err.progress).includes(TOKEN), false)
    assert.equal(calls.filter((call) => call.url.endsWith('/signees')).length, 2)
    assert.equal(calls.filter((call) => call.url.endsWith('/signatures')).length, 1)
    assert.equal(calls.some((call) => call.url.endsWith('/complete')), false)
  })
})

test('non-string detail is stringified before clipping', async () => {
  const { fetchImpl } = createFetch(createSendMock({
    documentStatus: 500,
    documentDetail: { motivo: 'sin cupo' }
  }))
  const client = clientWith(fetchImpl)
  await expectError(() => client.sendForSignature(sendInput([person()])), (err) => {
    assert.equal(err.code, 'FIRME_API_ERROR')
    assert.equal(err.step, 'documents')
    assert.equal(
      err.message,
      'Error al comunicarse con Firme (paso documents, HTTP 500). ({"motivo":"sin cupo"})'
    )
    assert.deepEqual(err.progress, { transactionId: TX_ID, signees: [] })
  })
})

test('403 on the presigned upload is FIRME_API_ERROR at upload-pdf', async () => {
  const { fetchImpl } = createFetch(createSendMock({ uploadStatus: 403 }))
  const client = clientWith(fetchImpl)
  await expectError(() => client.sendForSignature(sendInput([person()])), (err) => {
    assert.equal(err.code, 'FIRME_API_ERROR')
    assert.notEqual(err.code, 'FIRME_AUTH_FAILED')
    assert.equal(err.step, 'upload-pdf')
    assert.equal(err.status, 403)
    assert.equal(err.message.includes('paso upload-pdf'), true)
    assert.equal(err.message.includes('HTTP 403'), true)
    assert.equal(err.message.includes('rechazó la autenticación'), false)
    assert.deepEqual(err.progress, {
      transactionId: TX_ID,
      documentCode: DOC_CODE,
      signees: []
    })
  })
})

test('a thrown fetch is FIRME_NETWORK_ERROR', async () => {
  const { fetchImpl } = createFetch(createSendMock({ failNetwork: true }))
  const client = clientWith(fetchImpl)
  await expectError(() => client.sendForSignature(sendInput([person()])), (err) => {
    assert.equal(err.code, 'FIRME_NETWORK_ERROR')
    assert.equal(err.message, 'No se pudo conectar con Firme.')
    assert.equal(err.status, undefined)
    assert.equal(err.step, 'transactions')
    assert.deepEqual(err.progress, { signees: [] })
    assert.equal(err.message.includes(TOKEN), false)
  })
})

test('a pdf that is not a Buffer does not call Firme', async () => {
  const { calls, fetchImpl } = createFetch(createSendMock())
  const client = clientWith(fetchImpl)
  await expectError(
    () => client.sendForSignature(sendInput([person()], { pdf: 'no-es-buffer' })),
    (err) => {
      assert.equal(err.code, 'FIRME_INVALID_INPUT')
      assert.equal(err.message, 'El campo pdf debe ser un Buffer.')
      assert.equal(calls.length, 0)
    }
  )
})

test('empty signees does not call Firme', async () => {
  const { calls, fetchImpl } = createFetch(createSendMock())
  const client = clientWith(fetchImpl)
  await expectError(() => client.sendForSignature(sendInput([])), (err) => {
    assert.equal(err.code, 'FIRME_INVALID_INPUT')
    assert.equal(err.message, 'El campo signees debe incluir al menos un firmante.')
    assert.equal(calls.length, 0)
  })
})

test('signees that is not an array does not call Firme', async () => {
  const { calls, fetchImpl } = createFetch(createSendMock())
  const client = clientWith(fetchImpl)
  await expectError(() => client.sendForSignature({ pdf, name: 'n', signees: null }), (err) => {
    assert.equal(err.code, 'FIRME_INVALID_INPUT')
    assert.equal(err.message, 'El campo signees debe incluir al menos un firmante.')
    assert.equal(calls.length, 0)
  })
})

for (const field of ['firstName', 'lastName', 'maternalLastName', 'documentNumber', 'email', 'signature']) {
  test(`missing ${field} does not call Firme`, async () => {
    const signee = person()
    delete signee[field]
    const { calls, fetchImpl } = createFetch(createSendMock())
    const client = clientWith(fetchImpl)
    await expectError(() => client.sendForSignature(sendInput([signee])), (err) => {
      assert.equal(err.code, 'FIRME_INVALID_INPUT')
      assert.equal(err.message, `Al firmante 1 le falta el campo ${field}.`)
      assert.equal(calls.length, 0)
    })
  })
}

test('blank documentNumber and email count as missing', async () => {
  const { calls, fetchImpl } = createFetch(createSendMock())
  const client = clientWith(fetchImpl)
  await expectError(
    () => client.sendForSignature(sendInput([person({ documentNumber: null })])),
    (err) => {
      assert.equal(err.message, 'Al firmante 1 le falta el campo documentNumber.')
      assert.equal(calls.length, 0)
    }
  )
  await expectError(
    () => client.sendForSignature(sendInput([person({ email: '' })])),
    (err) => {
      assert.equal(err.message, 'Al firmante 1 le falta el campo email.')
      assert.equal(calls.length, 0)
    }
  )
})

test('a missing field names the signee position', async () => {
  const second = { ...luis }
  delete second.maternalLastName
  const { calls, fetchImpl } = createFetch(createSendMock())
  const client = clientWith(fetchImpl)
  await expectError(() => client.sendForSignature(sendInput([person(), second])), (err) => {
    assert.equal(err.code, 'FIRME_INVALID_INPUT')
    assert.equal(err.message, 'Al firmante 2 le falta el campo maternalLastName.')
    assert.equal(calls.length, 0)
  })
})

for (const field of ['page', 'x', 'y']) {
  test(`missing signature ${field} does not call Firme`, async () => {
    const signature = { page: 0, x: 0.2, y: 0.8 }
    delete signature[field]
    const { calls, fetchImpl } = createFetch(createSendMock())
    const client = clientWith(fetchImpl)
    await expectError(
      () => client.sendForSignature(sendInput([person({ signature })])),
      (err) => {
        assert.equal(err.code, 'FIRME_INVALID_INPUT')
        assert.equal(err.message, `Al firmante 1 le falta el campo ${field}.`)
        assert.equal(calls.length, 0)
      }
    )
  })
}

for (const page of [-1, 1.5, '2']) {
  test(`page ${page} is not a valid stamp page`, async () => {
    const { calls, fetchImpl } = createFetch(createSendMock())
    const client = clientWith(fetchImpl)
    await expectError(
      () => client.sendForSignature(sendInput([person({ signature: { page, x: 0.2, y: 0.3 } })])),
      (err) => {
        assert.equal(err.code, 'FIRME_INVALID_INPUT')
        assert.equal(err.message, 'El campo page del firmante 1 debe ser un entero mayor o igual a 0.')
        assert.equal(calls.length, 0)
      }
    )
  })
}

for (const [field, value] of [['x', -0.01], ['x', 1.01], ['x', Number.NaN], ['y', 2], ['y', Number.POSITIVE_INFINITY], ['x', '0.5']]) {
  test(`${field} ${value} is outside 0 through 1`, async () => {
    const signature = { page: 0, x: 0.2, y: 0.3, [field]: value }
    const { calls, fetchImpl } = createFetch(createSendMock())
    const client = clientWith(fetchImpl)
    await expectError(() => client.sendForSignature(sendInput([person({ signature })])), (err) => {
      assert.equal(err.code, 'FIRME_INVALID_INPUT')
      assert.equal(err.message, `El campo ${field} del firmante 1 debe estar entre 0 y 1.`)
      assert.equal(calls.length, 0)
    })
  })
}

test('send without configuration does not call Firme', async () => {
  await withFirmeEnv({ url: '', token: '', entity: '' }, async ({ createFirmeClient: create }) => {
    const { calls, fetchImpl } = createFetch(createSendMock())
    const client = create({ fetchImpl })
    await expectError(() => client.sendForSignature({ pdf: 'no', signees: [] }), (err) => {
      assert.equal(err.name, 'FirmeClientError')
      assert.equal(err.code, 'FIRME_NOT_CONFIGURED')
      assert.equal(err.message, NOT_CONFIGURED)
      assert.equal(calls.length, 0)
    })
  })
})

test('getDocument maps pending status and null signature dates', async () => {
  const { calls, fetchImpl } = createFetch((call) => {
    assert.equal(call.method, 'GET')
    assert.equal(call.url, `${API}/documents/doc-pend`)
    return jsonRes(200, {
      status: 'PENDING_SIGNATURE',
      id: 'ignored',
      signees: [
        { email: 'ana@ejemplo.cl', rut: '1-9' },
        { email: 'luis@ejemplo.cl', signedOn: null, name: 'Luis' }
      ]
    })
  })
  const client = clientWith(fetchImpl)
  const result = await client.getDocument('doc-pend')
  assert.deepEqual(result, {
    status: 'PENDING_SIGNATURE',
    signedOn: null,
    signees: [
      { email: 'ana@ejemplo.cl', signedOn: null },
      { email: 'luis@ejemplo.cl', signedOn: null }
    ]
  })
  assertBearerScope(calls, API, TOKEN)
})

test('getDocument keeps signed dates and a missing signees array is empty', async () => {
  const signedOn = '2026-09-28T15:00:00.000Z'
  const signeeSignedOn = '2026-09-28T15:04:00.000Z'
  let mode = 'signed'
  const { calls, fetchImpl } = createFetch((call) => {
    if (mode === 'signed') {
      return jsonRes(200, {
        status: 'SIGNED',
        signedOn,
        signees: [{ email: 'ana@ejemplo.cl', signedOn: signeeSignedOn, extra: true }]
      })
    }
    return jsonRes(200, { status: 'PENDING_SIGNATURE' })
  })
  const client = clientWith(fetchImpl)
  assert.deepEqual(await client.getDocument('doc-firmado'), {
    status: 'SIGNED',
    signedOn,
    signees: [{ email: 'ana@ejemplo.cl', signedOn: signeeSignedOn }]
  })
  mode = 'empty'
  assert.deepEqual(await client.getDocument('doc-vacio'), {
    status: 'PENDING_SIGNATURE',
    signedOn: null,
    signees: []
  })
  assert.equal(calls[0].headers.Authorization, `Bearer ${TOKEN}`)
  assert.equal(calls[0].url, `${API}/documents/doc-firmado`)
  assert.equal(calls[1].url, `${API}/documents/doc-vacio`)
})

test('downloadSignedPdf returns the presigned bytes without Authorization', async () => {
  const signed = Buffer.from('%PDF-signed')
  const { calls, fetchImpl } = createFetch((call) => {
    if (call.url === `${API}/documents/doc-firmado/files/SIGNED_DOCUMENT`) {
      return jsonRes(200, { download_url: SIGNED_URL })
    }
    if (call.url === SIGNED_URL) return binRes(signed)
    return jsonRes(599, { detail: `inesperado ${call.url}` })
  })
  const client = clientWith(fetchImpl)
  const result = await client.downloadSignedPdf('doc-firmado')
  assert.ok(Buffer.isBuffer(result))
  assert.deepEqual(result, signed)
  assert.deepEqual(calls.map(summarize), [
    {
      method: 'GET',
      url: `${API}/documents/doc-firmado/files/SIGNED_DOCUMENT`,
      authorization: `Bearer ${TOKEN}`,
      contentType: null,
      body: undefined
    },
    {
      method: 'GET',
      url: SIGNED_URL,
      authorization: null,
      contentType: null,
      body: undefined
    }
  ])
  assertBearerScope(calls, API, TOKEN)
})

test('collectEvidence requests one certificate per distinct email id', async () => {
  const eventsA = [
    { hub_email_id: 'e1', type: 'sent' },
    { hub_email_id: 'e1', type: 'open' },
    { hub_email_id: 'e2', type: 'sent' }
  ]
  const eventsB = [{ hub_email_id: 'e3', type: 'sent' }]
  const logs = [{ event: 'created' }, { event: 'sent' }]
  const pdfs = {
    'https://files.example/cert-e1': Buffer.from('pdf-e1'),
    'https://files.example/cert-e2': Buffer.from('pdf-e2'),
    'https://files.example/cert-e3': Buffer.from('pdf-e3')
  }
  const { calls, fetchImpl } = createFetch((call) => {
    const path = new URL(call.url).pathname
    if (call.method === 'GET' && path === '/documents/doc-ev/logs') {
      return jsonRes(200, { items: logs, next: 'https://api.should-not-follow' })
    }
    if (path === '/documents/doc-ev/signees/signee-a/emails/events') {
      return jsonRes(200, { items: eventsA })
    }
    if (path === '/documents/doc-ev/signees/signee-b/emails/events') {
      return jsonRes(200, { items: eventsB })
    }
    if (path === '/documents/doc-ev/signees/signee-a/emails/e1/certificate') {
      return jsonRes(200, { download_url: 'https://files.example/cert-e1' })
    }
    if (path === '/documents/doc-ev/signees/signee-a/emails/e2/certificate') {
      return jsonRes(200, { download_url: 'https://files.example/cert-e2' })
    }
    if (path === '/documents/doc-ev/signees/signee-b/emails/e3/certificate') {
      return jsonRes(200, { download_url: 'https://files.example/cert-e3' })
    }
    if (pdfs[call.url]) return binRes(pdfs[call.url])
    return jsonRes(599, { detail: `inesperado ${call.method} ${call.url}` })
  })
  const client = clientWith(fetchImpl)
  const result = await client.collectEvidence('doc-ev', ['signee-a', 'signee-b'])
  assert.deepEqual(calls.map((call) => `${call.method} ${call.url}`), [
    `GET ${API}/documents/doc-ev/logs`,
    `GET ${API}/documents/doc-ev/signees/signee-a/emails/events`,
    `GET ${API}/documents/doc-ev/signees/signee-a/emails/e1/certificate`,
    'GET https://files.example/cert-e1',
    `GET ${API}/documents/doc-ev/signees/signee-a/emails/e2/certificate`,
    'GET https://files.example/cert-e2',
    `GET ${API}/documents/doc-ev/signees/signee-b/emails/events`,
    `GET ${API}/documents/doc-ev/signees/signee-b/emails/e3/certificate`,
    'GET https://files.example/cert-e3'
  ])
  assert.equal(calls.some((call) => call.url.includes('should-not-follow')), false)
  assertBearerScope(calls, API, TOKEN)
  assert.equal(calls[3].headers.Authorization, undefined)
  assert.equal(calls[5].headers.Authorization, undefined)
  assert.equal(calls[8].headers.Authorization, undefined)
  assert.deepEqual(result, {
    logs,
    signees: [
      {
        privateCode: 'signee-a',
        events: eventsA,
        certificates: [
          { emailId: 'e1', pdf: pdfs['https://files.example/cert-e1'] },
          { emailId: 'e2', pdf: pdfs['https://files.example/cert-e2'] }
        ]
      },
      {
        privateCode: 'signee-b',
        events: eventsB,
        certificates: [{ emailId: 'e3', pdf: pdfs['https://files.example/cert-e3'] }]
      }
    ]
  })
})

test('missing log and event items are empty arrays', async () => {
  const { calls, fetchImpl } = createFetch((call) => {
    const path = new URL(call.url).pathname
    if (path.endsWith('/logs') || path.endsWith('/events')) return jsonRes(200, {})
    return jsonRes(599, { detail: `inesperado ${call.url}` })
  })
  const client = clientWith(fetchImpl)
  const result = await client.collectEvidence('doc-ev', ['signee-a'])
  assert.deepEqual(result, {
    logs: [],
    signees: [{ privateCode: 'signee-a', events: [], certificates: [] }]
  })
  assert.equal(calls.length, 2)
})

test('isFirmeConfigured is true when url, token and legal entity are set', async () => {
  await withFirmeEnv({ url: CFG_URL, token: CFG_TOKEN, entity: CFG_ENTITY }, ({ isFirmeConfigured }) => {
    assert.equal(isFirmeConfigured(), true)
  })
})

test('isFirmeConfigured is false when the token is empty', async () => {
  await withFirmeEnv({ url: CFG_URL, token: '', entity: CFG_ENTITY }, ({ isFirmeConfigured }) => {
    assert.equal(isFirmeConfigured(), false)
  })
})

test('isFirmeConfigured is false when the legal entity is empty', async () => {
  await withFirmeEnv({ url: CFG_URL, token: CFG_TOKEN, entity: '' }, ({ isFirmeConfigured }) => {
    assert.equal(isFirmeConfigured(), false)
  })
})

test('createFirmeClient() uses config values and global.fetch', async () => {
  await withFirmeEnv({ url: CFG_URL, token: CFG_TOKEN, entity: CFG_ENTITY }, async ({ createFirmeClient: create }) => {
    const previous = global.fetch
    const calls = []
    const handler = createSendMock()
    global.fetch = async (url, init = {}) => {
      const call = {
        url: String(url),
        method: init.method,
        headers: init.headers || {},
        body: init.body
      }
      calls.push(call)
      return handler(call)
    }
    try {
      const client = create()
      assert.equal(calls.length, 0)
      const result = await client.sendForSignature(sendInput([person()]))
      assert.equal(calls[0].url, `${CFG_URL}/transactions`)
      assert.equal(calls[0].headers.Authorization, `Bearer ${CFG_TOKEN}`)
      assert.deepEqual(JSON.parse(calls[0].body), { legalEntityId: CFG_ENTITY })
      assertBearerScope(calls, CFG_URL, CFG_TOKEN)
      assert.equal(result.documentCode, DOC_CODE)
      assert.equal(calls.length, 8)
    } finally {
      global.fetch = previous
    }
  })
})

test('createFirmeClient({ fetchImpl }) fills apiUrl, token and legalEntityId from config', async () => {
  await withFirmeEnv({ url: CFG_URL, token: CFG_TOKEN, entity: CFG_ENTITY }, async ({ createFirmeClient: create }) => {
    const previous = global.fetch
    let usedGlobal = false
    global.fetch = async () => {
      usedGlobal = true
      return jsonRes(599, { detail: 'uso global.fetch' })
    }
    try {
      const { calls, fetchImpl } = createFetch(createSendMock())
      const client = create({ fetchImpl })
      assert.equal(calls.length, 0)
      await client.sendForSignature(sendInput([person(), luis]))
      assert.equal(usedGlobal, false)
      assert.equal(calls[0].url, `${CFG_URL}/transactions`)
      assert.equal(calls[0].headers.Authorization, `Bearer ${CFG_TOKEN}`)
      assert.deepEqual(JSON.parse(calls[0].body), { legalEntityId: CFG_ENTITY })
      assertBearerScope(calls, CFG_URL, CFG_TOKEN)
      assert.equal(calls.length, 10)
    } finally {
      global.fetch = previous
    }
  })
})

for (const field of ['apiUrl', 'token', 'legalEntityId']) {
  test(`empty string ${field} is not replaced by config`, async () => {
    await withFirmeEnv({ url: CFG_URL, token: CFG_TOKEN, entity: CFG_ENTITY }, async ({ createFirmeClient: create }) => {
      const { calls, fetchImpl } = createFetch(createSendMock())
      const client = create({ [field]: '', fetchImpl })
      await expectError(() => client.sendForSignature(sendInput([person()])), (err) => {
        assert.equal(err.code, 'FIRME_NOT_CONFIGURED')
        assert.equal(err.message, NOT_CONFIGURED)
        assert.equal(calls.length, 0)
      })
    })
  })
}

test('the factory does not call the network', () => {
  const { calls, fetchImpl } = createFetch(createSendMock())
  const client = createFirmeClient({
    apiUrl: '',
    token: '',
    legalEntityId: '',
    fetchImpl
  })
  assert.equal(typeof client.sendForSignature, 'function')
  assert.equal(typeof client.getDocument, 'function')
  assert.equal(calls.length, 0)
})
