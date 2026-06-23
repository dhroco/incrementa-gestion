const test = require('node:test')
const assert = require('node:assert/strict')

const scopeMod = require.resolve('../services/companyScopeService')
const resolveMod = require.resolve('../lib/resolveReadableCompanyId')

const COMPANY_ID = '11111111-1111-1111-1111-111111111111'
const MCP_USER_ID = '00000000-0000-0000-0000-000000000001'

function withProfileCode(profileCode, fn) {
  const prevScope = require(scopeMod)
  require.cache[scopeMod].exports = {
    resolveCompanyScopeByUserId: async () => ({
      profileCode,
      userProfileId: 'profile-1',
      mode: 'all'
    })
  }
  delete require.cache[resolveMod]
  const { resolveReadableCompanyId } = require('../lib/resolveReadableCompanyId')
  return fn(resolveReadableCompanyId).finally(() => {
    require.cache[scopeMod].exports = prevScope
    delete require.cache[resolveMod]
  })
}

test('MCP_SERVICE uses requestedCompanyId like ADMINISTRADOR_PLATAFORMA', async () => {
  await withProfileCode('MCP_SERVICE', async (resolveReadableCompanyId) => {
    const result = await resolveReadableCompanyId(MCP_USER_ID, COMPANY_ID)
    assert.deepEqual(result, { ok: true, companyId: COMPANY_ID })
  })
})

test('MCP_SERVICE requires companyId', async () => {
  await withProfileCode('MCP_SERVICE', async (resolveReadableCompanyId) => {
    const result = await resolveReadableCompanyId(MCP_USER_ID, '')
    assert.equal(result.ok, false)
    assert.equal(result.code, 'VALIDATION_ERROR')
  })
})

test('other profiles remain forbidden', async () => {
  await withProfileCode('USUARIO_EMPRESA_ADMINISTRADOR', async (resolveReadableCompanyId) => {
    const result = await resolveReadableCompanyId('user-1', COMPANY_ID)
    assert.equal(result.ok, false)
    assert.equal(result.code, 'FORBIDDEN')
  })
})
