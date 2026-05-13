const { validateClauseContentJson } = require('./clauseContentJson')

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Walk TipTap JSON and collect clause references from embedded universal clause nodes.
 * @param {unknown} doc
 * @returns {{ clauseId: string, clauseKind: 'universal' | 'company', companyId: string | null }[]}
 */
function collectEmbeddedClauseRefsFromDoc(doc) {
  const out = []
  function walk(node) {
    if (!isPlainObject(node)) return
    if (node.type === 'embeddedUniversalClause' && typeof node.attrs?.clauseId === 'string') {
      const kindRaw = typeof node.attrs?.clauseKind === 'string' ? node.attrs.clauseKind : 'universal'
      const clauseKind = kindRaw === 'company' ? 'company' : 'universal'
      const clauseId = node.attrs.clauseId.trim()
      const companyId = typeof node.attrs?.companyId === 'string' && node.attrs.companyId.trim().length > 0 ? node.attrs.companyId.trim() : null
      if (clauseId.length > 0) out.push({ clauseId, clauseKind, companyId })
    }
    if (Array.isArray(node.content)) {
      for (const c of node.content) walk(c)
    }
  }
  walk(doc)
  return out
}

/**
 * Collect only universal clause UUIDs referenced in embedded nodes.
 * @param {unknown} doc
 * @returns {string[]}
 */
function collectEmbeddedClauseIdsFromDoc(doc) {
  const out = new Set()
  const refs = collectEmbeddedClauseRefsFromDoc(doc)
  for (const r of refs) {
    if (r.clauseKind === 'universal') out.add(r.clauseId)
  }
  return [...out]
}

/**
 * Same structural rules as clause content (TipTap doc, non-empty).
 * @param {unknown} value
 * @param {{ required?: boolean }} [opts]
 */
function validateTemplateContentJson(value, opts) {
  return validateClauseContentJson(value, opts)
}

module.exports = {
  collectEmbeddedClauseIdsFromDoc,
  collectEmbeddedClauseRefsFromDoc,
  validateTemplateContentJson,
}
