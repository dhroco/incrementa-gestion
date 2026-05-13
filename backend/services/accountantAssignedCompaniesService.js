const { db } = require('../db/knex')
const { getUserProfileIdByUserId } = require('./profileService')

/**
 * Empresas asignadas al contador (vía accountant_company), cualquier estado operativo (activa, inactiva, borrador).
 * @param {string} userId - auth.users.id
 * @returns {Promise<{ id: string, business_name: string | null }[]>}
 */
async function listAssignedCompaniesForAccountant(userId) {
  const userProfileId = await getUserProfileIdByUserId(userId)
  if (!userProfileId) return []
  const rows = await db('accountant_company as ac')
    .join('company as c', 'c.id', 'ac.company_id')
    .select('c.id', 'c.business_name')
    .where('ac.accountant_id', userProfileId)
    .orderBy('c.business_name', 'asc')
  return rows.map((r) => ({
    id: r.id,
    business_name: r.business_name ?? null
  }))
}

module.exports = { listAssignedCompaniesForAccountant }
