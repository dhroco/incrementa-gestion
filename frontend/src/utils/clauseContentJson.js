function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Mirrors backend validateClauseContentJson for client-side checks before submit.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateClauseContentJsonClient(value) {
  if (value === undefined || value === null) {
    return { ok: false, message: 'El contenido de la cláusula es obligatorio.' }
  }
  if (!isPlainObject(value)) {
    return { ok: false, message: 'El contenido debe ser un documento JSON válido.' }
  }
  if (value.type !== 'doc') {
    return { ok: false, message: 'El contenido del editor no tiene el formato esperado.' }
  }
  if (!Array.isArray(value.content) || value.content.length === 0) {
    return { ok: false, message: 'El contenido de la cláusula no puede estar vacío.' }
  }
  return { ok: true }
}
