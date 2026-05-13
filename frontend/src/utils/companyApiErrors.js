/**
 * Mensaje en español (Chile) para fallos de creación o actualización de empresa vía API.
 *
 * @param {{ ok: false, status?: number, code?: string | null, message?: string } | { ok: true }} res
 * @returns {string} Texto listo para mostrar al usuario; cadena vacía si `res.ok`.
 */
export function userMessageFromCompanySaveFailure(res) {
  if (res.ok) return ''
  const raw = typeof res.message === 'string' ? res.message.trim() : ''
  const status = res.status ?? 0
  const code = res.code ?? ''

  if (status === 409 || code === 'RUT_DUPLICATED') {
    return (
      raw ||
      'Este RUT de empresa ya está registrado. Ingrese otro RUT o revise la lista de empresas para editar el registro existente.'
    )
  }

  if (status === 400 && code === 'VALIDATION_ERROR') {
    if (raw) return raw
    return 'Los datos enviados no son válidos. Revise el formulario e intente nuevamente.'
  }

  if (raw) return raw
  return 'No se pudo guardar la empresa. Intente nuevamente.'
}

/**
 * @param {{ ok: false, status?: number, code?: string | null, message?: string } | { ok: true }} res
 * @returns {boolean} true si el error está asociado al RUT de la empresa (cabecera).
 */
export function isCompanyRutConflictResponse(res) {
  if (res.ok) return false
  const status = res.status ?? 0
  const code = res.code ?? ''
  return status === 409 || code === 'RUT_DUPLICATED'
}

/**
 * @param {unknown} text
 * @returns {boolean} true si el texto corresponde al aviso de RUT de empresa duplicado (para limpiar al editar el RUT).
 */
export function isCompanyRutDuplicateUserMessage(text) {
  if (text == null || typeof text !== 'string') return false
  const t = text.trim()
  if (!t) return false
  return /ya existe una empresa con ese rut|ya está registrado|RUT de empresa ya está registrado/i.test(t)
}
