const { db } = require('../db/knex')

function displayNameFromRow(up) {
  if (!up) return null
  const s = up.full_name != null ? String(up.full_name).trim() : ''
  return s.length > 0 ? s : null
}

async function loadSessionMetaForUser(userId) {
  const up = await db('user_profile')
    .select(
      'id',
      'is_active',
      'full_name',
      'avatar_gcs_path',
      'contact_email',
      'widget_preferences'
    )
    .where({ user_id: userId })
    .first()

  const displayName = displayNameFromRow(up)
  const userIsActive = up ? up.is_active !== false : true
  const avatarGcsPath =
    up && up.avatar_gcs_path != null && String(up.avatar_gcs_path).trim().length > 0
      ? String(up.avatar_gcs_path).trim()
      : null
  const contactEmail =
    up && up.contact_email != null && String(up.contact_email).trim().length > 0
      ? String(up.contact_email).trim()
      : null
  const widgetPreferences =
    up && up.widget_preferences != null && typeof up.widget_preferences === 'object' && !Array.isArray(up.widget_preferences)
      ? up.widget_preferences
      : null

  return { userIsActive, displayName, avatarGcsPath, contactEmail, widgetPreferences }
}

module.exports = { loadSessionMetaForUser }
