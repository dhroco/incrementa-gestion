/**
 * @param {Record<string, unknown>} fields
 * @returns {string}
 */
export function formDirtySnapshot(fields) {
  return JSON.stringify(fields)
}

/**
 * @param {string | null | undefined} baseline
 * @param {Record<string, unknown>} currentFields
 * @returns {boolean}
 */
export function isFormDirty(baseline, currentFields) {
  if (baseline == null) return false
  return baseline !== formDirtySnapshot(currentFields)
}
