const test = require('node:test')
const assert = require('node:assert/strict')

const { createFirmeClient, FirmeClientError } = require('../lib/firmeClient')

const API = 'https://api.firme.test'
const TOKEN = 'secreto-firme-no-mostrar'
const ENTITY = 'entity-1'
const USER_AGENT = 'Incrementa-Contratos/1.0'

function jsonRes(status, payload) {
  const body = payload === undefined ? '' : JSON.stringify(payload)
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => body
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
    return handler(call, calls)
  }
  return { calls, fetchImpl }
}

function clientWith(fetchImpl) {
  return createFirmeClient({ apiUrl: API, token: TOKEN, legalEntityId: ENTITY, fetchImpl })
}

const pdf = Buffer.from('%PDF-1.4')

function signee() {
  return {
    firstName: 'Ana',
    lastName: 'Pérez',
    maternalLastName: 'Soto',
    documentNumber: '12.345.678-5',
    email: 'ana@ejemplo.cl',
    signature: { page: 1, x: 0.3, y: 0.8 }
  }
}

test('API calls carry the User-Agent and presigned calls omit it', async () => {
  const { calls, fetchImpl } = createFetch((call) => {
    const path = new URL(call.url).pathname
    if (call.url.startsWith('https://files.example')) return jsonRes(200, {})
    if (path === '/transactions') return jsonRes(201, { id: 'tx-1' })
    if (path === '/documents' && call.method === 'POST') {
      return jsonRes(201, { code: 'doc-1', uploadUrl: 'https://files.example/upload' })
    }
    if (path.endsWith('/signees')) return jsonRes(201, { privateCode: 'priv-1' })
    return jsonRes(200, {})
  })
  const client = clientWith(fetchImpl)
  await client.sendForSignature({ pdf, name: 'Contrato', signees: [signee()] })

  const apiCalls = calls.filter((call) => call.url.startsWith(API))
  const presigned = calls.filter((call) => call.url.startsWith('https://files.example'))
  assert.ok(apiCalls.length > 0)
  assert.equal(presigned.length, 1)
  for (const call of apiCalls) {
    assert.equal(call.headers['User-Agent'], USER_AGENT)
    assert.equal(call.headers.Authorization, `Bearer ${TOKEN}`)
  }
  assert.equal(presigned[0].headers['User-Agent'], undefined)
  assert.equal(presigned[0].headers.Authorization, undefined)
})

test('Progress is reported before complete', async () => {
  const seen = []
  const { calls, fetchImpl } = createFetch((call) => {
    const path = new URL(call.url).pathname
    if (call.url.startsWith('https://files.example')) return jsonRes(200, {})
    if (path === '/transactions' && call.method === 'POST') return jsonRes(201, { id: 'tx-9' })
    if (path === '/documents' && call.method === 'POST') {
      return jsonRes(201, { code: 'doc-9', uploadUrl: 'https://files.example/upload' })
    }
    if (path.endsWith('/signees')) return jsonRes(201, { privateCode: 'priv-9' })
    return jsonRes(200, {})
  })
  const client = clientWith(fetchImpl)
  const result = await client.sendForSignature(
    { pdf, name: 'Contrato', signees: [signee()] },
    {
      onProgress(progress) {
        seen.push({
          progress: { ...progress, signees: progress.signees.map((item) => ({ ...item })) },
          completeSeen: calls.some((call) => call.url.endsWith('/complete'))
        })
      }
    }
  )

  assert.equal(seen.length, 4)
  assert.equal(seen[0].progress.transactionId, 'tx-9')
  assert.equal(seen[0].progress.documentCode, undefined)
  assert.equal(seen[1].progress.documentCode, 'doc-9')
  assert.equal(seen[2].progress.signees.length, 1)
  assert.equal(seen[2].progress.signees[0].privateCode, 'priv-9')
  assert.equal(seen.every((entry) => entry.completeSeen), false)
  assert.deepEqual(result, {
    transactionId: 'tx-9',
    documentCode: 'doc-9',
    signees: [{ email: 'ana@ejemplo.cl', privateCode: 'priv-9' }]
  })
})

test('A throwing callback does not stop the send', async () => {
  let callsToProgress = 0
  const { fetchImpl } = createFetch((call) => {
    const path = new URL(call.url).pathname
    if (call.url.startsWith('https://files.example')) return jsonRes(200, {})
    if (path === '/transactions') return jsonRes(201, { id: 'tx-2' })
    if (path === '/documents' && call.method === 'POST') {
      return jsonRes(201, { code: 'doc-2', uploadUrl: 'https://files.example/upload' })
    }
    if (path.endsWith('/signees')) return jsonRes(201, { privateCode: 'priv-2' })
    return jsonRes(200, {})
  })
  const client = clientWith(fetchImpl)
  const result = await client.sendForSignature(
    { pdf, name: 'Contrato', signees: [signee()] },
    {
      onProgress() {
        callsToProgress += 1
        if (callsToProgress === 2) throw new Error('callback roto')
      }
    }
  )
  assert.equal(result.documentCode, 'doc-2')
  assert.ok(callsToProgress >= 2)
})

