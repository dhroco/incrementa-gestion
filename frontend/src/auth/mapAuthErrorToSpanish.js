/**
 * Maps Supabase Auth errors (or generic Error) to user-visible Spanish (es-CL) messages.
 * @param {unknown} error
 * @returns {string}
 */
export function mapAuthErrorToSpanish(error) {
  if (error == null) {
    return 'Ocurrió un error inesperado. Intente nuevamente.'
  }

  const code = error.code ?? error.status
  const message = typeof error.message === 'string' ? error.message : ''

  // Password recovery / session context issues
  if (/auth session missing/i.test(message) || /session not found/i.test(message)) {
    return 'El enlace de recuperación no es válido o expiró. Solicite uno nuevo.'
  }
  if (/expired/i.test(message) || /invalid.*token/i.test(message) || /token.*invalid/i.test(message)) {
    return 'El enlace de recuperación no es válido o expiró. Solicite uno nuevo.'
  }
  if (code === 'weak_password' || /password should be at least/i.test(message) || /weak password/i.test(message)) {
    return 'La contraseña no cumple los requisitos del sistema. Use al menos 8 caracteres e incluya mayúsculas, minúsculas, números y símbolos si el administrador de Auth lo exige.'
  }

  if (
    code === 'same_password' ||
    /same password/i.test(message) ||
    /different from the old/i.test(message) ||
    /must be different/i.test(message)
  ) {
    return 'La nueva contraseña debe ser distinta de la contraseña temporal actual.'
  }

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'Correo o contraseña incorrectos.'
  }

  if (/invalid.*password/i.test(message) || /password.*invalid/i.test(message)) {
    return 'La contraseña no es válida para el sistema de autenticación. Revise longitud y complejidad o intente con otra distinta.'
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Debe confirmar su correo electrónico antes de ingresar.'
  }
  if (code === 'user_banned' || /banned/i.test(message)) {
    return 'Su cuenta no está habilitada para ingresar.'
  }
  if (code === 'too_many_requests' || /too many requests/i.test(message)) {
    return 'Demasiados intentos. Espere unos minutos e intente nuevamente.'
  }
  if (code === 429 || /429/.test(message)) {
    return 'Demasiados intentos. Espere unos minutos e intente nuevamente.'
  }
  if (code === 'network_error' || /fetch|network|failed to fetch/i.test(message)) {
    return 'No se pudo conectar. Verifique su conexión e intente nuevamente.'
  }

  if (message.trim()) {
    return 'No se pudo completar la operación. Intente nuevamente.'
  }

  return 'No se pudo completar la operación. Intente nuevamente.'
}
