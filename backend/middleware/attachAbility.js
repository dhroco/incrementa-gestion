const { createMongoAbility } = require('@casl/ability')
const { buildAbilityForUser } = require('../services/abilityService')

function attachAbility({ buildAbilityForUser: buildAbility = buildAbilityForUser } = {}) {
  return async (req, res, next) => {
    try {
      if (req.auth?.userId) {
        const { ability } = await buildAbility(req.auth.userId)
        req.ability = ability
      } else {
        req.ability = createMongoAbility([])
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}

module.exports = { attachAbility }
