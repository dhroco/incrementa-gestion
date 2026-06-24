const test = require('node:test')
const assert = require('node:assert/strict')

const serviceMod = require.resolve('../services/platformUsersAdminService')
const graphMod = require.resolve('../lib/graphClient')
const knexMod = require.resolve('../db/knex')

const originalGraph = require.cache[graphMod]
const originalKnex = require.cache[knexMod]

function installGraphMock(impl) {
  require.cache[graphMod] = {
    id: graphMod,
    filename: graphMod,
    loaded: true,
    exports: impl
  }
}

function installKnexMock(dbFn) {
  require.cache[knexMod] = {
    id: knexMod,
    filename: knexMod,
    loaded: true,
    exports: { db: dbFn }
  }
}

function loadService() {
  delete require.cache[serviceMod]
  return require('../services/platformUsersAdminService')
}

function restoreModules() {
  if (originalGraph) require.cache[graphMod] = originalGraph
  else delete require.cache[graphMod]
  if (originalKnex) require.cache[knexMod] = originalKnex
  else delete require.cache[knexMod]
  delete require.cache[serviceMod]
}

test('createPlatformUser returns 503 when Graph is not configured', async () => {
  installGraphMock({
    getGraphClient: () => null
  })
  installKnexMock(() => {
    throw new Error('db should not be called')
  })

  try {
    const { createPlatformUser } = loadService()
    const result = await createPlatformUser({
      userId: 'admin',
      payload: { email: 'a@b.cl', profile_code: 'ADMINISTRADOR_PLATAFORMA' }
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 503)
    assert.equal(result.code, 'ADMIN_CLIENT_UNAVAILABLE')
    assert.match(result.message, /Microsoft Graph/)
  } finally {
    restoreModules()
  }
})

test('createPlatformUser returns 422 when user not in Entra tenant', async () => {
  installGraphMock({
    getGraphClient: () => ({
      findUserByEmail: async () => null
    })
  })
  installKnexMock((table) => {
    if (table === 'user_profile') {
      return {
        select() {
          return this
        },
        where() {
          return this
        },
        first: async () => null
      }
    }
    throw new Error(`unexpected table: ${table}`)
  })

  try {
    const { createPlatformUser } = loadService()
    const result = await createPlatformUser({
      userId: 'admin',
      payload: { email: 'missing@ejemplo.cl', profile_code: 'ADMINISTRADOR_PLATAFORMA' }
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 422)
    assert.equal(result.code, 'IDP_USER_NOT_FOUND')
    assert.match(result.message, /Microsoft Entra/)
  } finally {
    restoreModules()
  }
})

test('createPlatformUser returns 503 when Graph lookup fails', async () => {
  const { GraphClientError } = require('../lib/graphClient')
  installGraphMock({
    getGraphClient: () => ({
      findUserByEmail: async () => {
        throw new GraphClientError('network')
      }
    })
  })
  installKnexMock((table) => {
    if (table === 'user_profile') {
      return {
        select() {
          return this
        },
        where() {
          return this
        },
        first: async () => null
      }
    }
    throw new Error(`unexpected table: ${table}`)
  })

  try {
    const { createPlatformUser } = loadService()
    const result = await createPlatformUser({
      userId: 'admin',
      payload: { email: 'a@b.cl', profile_code: 'ADMINISTRADOR_PLATAFORMA' }
    })
    assert.equal(result.ok, false)
    assert.equal(result.status, 503)
    assert.equal(result.code, 'ADMIN_CLIENT_UNAVAILABLE')
    assert.match(result.message, /Microsoft Entra/)
  } finally {
    restoreModules()
  }
})

test('updatePlatformUser ignores email in payload', async () => {
  let updatedPatch = null

  installGraphMock({
    getGraphClient: () => null
  })

  const db = (table) => {
    if (table === 'user_profile as up') {
      const detailChain = {
        join() {
          return detailChain
        },
        select() {
          return detailChain
        },
        where() {
          return detailChain
        },
        first: async () => ({
          id: 'profile-1',
          email: 'original@ejemplo.cl',
          full_name: 'Original',
          is_active: true,
          profile_code: 'ADMINISTRADOR_PLATAFORMA',
          profile_label: 'Administrador de plataforma'
        })
      }
      return detailChain
    }
    if (table === 'user_profile') {
      return {
        select() {
          return this
        },
        where() {
          return this
        },
        first: async () => null,
        update: async (patch) => {
          updatedPatch = patch
        }
      }
    }
    if (table === 'profile') {
      return {
        select() {
          return this
        },
        where() {
          return this
        },
        first: async () => ({ id: 'profile-id-1' })
      }
    }
    throw new Error(`unexpected table: ${table}`)
  }

  db.transaction = async (fn) => fn(db)

  installKnexMock(db)

  try {
    const { updatePlatformUser } = loadService()
    const result = await updatePlatformUser({
      userId: 'admin',
      platformUserProfileId: 'profile-1',
      payload: { email: 'otro@ejemplo.cl', is_active: false }
    })

    assert.equal(result.ok, true)
    assert.equal(updatedPatch?.email, undefined)
    assert.equal(updatedPatch?.is_active, false)
    assert.equal(result.data?.user?.email, 'original@ejemplo.cl')
  } finally {
    restoreModules()
  }
})
