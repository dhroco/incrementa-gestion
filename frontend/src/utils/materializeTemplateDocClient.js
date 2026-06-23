function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function normalizeDoc(raw) {
  if (isPlainObject(raw) && raw.type === 'doc' && Array.isArray(raw.content)) return raw
  return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
}

/**
 * Legacy embedded clause nodes are stripped; other content is preserved for preview.
 * @param {unknown} templateDoc TipTap JSON (doc)
 * @returns {Promise<object>}
 */
export async function materializeTemplateDocClient(templateDoc) {
  const doc = normalizeDoc(templateDoc)

  function stripEmbeddedClauses(node) {
    if (!isPlainObject(node)) return []
    if (node.type === 'embeddedUniversalClause') return []

    if (Array.isArray(node.content)) {
      const out = []
      for (const child of node.content) {
        out.push(...stripEmbeddedClauses(child))
      }
      return [{ ...node, content: out }]
    }

    return [{ ...node }]
  }

  const out = []
  for (const top of doc.content) {
    out.push(...stripEmbeddedClauses(top))
  }

  return { type: 'doc', content: out }
}
