function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function isValidEmail(v) {
  if (!isNonEmptyString(v)) return false
  // Simple, pragmatic validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

module.exports = { isNonEmptyString, isValidEmail }

