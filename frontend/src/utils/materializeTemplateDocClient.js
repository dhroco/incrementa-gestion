import { resolveClauseContentReadBatched } from '../api/clauseResolveReadBatcher'

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function normalizeDoc(raw) {
  if (isPlainObject(raw) && raw.type === 'doc' && Array.isArray(raw.content)) return raw
  return { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
}

function normalizeClauseDoc(raw) {
  if (isPlainObject(raw) && raw.type === 'doc' && Array.isArray(raw.content)) return raw
  return null
}

/**
 * Replace embedded clause nodes with resolved clause content blocks.
 * The output doc contains no embedded clause nodes, allowing a “print-like” preview.
 *
 * @param {unknown} templateDoc TipTap JSON (doc)
 * @param {{ accessToken: string, companyId: string | null }} ctx
 * @returns {Promise<any>}
 */
export async function materializeTemplateDocClient(templateDoc, { accessToken, companyId }) {
  const doc = normalizeDoc(templateDoc)

  async function materializeNodeToMany(node) {
    if (!isPlainObject(node)) return []

    if (node.type === 'embeddedUniversalClause') {
      const clauseId = typeof node.attrs?.clauseId === 'string' ? node.attrs.clauseId.trim() : ''
      const clauseKind = node.attrs?.clauseKind === 'company' ? 'company' : 'universal'
      const clauseCompanyId =
        clauseKind === 'company' && typeof node.attrs?.companyId === 'string' && node.attrs.companyId.trim()
          ? node.attrs.companyId.trim()
          : clauseKind === 'company'
            ? companyId
            : null

      if (!accessToken || !clauseId) {
        return [{ type: 'paragraph', content: [{ type: 'text', text: 'Cláusula no disponible.' }] }]
      }

      const res = await resolveClauseContentReadBatched({
        accessToken,
        clauseId,
        clauseKind,
        companyId: clauseCompanyId,
      })
      if (!res?.ok) {
        return [{ type: 'paragraph', content: [{ type: 'text', text: res?.message ?? 'Cláusula no disponible.' }] }]
      }
      const clauseDoc = normalizeClauseDoc(res.content_json)
      if (!clauseDoc) {
        return [{ type: 'paragraph', content: [{ type: 'text', text: 'Cláusula no disponible.' }] }]
      }

      const blocks = Array.isArray(clauseDoc.content) ? clauseDoc.content : []
      const out = []
      for (const b of blocks) {
        const many = await materializeNodeToMany(b)
        out.push(...many)
      }
      return out.length ? out : [{ type: 'paragraph', content: [] }]
    }

    if (Array.isArray(node.content)) {
      const outContent = []
      for (const child of node.content) {
        const many = await materializeNodeToMany(child)
        outContent.push(...many)
      }
      return [{ ...node, content: outContent }]
    }

    return [{ ...node }]
  }

  const out = []
  for (const top of doc.content) {
    const many = await materializeNodeToMany(top)
    out.push(...many)
  }

  return { type: 'doc', content: out }
}

