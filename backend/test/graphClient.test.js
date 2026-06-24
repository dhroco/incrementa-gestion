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

function loadGraphClientWithConfig() {
  delete require.cache[graphMod]
  delete require.cache[configMod]
  return require('../lib/graphClient')
}

test('findUserByEmail returns user when Graph matches by mail', async () => {
  mockFetch(async (url, init) => {
    if (url.includes('oauth2/v2.0/token')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ access_token: 'graph-token', expires_in: 3600 })
      }
    }
    if (url.includes('/v1.0/users?')) {
      assert.equal(init?.headers?.ConsistencyLevel, 'eventual')
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            value: [{ id: 'oid-1', displayName: 'Ana Pérez', mail: 'ana@ejemplo.cl' }]
          })
      }
    }
    throw new Error(`unexpected fetch: ${url}`)
  })

  const prevTenant = process.env.GRAPH_TENANT_ID
  const prevClient = process.env.GRAPH_CLIENT_ID
  const prevSecret = process.env.GRAPH_CLIENT_SECRET
  process.env.GRAPH_TENANT_ID = 'tenant-id'
  process.env.GRAPH_CLIENT_ID = 'client-id'
  process.env.GRAPH_CLIENT_SECRET = 'client-secret'

  try {
    const { getGraphClient, resetGraphClientForTests } = loadGraphClientWithConfig()
    resetGraphClientForTests()
    const client = getGraphClient()
    const result = await client.findUserByEmail('  Ana@Ejemplo.CL ')
    assert.deepEqual(result, { id: 'oid-1', fullName: 'Ana Pérez' })
  } finally {
    process.env.GRAPH_TENANT_ID = prevTenant
    process.env.GRAPH_CLIENT_ID = prevClient
    process.env.GRAPH_CLIENT_SECRET = prevSecret
    restoreFetch()
    delete require.cache[graphMod]
    delete require.cache[configMod]
  }
})

test('findUserByEmail returns null when Graph value is empty', async () => {
  mockFetch(async (url) => {
    if (url.includes('oauth2/v2.0/token')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ access_token: 'graph-token', expires_in: 3600 })
      }
    }
    if (url.includes('/v1.0/users?')) {
      return { ok: true, text: async () => JSON.stringify({ value: [] }) }
    }
    throw new Error(`unexpected fetch: ${url}`)
  })

  const prevTenant = process.env.GRAPH_TENANT_ID
  const prevClient = process.env.GRAPH_CLIENT_ID
  const prevSecret = process.env.GRAPH_CLIENT_SECRET
  process.env.GRAPH_TENANT_ID = 'tenant-id'
  process.env.GRAPH_CLIENT_ID = 'client-id'
  process.env.GRAPH_CLIENT_SECRET = 'client-secret'

  try {
    const { getGraphClient, resetGraphClientForTests } = loadGraphClientWithConfig()
    resetGraphClientForTests()
    const client = getGraphClient()
    const result = await client.findUserByEmail('missing@ejemplo.cl')
    assert.equal(result, null)
  } finally {
    process.env.GRAPH_TENANT_ID = prevTenant
    process.env.GRAPH_CLIENT_ID = prevClient
    process.env.GRAPH_CLIENT_SECRET = prevSecret
    restoreFetch()
    delete require.cache[graphMod]
    delete require.cache[configMod]
  }
})

test('findUserByEmail throws GraphClientError on token failure', async () => {
  mockFetch(async (url) => {
    if (url.includes('oauth2/v2.0/token')) {
      return { ok: false, status: 401, text: async () => '{"error":"invalid_client"}' }
    }
    throw new Error(`unexpected fetch: ${url}`)
  })

  const prevTenant = process.env.GRAPH_TENANT_ID
  const prevClient = process.env.GRAPH_CLIENT_ID
  const prevSecret = process.env.GRAPH_CLIENT_SECRET
  process.env.GRAPH_TENANT_ID = 'tenant-id'
  process.env.GRAPH_CLIENT_ID = 'client-id'
  process.env.GRAPH_CLIENT_SECRET = 'client-secret'

  try {
    const { getGraphClient, resetGraphClientForTests, GraphClientError } = loadGraphClientWithConfig()
    resetGraphClientForTests()
    const client = getGraphClient()
    await assert.rejects(() => client.findUserByEmail('a@b.cl'), GraphClientError)
  } finally {
    process.env.GRAPH_TENANT_ID = prevTenant
    process.env.GRAPH_CLIENT_ID = prevClient
    process.env.GRAPH_CLIENT_SECRET = prevSecret
    restoreFetch()
    delete require.cache[graphMod]
    delete require.cache[configMod]
  }
})

test('findUserByEmail falls back to email when displayName is empty', async () => {
  mockFetch(async (url) => {
    if (url.includes('oauth2/v2.0/token')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ access_token: 'graph-token', expires_in: 3600 })
      }
    }
    if (url.includes('/v1.0/users?')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ value: [{ id: 'oid-2', displayName: '' }] })
      }
    }
    throw new Error(`unexpected fetch: ${url}`)
  })

  const prevTenant = process.env.GRAPH_TENANT_ID
  const prevClient = process.env.GRAPH_CLIENT_ID
  const prevSecret = process.env.GRAPH_CLIENT_SECRET
  process.env.GRAPH_TENANT_ID = 'tenant-id'
  process.env.GRAPH_CLIENT_ID = 'client-id'
  process.env.GRAPH_CLIENT_SECRET = 'client-secret'

  try {
    const { getGraphClient, resetGraphClientForTests } = loadGraphClientWithConfig()
    resetGraphClientForTests()
    const client = getGraphClient()
    const result = await client.findUserByEmail('solo@ejemplo.cl')
    assert.deepEqual(result, { id: 'oid-2', fullName: 'solo@ejemplo.cl' })
  } finally {
    process.env.GRAPH_TENANT_ID = prevTenant
    process.env.GRAPH_CLIENT_ID = prevClient
    process.env.GRAPH_CLIENT_SECRET = prevSecret
    restoreFetch()
    delete require.cache[graphMod]
    delete require.cache[configMod]
  }
})

test('isGraphConfigured is false without GRAPH_CLIENT_SECRET', () => {
  const prevSecret = process.env.GRAPH_CLIENT_SECRET
  process.env.GRAPH_CLIENT_SECRET = ''
  try {
    const { isGraphConfigured } = loadGraphClientWithConfig()
    assert.equal(isGraphConfigured(), false)
  } finally {
    process.env.GRAPH_CLIENT_SECRET = prevSecret
    delete require.cache[graphMod]
    delete require.cache[configMod]
  }
})
