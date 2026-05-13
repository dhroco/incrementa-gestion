/**
 * Stable string compare for JSON documents (e.g. TipTap content_json).
 * @param {unknown} value
 * @returns {string}
 */
function stableJsonStringify(value) {
  if (value === undefined) return '__undefined__'
  try {
    return JSON.stringify(value === undefined ? null : value)
  } catch {
    return String(value)
  }
}

module.exports = { stableJsonStringify }
