const { db } = require('../db/knex')

/**
 * @param {string} userId - auth.users.id
 * @param {string} profileCode
 * @returns {Promise<{
 *   mustChangePassword: boolean,
 *   accountantIsActive: boolean | null | undefined,
 *   userIsActive: boolean | null | undefined,
 *   displayName: string | null
 * }>}
 */
function displayNameFromRow(up) {
  if (!up) return null
  const s = up.full_name != null ? String(up.full_name).trim() : ''
  return s.length > 0 ? s : null
}

async function loadSessionMetaForUser(userId, profileCode) {
  const up = await db('user_profile')
    .select('id', 'must_change_password', 'is_active', 'full_name')
    .where({ user_id: userId })
    .first()

  const mustChangePassword = !!(up && up.must_change_password === true)
  const displayName = displayNameFromRow(up)

  if (profileCode !== 'CONTADOR') {
    const userIsActive = up ? up.is_active !== false : true
    return { mustChangePassword, accountantIsActive: undefined, userIsActive, displayName }
  }

  if (!up?.id) {
    return { mustChangePassword, accountantIsActive: null, userIsActive: undefined, displayName }
  }

  const acc = await db('accountant').select('id').where({ id: up.id }).first()
  if (!acc) {
    return { mustChangePassword, accountantIsActive: false, userIsActive: undefined, displayName }
  }

  return {
    mustChangePassword,
    accountantIsActive: up.is_active !== false,
    userIsActive: undefined,
    displayName
  }
}

module.exports = { loadSessionMetaForUser }
