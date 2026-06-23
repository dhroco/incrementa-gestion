const { getCurrentUserProfile, getUserProfileIdByUserId } = require('./profileService')

async function resolveCompanyScopeByUserId(userId) {
  const profile = await getCurrentUserProfile(userId)
  if (!profile) return null
  const profileCode = profile.code
  const userProfileId = await getUserProfileIdByUserId(userId)
  if (!userProfileId) return null

  return { profileCode, userProfileId, mode: 'all' }
}

module.exports = { resolveCompanyScopeByUserId }