test('Omitting the callback keeps the signee private code', async () => {
  const { fetchImpl } = createFetch((call) => {
    const path = new URL(call.url).pathname
    if (call.url.startsWith('https://files.example')) return jsonRes(200, {})
    if (path === '/transactions') return jsonRes(201, { id: 'tx-3' })
    if (path === '/documents' && call.method === 'POST') {
      return jsonRes(201, { code: 'doc-3', uploadUrl: 'https://files.example/upload' })
    }
    if (path.endsWith('/signees')) return jsonRes(201, { privateCode: 'priv-3' })
    return jsonRes(200, {})
  })
  const client = clientWith(fetchImpl)
  const result = await client.sendForSignature({ pdf, name: 'Contrato', signees: [signee()] })
  assert.deepEqual(result.signees, [{ email: 'ana@ejemplo.cl', privateCode: 'priv-3' }])
})

test('Quota returns the simple balance and zero when it is missing', async () => {
  const first = createFetch(() => jsonRes(200, { simple: 12 }))
  assert.deepEqual(await clientWith(first.fetchImpl).getQuota(), { simple: 12 })
  const second = createFetch(() => jsonRes(200, { other: 1 }))
  assert.deepEqual(await clientWith(second.fetchImpl).getQuota(), { simple: 0 })
})

test('Empty delete body succeeds', async () => {
  const { calls, fetchImpl } = createFetch(() => jsonRes(200, undefined))
  const result = await clientWith(fetchImpl).deleteDocument('doc-x')
  assert.deepEqual(result, { deleted: true })
  assert.equal(calls[0].method, 'DELETE')
  assert.equal(calls[0].url, `${API}/documents/doc-x`)
})

test('Resend accepts an empty body and 422 hides the token', async () => {
  const ok = createFetch(() => jsonRes(200, ''))
  assert.deepEqual(await clientWith(ok.fetchImpl).resendInvitation('doc-x', 'priv'), { resent: true })

  const fail = createFetch(() => jsonRes(422, { detail: `token ${TOKEN} inválido` }))
  await assert.rejects(
    () => clientWith(fail.fetchImpl).resendInvitation('doc-x', 'priv'),
    (err) => {
      assert.ok(err instanceof FirmeClientError)
      assert.equal(err.status, 422)
      assert.equal(String(err.message).includes(TOKEN), false)
      return true
    }
  )
})

test('Webhook methods send the legal entity and do not leak the token', async () => {
  const { calls, fetchImpl } = createFetch((call) => {
    const path = new URL(call.url).pathname
    if (call.method === 'POST' && path === '/webhooks/subscriptions') return jsonRes(201, { id: 'wh-1' })
    if (call.method === 'GET' && path === '/webhooks/subscriptions') return jsonRes(200, { items: [{ id: 'wh-1' }] })
    if (call.method === 'DELETE') return jsonRes(200, {})
    if (path.endsWith('/missing/status')) return jsonRes(500, { detail: TOKEN })
    if (path.endsWith('/status')) return jsonRes(200, { isConfirmed: true })
    return jsonRes(500, { detail: TOKEN })
  })
  const client = clientWith(fetchImpl)
  const created = await client.createWebhook({ url: 'https://app.example/hook', eventTypes: ['document.signed'] })
  assert.equal(created.id, 'wh-1')
  assert.deepEqual(JSON.parse(calls[0].body), {
    legalEntityId: ENTITY,
    url: 'https://app.example/hook',
    eventTypes: ['document.signed']
  })
  assert.equal(calls[0].headers['User-Agent'], USER_AGENT)
  assert.equal(calls[0].headers.Authorization, `Bearer ${TOKEN}`)

  const listed = await client.listWebhooks()
  assert.equal(listed[0].id, 'wh-1')
  assert.equal(calls[1].url, `${API}/webhooks/subscriptions?legalEntityId=${ENTITY}`)

  await client.deleteWebhook('wh-1')
  assert.equal(calls[2].method, 'DELETE')
  assert.equal(calls[2].url, `${API}/webhooks/subscriptions/wh-1`)

  const status = await client.getWebhook('wh-1')
  assert.equal(status.isConfirmed, true)
  assert.equal(calls[3].url, `${API}/webhooks/subscriptions/wh-1/status`)

  await assert.rejects(
    () => client.getWebhook('missing'),
    (err) => {
      assert.equal(String(err.message).includes(TOKEN), false)
      return true
    }
  )
})
