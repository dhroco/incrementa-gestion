function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Render TipTap-like JSON to plain text with `{{variableId}}` tokens for variables.
 * Recursively expands `embeddedUniversalClause` using `loadClauseText(clauseId, clauseKind, companyId)`.
 * @param {unknown} doc
 * @param {(ref: { clauseId: string, clauseKind: string, companyId: string | null }) => Promise<string>} loadClauseText
 * @param {string} companyId
 */
async function tipTapDocToPlainTextAsync(doc, loadClauseText, companyId) {
  if (!isPlainObject(doc)) return ''

  async function walkNode(node) {
    if (!isPlainObject(node)) return ''
    const t = node.type

    if (t === 'text' && typeof node.text === 'string') {
      return node.text
    }
    if (t === 'hardBreak') {
      return '\n'
    }
    if (t === 'variable' && typeof node.attrs?.variableId === 'string') {
      const vid = String(node.attrs.variableId).trim()
      return vid ? `{{${vid}}}` : ''
    }
    if (t === 'embeddedUniversalClause') {
      const clauseId = typeof node.attrs?.clauseId === 'string' ? node.attrs.clauseId.trim() : ''
      if (!clauseId) return ''
      const kindRaw = typeof node.attrs?.clauseKind === 'string' ? node.attrs.clauseKind : 'universal'
      const clauseKind = kindRaw === 'company' ? 'company' : 'universal'
      const refCompanyId =
        typeof node.attrs?.companyId === 'string' && node.attrs.companyId.trim().length > 0
          ? node.attrs.companyId.trim()
          : null
      const text = await loadClauseText({ clauseId, clauseKind, companyId: refCompanyId ?? companyId })
      return text
    }

    const parts = []
    if (Array.isArray(node.content)) {
      for (const c of node.content) {
        parts.push(await walkNode(c))
      }
    }
    let inner = parts.join('')

    if (t === 'paragraph' || t === 'heading') {
      inner = inner.replace(/\s+$/u, '')
      return `${inner}\n\n`
    }
    if (t === 'bulletList' || t === 'orderedList' || t === 'listItem' || t === 'doc') {
      return inner
    }
    return inner
  }

  return (await walkNode(doc)).replace(/\n{3,}/gu, '\n\n').trim()
}

module.exports = {
  tipTapDocToPlainTextAsync,
}
