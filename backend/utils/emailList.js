const { isValidEmail } = require('./validation')

/** Separa «a@x.cl, b@x.cl; c@x.cl» en direcciones sueltas, sin vacíos ni repetidas (sin distinguir mayúsculas). */
function parseEmailList(value) {
  if (typeof value !== 'string') return []
  const seen = new Set()
  const out = []
  for (const part of value.split(/[,;\s]+/)) {
    const email = part.trim()
    if (!email) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(email)
  }
  return out
}

/** true si hay al menos una dirección y todas tienen formato válido. */
function isValidEmailList(value) {
  const list = parseEmailList(value)
  return list.length > 0 && list.every((email) => isValidEmail(email))
}

module.exports = { parseEmailList, isValidEmailList }
