const PARTICLES = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'y',
  'e',
  'san',
  'santa',
  'da',
  'di',
  'van',
  'von'
])

const EMPTY = { firstNames: '', lastName: '', maternalLastName: '' }

function isParticle(token) {
  return PARTICLES.has(token.toLowerCase())
}

function assignGroups(groups) {
  if (groups.length === 0) return { ...EMPTY }
  if (groups.length === 1) {
    return { firstNames: groups[0], lastName: '', maternalLastName: '' }
  }
  if (groups.length === 2) {
    return { firstNames: groups[0], lastName: groups[1], maternalLastName: '' }
  }
  if (groups.length === 3) {
    return { firstNames: groups[0], lastName: groups[1], maternalLastName: groups[2] }
  }
  return {
    firstNames: groups.slice(0, -2).join(' '),
    lastName: groups[groups.length - 2],
    maternalLastName: groups[groups.length - 1]
  }
}

/** Copia local de `backend/utils/personName.js`. No importar el backend. */
export function splitFullName(text) {
  if (typeof text !== 'string') return { ...EMPTY }
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (!normalized) return { ...EMPTY }

  const groups = []
  let pending = []
  for (const token of normalized.split(' ')) {
    if (isParticle(token)) {
      pending.push(token)
      continue
    }
    groups.push([...pending, token].join(' '))
    pending = []
  }
  for (const token of pending) groups.push(token)
  return assignGroups(groups)
}
