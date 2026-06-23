function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Render TipTap-like JSON to plain text with `{{variableId}}` tokens for variables.
 * Legacy `embeddedUniversalClause` nodes are omitted (no resolution).
 * @param {unknown} doc
 */
async function tipTapDocToPlainTextAsync(doc) {
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
      return ''
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
