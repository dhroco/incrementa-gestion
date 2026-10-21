const test = require('node:test')
const assert = require('node:assert/strict')

const graphMod = require.resolve('../lib/graphClient')
const configMod = require.resolve('../config')

const originalFetch = global.fetch

function mockFetch(handler) {
  global.fetch = async (url, init) => handler(String(url), init)
}

function restoreFetch() {
  global.fetch = originalFetch
}

function loadGraphClient() {
  delete require.cache[graphMod]
  delete require.cache[configMod]
  return require('../lib/graphClient')
}

function fakeCredential(token = 'graph-token') {
  const calls = []
  return {
    calls,
    getToken: async (scope) => {
      calls.push(scope)
      return { token, expiresOnTimestamp: Date.now() + 3600 * 1000 }
    }
  }
}

function cleanup() {
  restoreFetch()
  delete require.cache[graphMod]
  delete require.cache[configMod]
}

test('findUserByEmail usa el token de la credencial y devuelve el usuario', async () => {
  let authHeader = null
  mockFetch(async (url, init) => {
    if (url.includes('/v1.0/users?')) {
      authHeader = init?.headers?.Authorization
      assert.equal(init?.headers?.ConsistencyLevel, 'eventual')
      return {
        ok: true,
        text: async () =>
          JSON.stringify({ value: [{ id: 'oid-1', displayName: 'Ana Pérez', mail: 'ana@ejemplo.cl' }] })
      }
    }
    throw new Error(`fetch inesperado: ${url}`)
  })
  const credential = fakeCredential()
  try {
    const { getGraphClient, resetGraphClientForTests } = loadGraphClient()
    resetGraphClientForTests({ credential })
    const result = await getGraphClient().findUserByEmail('  Ana@Ejemplo.CL ')
    assert.deepEqual(result, { id: 'oid-1', fullName: 'Ana Pérez' })
    assert.equal(authHeader, 'Bearer graph-token')
    assert.deepEqual(credential.calls, ['https://graph.microsoft.com/.default'])
  } finally {
    cleanup()
  }
})

test('no se pide al endpoint de tokens con client secret', async () => {
  const urls = []
  mockFetch(async (url) => {
    urls.push(url)
    return { ok: true, text: async () => JSON.stringify({ value: [] }) }
  })
  try {
    const { getGraphClient, resetGraphClientForTests } = loadGraphClient()
    resetGraphClientForTests({ credential: fakeCredential() })
    await getGraphClient().findUserByEmail('a@b.cl')
    assert.ok(urls.every((u) => !u.includes('oauth2/v2.0/token')))
  } finally {
    cleanup()
  }
})

test('el token se reutiliza entre consultas mientras no venza', async () => {
  mockFetch(async () => ({ ok: true, text: async () => JSON.stringify({ value: [] }) }))
  const credential = fakeCredential()
  try {
    const { getGraphClient, resetGraphClientForTests } = loadGraphClient()
    resetGraphClientForTests({ credential })
    const client = getGraphClient()
    await client.findUserByEmail('a@b.cl')
    await client.findUserByEmail('c@d.cl')
    assert.equal(credential.calls.length, 1)
  } finally {
    cleanup()
  }
})

test('findUserByEmail devuelve null cuando Graph no encuentra a nadie', async () => {
  mockFetch(async () => ({ ok: true, text: async () => JSON.stringify({ value: [] }) }))
  try {
    const { getGraphClient, resetGraphClientForTests } = loadGraphClient()
    resetGraphClientForTests({ credential: fakeCredential() })
    assert.equal(await getGraphClient().findUserByEmail('missing@ejemplo.cl'), null)
  } finally {
    cleanup()
  }
})

test('si la credencial no entrega token, lanza GraphClientError GRAPH_TOKEN_FAILED', async () => {
  mockFetch(async (url) => {
    throw new Error(`fetch inesperado: ${url}`)
  })
  try {
    const { getGraphClient, resetGraphClientForTests, GraphClientError } = loadGraphClient()
    resetGraphClientForTests({
      credential: {
        getToken: async () => {
          throw new Error('sin identidad')
        }
      }
    })
    await assert.rejects(
      () => getGraphClient().findUserByEmail('a@b.cl'),
      (err) => err instanceof GraphClientError && err.code === 'GRAPH_TOKEN_FAILED'
    )
  } finally {
    cleanup()
  }
})

test('findUserByEmail usa el email como nombre si displayName viene vacío', async () => {
  mockFetch(async () => ({
    ok: true,
    text: async () => JSON.stringify({ value: [{ id: 'oid-2', displayName: '' }] })
  }))
  try {
    const { getGraphClient, resetGraphClientForTests } = loadGraphClient()
    resetGraphClientForTests({ credential: fakeCredential() })
    assert.deepEqual(await getGraphClient().findUserByEmail('solo@ejemplo.cl'), {
      id: 'oid-2',
      fullName: 'solo@ejemplo.cl'
    })
  } finally {
    cleanup()
  }
})

test('con GRAPH_ENABLED=false no hay cliente de Graph', () => {
  const prev = process.env.GRAPH_ENABLED
  process.env.GRAPH_ENABLED = 'false'
  try {
    const { getGraphClient, isGraphConfigured, resetGraphClientForTests } = loadGraphClient()
    resetGraphClientForTests()
    assert.equal(isGraphConfigured(), false)
    assert.equal(getGraphClient(), null)
  } finally {
    if (prev === undefined) delete process.env.GRAPH_ENABLED
    else process.env.GRAPH_ENABLED = prev
    cleanup()
  }
})
