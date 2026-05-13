function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Expand `embeddedUniversalClause` nodes by inlining clause `content_json` (recursively).
 * @param {unknown} root
 * @param {(ref: { clauseId: string, clauseKind: string, companyId: string | null }) => Promise<unknown | null>} loadClauseContentJson
 * @param {string} companyId
 * @returns {Promise<{ type: 'doc', content: unknown[] }>}
 */
async function materializeTipTapDocAsync(root, loadClauseContentJson, companyId) {
  const emptyDoc = { type: 'doc', content: [] }
  if (!isPlainObject(root)) return emptyDoc

  async function loadExpandedClauseBlocks(embedNode) {
    const clauseId = typeof embedNode.attrs?.clauseId === 'string' ? embedNode.attrs.clauseId.trim() : ''
    if (!clauseId) return []
    const kindRaw = typeof embedNode.attrs?.clauseKind === 'string' ? embedNode.attrs.clauseKind : 'universal'
    const clauseKind = kindRaw === 'company' ? 'company' : 'universal'
    const refCompanyId =
      typeof embedNode.attrs?.companyId === 'string' && embedNode.attrs.companyId.trim().length > 0
        ? embedNode.attrs.companyId.trim()
        : null
    const effectiveCompany = clauseKind === 'company' ? refCompanyId ?? companyId : companyId
    const docJson = await loadClauseContentJson({
      clauseId,
      clauseKind,
      companyId: effectiveCompany
    })
    if (!isPlainObject(docJson)) return []
    const inner = docJson.type === 'doc' && Array.isArray(docJson.content) ? docJson.content : [docJson]
    const blocks = []
    for (const b of inner) {
      blocks.push(await cloneWithExpandedContent(b))
    }
    return blocks
  }

  async function expandChildrenArray(content) {
    if (!Array.isArray(content)) return []
    const out = []
    for (const child of content) {
      if (!isPlainObject(child)) continue
      if (child.type === 'embeddedUniversalClause') {
        const blocks = await loadExpandedClauseBlocks(child)
        for (const b of blocks) out.push(b)
      } else {
        out.push(await cloneWithExpandedContent(child))
      }
    }
    return out
  }

  async function cloneWithExpandedContent(node) {
    if (!isPlainObject(node)) return node
    const n = { ...node }
    if (node.attrs && typeof node.attrs === 'object') n.attrs = { ...node.attrs }
    if (Array.isArray(node.content)) {
      n.content = await expandChildrenArray(node.content)
    }
    return n
  }

  const top = root.type === 'doc' && Array.isArray(root.content) ? root.content : []
  const newContent = await expandChildrenArray(top)
  return { type: 'doc', content: newContent }
}

module.exports = {
  materializeTipTapDocAsync
}
