const { AbilityBuilder, createMongoAbility } = require('@casl/ability')
const { packRules } = require('@casl/ability/extra')

/**
 * @param {Array<[string, string]>} rules
 */
function buildAbilityFromRules(rules = []) {
  const { can, build } = new AbilityBuilder(createMongoAbility)
  for (const [action, subject] of rules) {
    can(action, subject)
  }
  return build()
}

/**
 * Express middleware stub that sets req.ability from explicit rules.
 * @param {Array<[string, string]>} rules
 */
function attachAbilityWithRules(rules = [['manage', 'all']]) {
  const ability = buildAbilityFromRules(rules)
  return (req, _res, next) => {
    req.ability = ability
    next()
  }
}

function passthroughInternalIdentity(_req, _res, next) {
  next()
}

/**
 * Stub for buildPackedRulesForUser in session tests.
 * @param {{ code: string, label: string }} profile
 * @param {Array<[string, string]>} rules
 */
function packedRulesForProfile(profile, rules = [['manage', 'all']]) {
  const ability = buildAbilityFromRules(rules)
  return {
    profile,
    packedRules: packRules(ability.rules)
  }
}

module.exports = {
  buildAbilityFromRules,
  attachAbilityWithRules,
  packedRulesForProfile,
  passthroughInternalIdentity
}
