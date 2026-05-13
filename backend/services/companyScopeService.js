const { db } = require('../db/knex')
const { getCurrentUserProfile, getUserProfileIdByUserId } = require('./profileService')

async function resolveCompanyScopeByUserId(userId) {
  const profile = await getCurrentUserProfile(userId)
  if (!profile) return null
  const profileCode = profile.code
  const userProfileId = await getUserProfileIdByUserId(userId)
  if (!userProfileId) return null

  if (profileCode === 'ADMINISTRADOR_PLATAFORMA') {
    return { profileCode, userProfileId, mode: 'all' }
  }

  if (profileCode === 'USUARIO_EMPRESA_ADMINISTRADOR') {
    const row = await db('company_internal_user').select('company_id').where({ id: userProfileId }).first()
    const companyId = row?.company_id ?? null
    return { profileCode, userProfileId, mode: 'single', companyId }
  }

  if (profileCode === 'CONTADOR') {
    const rows = await db('accountant_company as ac')
      .join('company as c', 'c.id', 'ac.company_id')
      .where('ac.accountant_id', userProfileId)
      .select('ac.company_id')
    const companyIds = rows.map((r) => r.company_id).filter(Boolean)
    return { profileCode, userProfileId, mode: 'set', companyIds }
  }

  return { profileCode, userProfileId, mode: 'none' }
}

module.exports = { resolveCompanyScopeByUserId }

