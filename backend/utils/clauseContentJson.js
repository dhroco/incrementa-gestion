function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * TipTap document root: { type: 'doc', content: Block[] }.
 * @param {unknown} value
 * @param {{ required?: boolean }} [opts]
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
function validateClauseContentJson(value, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) {
      return {
        ok: false,
        code: 'CLAUSE_CONTENT_JSON_REQUIRED',
        message: 'El contenido de la cláusula es obligatorio.',
      }
    }
    return { ok: true }
  }
  if (!isPlainObject(value)) {
    return {
      ok: false,
      code: 'CLAUSE_INVALID_CONTENT_JSON',
      message: 'El contenido debe ser un documento JSON válido.',
    }
  }
  if (value.type !== 'doc') {
    return {
      ok: false,
      code: 'CLAUSE_INVALID_CONTENT_JSON',
      message: 'El contenido del editor no tiene el formato esperado.',
    }
  }
  if (!Array.isArray(value.content) || value.content.length === 0) {
    return {
      ok: false,
      code: 'CLAUSE_EMPTY_CONTENT',
      message: 'El contenido de la cláusula no puede estar vacío.',
    }
  }
  return { ok: true }
}

module.exports = { validateClauseContentJson }
