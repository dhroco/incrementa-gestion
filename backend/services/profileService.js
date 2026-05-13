const { db } = require('../db/knex')

async function getCurrentUserProfile(userId) {
  const row = await db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .select('p.code as code', 'p.label as label', 'up.user_id as user_id')
    .where('up.user_id', userId)
    .first()

  return row || null
}

async function getUserProfileIdByUserId(userId) {
  const row = await db('user_profile').select('id').where('user_id', userId).first()
  return row?.id ?? null
}

module.exports = { getCurrentUserProfile, getUserProfileIdByUserId }

