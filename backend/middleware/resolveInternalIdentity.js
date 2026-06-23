const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')

function resolveInternalIdentity({ db }) {
  return async (req, _res, next) => {
    try {
      const rawEmail = req.auth?.email
      if (!rawEmail) {
        return next()
      }

      const normalizedEmail = normalizeAuthEmail(rawEmail)
      if (!normalizedEmail) {
        return next()
      }

      const row = await db('user_profile')
        .select('user_id')
        .whereRaw('LOWER(email) = ?', [normalizedEmail])
        .first()

      if (row?.user_id) {
        req.auth.userId = row.user_id
        req.auth.email = normalizedEmail
      }

      return next()
    } catch (err) {
      return next(err)
    }
  }
}

module.exports = { resolveInternalIdentity }
