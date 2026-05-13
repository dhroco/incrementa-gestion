const PROFILE_NOT_ASSIGNED_MESSAGE =
  'No tiene un perfil interno asignado. Contacte al administrador del sistema.'

const FORBIDDEN_MESSAGE = 'Acceso denegado. No tiene permisos para realizar esta acción.'

const ACCOUNTANT_INACTIVE_MESSAGE =
  'Su usuario contador está deshabilitado. Contacte al administrador de la plataforma para reactivarlo.'

const USER_INACTIVE_MESSAGE =
  'Su usuario está deshabilitado. Contacte al administrador de la plataforma para reactivarlo.'

function buildNoProfileAssignedBody(userId, email) {
  return {
    code: 'PROFILE_NOT_ASSIGNED',
    message: PROFILE_NOT_ASSIGNED_MESSAGE,
    userId,
    email: email ?? null
  }
}

function buildForbiddenBody() {
  return {
    code: 'FORBIDDEN',
    message: FORBIDDEN_MESSAGE
  }
}

function buildAccountantInactiveBody(userId, email) {
  return {
    code: 'ACCOUNTANT_INACTIVE',
    message: ACCOUNTANT_INACTIVE_MESSAGE,
    userId,
    email: email ?? null
  }
}

function buildUserInactiveBody(userId, email) {
  return {
    code: 'USER_INACTIVE',
    message: USER_INACTIVE_MESSAGE,
    userId,
    email: email ?? null
  }
}

/**
 * @param {{ code: string, label: string }} profile
 * @param {{ tree: unknown[], routes: unknown[], grantedCodes?: string[] } | null | undefined} [navigation] - effective navigation from database (tree + flat routes + optional code list)
 * @param {string | null} [displayName] - `user_profile.full_name` (trimmed); when set, response includes `name` for UI
 */
function buildEnrichedSessionSuccessBody(
  userId,
  email,
  profile,
  navigation,
  sessionMeta = null,
  displayName = null
) {
  const body = {
    userId,
    email: email ?? null,
    profile: { code: profile.code, label: profile.label }
  }
  if (displayName && typeof displayName === 'string' && displayName.trim().length > 0) {
    body.name = displayName.trim()
  }
  if (navigation) {
    body.navigation = navigation
  }
  if (sessionMeta && typeof sessionMeta === 'object') {
    if (typeof sessionMeta.mustChangePassword === 'boolean') {
      body.mustChangePassword = sessionMeta.mustChangePassword
    }
    if (sessionMeta.isActive === true || sessionMeta.isActive === false) {
      body.isActive = sessionMeta.isActive
    }
  }
  return body
}

module.exports = {
  PROFILE_NOT_ASSIGNED_MESSAGE,
  FORBIDDEN_MESSAGE,
  ACCOUNTANT_INACTIVE_MESSAGE,
  USER_INACTIVE_MESSAGE,
  buildNoProfileAssignedBody,
  buildForbiddenBody,
  buildAccountantInactiveBody,
  buildUserInactiveBody,
  buildEnrichedSessionSuccessBody
}
