const { AbilityBuilder, createMongoAbility } = require('@casl/ability')
const { packRules } = require('@casl/ability/extra')
const { db } = require('../db/knex')

async function buildAbilityForUser(userId) {
  const userProfile = await db('user_profile')
    .join('profile', 'user_profile.profile_id', 'profile.id')
    .where('user_profile.user_id', userId)
    .where('user_profile.is_active', true)
    .select('profile.id as profile_id', 'profile.code', 'profile.label')
    .first()

  if (!userProfile) {
    return { ability: createMongoAbility([]), profile: null }
  }

  const permissions = await db('role_permissions').where({ role_id: userProfile.profile_id })

  const { can, cannot, build } = new AbilityBuilder(createMongoAbility)

  permissions.forEach(({ action, subject, fields, conditions, inverted }) => {
    const method = inverted ? cannot : can
    const args = [action, subject]
    if (fields) args.push(fields)
    if (conditions) args.push(conditions)
    method(...args)
  })

  return {
    ability: build(),
    profile: {
      id: userProfile.profile_id,
      code: userProfile.code,
      label: userProfile.label
    }
  }
}

async function buildPackedRulesForUser(userId) {
  const { ability, profile } = await buildAbilityForUser(userId)
  return { packedRules: packRules(ability.rules), profile }
}

module.exports = { buildAbilityForUser, buildPackedRulesForUser }
