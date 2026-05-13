function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Collects clause UUIDs from embedded universal clause nodes (TipTap JSON).
 * @param {unknown} doc
 * @returns {string[]}
 */
export function collectEmbeddedClauseIdsFromDoc(doc) {
  const out = new Set()
  function walk(node) {
    if (!isPlainObject(node)) return
    if (node.type === 'embeddedUniversalClause' && typeof node.attrs?.clauseId === 'string') {
      const kind = typeof node.attrs?.clauseKind === 'string' ? node.attrs.clauseKind : 'universal'
      if (kind !== 'universal') return
      const id = node.attrs.clauseId.trim()
      if (id.length > 0) out.add(id)
    }
    if (Array.isArray(node.content)) {
      for (const c of node.content) walk(c)
    }
  }
  walk(doc)
  return [...out]
}
