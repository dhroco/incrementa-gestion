const PROFILE_NOT_ASSIGNED_MESSAGE =
  'No tiene un perfil interno asignado. Contacte al administrador del sistema.'

const FORBIDDEN_MESSAGE = 'Acceso denegado. No tiene permisos para realizar esta acción.'

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
 * @param {unknown[] | null | undefined} [permissions] - packed CASL rules for the user's profile
 * @param {string | null} [displayName] - `user_profile.full_name` (trimmed); when set, response includes `name` for UI
 */
function buildEnrichedSessionSuccessBody(
  userId,
  email,
  profile,
  permissions,
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
  if (Array.isArray(permissions)) {
    body.permissions = permissions
  }
  if (sessionMeta && typeof sessionMeta === 'object') {
    if (sessionMeta.isActive === true || sessionMeta.isActive === false) {
      body.isActive = sessionMeta.isActive
    }
    if (typeof sessionMeta.contactEmail === 'string' && sessionMeta.contactEmail.trim().length > 0) {
      body.contact_email = sessionMeta.contactEmail.trim()
    }
    if (
      sessionMeta.widgetPreferences != null &&
      typeof sessionMeta.widgetPreferences === 'object' &&
      !Array.isArray(sessionMeta.widgetPreferences)
    ) {
      body.widget_preferences = sessionMeta.widgetPreferences
    }
    if (typeof sessionMeta.avatarUrl === 'string' && sessionMeta.avatarUrl.trim().length > 0) {
      body.avatar_url = sessionMeta.avatarUrl.trim()
    }
  }
  return body
}

module.exports = {
  PROFILE_NOT_ASSIGNED_MESSAGE,
  FORBIDDEN_MESSAGE,
  USER_INACTIVE_MESSAGE,
  buildNoProfileAssignedBody,
  buildForbiddenBody,
  buildUserInactiveBody,
  buildEnrichedSessionSuccessBody
}
