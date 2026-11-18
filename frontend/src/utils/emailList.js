/** Direcciones sueltas de un texto con comas, puntos y coma, saltos de línea o espacios; sin vacías ni repetidas. */
export function parseEmailList(value) {
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

/** Para mostrar en el campo: una dirección por línea. */
export function emailListToLines(value) {
  return parseEmailList(value).join('\n')
}

/** Para guardar: «a@x.cl, b@x.cl». */
export function emailListToStored(value) {
  return parseEmailList(value).join(', ')
}
