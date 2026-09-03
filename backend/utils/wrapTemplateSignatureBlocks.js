const BACKUP_NOTE = 'pre-firma-escrita-bloque-firma'

const SIGNATURE_VARIABLES = {
  company_legal_rep1_name: { party: 'company', repIndex: 1 },
  company_legal_rep2_name: { party: 'company', repIndex: 2 },
  // Persona natural: la línea la encabeza el nombre del proveedor.
  proveedor_nombre: { party: 'supplier', repIndex: null },
  // Empresa: la encabeza su representante legal, y debajo va "p.p. {{proveedor_nombre}}".
  proveedor_rep_legal: { party: 'supplier', repIndex: null },
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function paragraphPlainText(node) {
  if (!isPlainObject(node) || node.type !== 'paragraph') return ''
  const parts = []
  for (const child of node.content || []) {
    if (child?.type === 'text' && typeof child.text === 'string') {
      parts.push(child.text)
    } else if (child?.type === 'variable' && typeof child.attrs?.variableId === 'string') {
      parts.push(`{{${child.attrs.variableId}}}`)
    }
  }
  return parts.join('')
}

function findSignatureVariableInParagraph(node) {
  if (!isPlainObject(node) || node.type !== 'paragraph') return null
  for (const child of node.content || []) {
    if (child?.type === 'variable' && typeof child.attrs?.variableId === 'string') {
      const id = child.attrs.variableId
      if (SIGNATURE_VARIABLES[id]) return id
    }
  }
  const text = paragraphPlainText(node)
  for (const id of Object.keys(SIGNATURE_VARIABLES)) {
    if (text.includes(`{{${id}}}`)) return id
  }
  return null
}

function isUnderscoreParagraph(node) {
  const text = paragraphPlainText(node).replace(/\s/gu, '')
  if (!text.length) return false
  return /^[_\-—–]+$/u.test(text)
}

function isOptionalPpParagraph(node) {
  const text = paragraphPlainText(node).trim().toLowerCase()
  return text.startsWith('p.p.') || text.startsWith('pp.')
}

function tryMatchCanonicalGroup(blocks, startIndex) {
  const lineNode = blocks[startIndex]
  if (!lineNode || lineNode.type !== 'paragraph' || !isUnderscoreParagraph(lineNode)) return null

  const nameNode = blocks[startIndex + 1]
  if (!nameNode || nameNode.type !== 'paragraph') return null

  const variableId = findSignatureVariableInParagraph(nameNode)
  if (!variableId) return null

  const attrs = SIGNATURE_VARIABLES[variableId]
  const content = [lineNode, nameNode]
  let consumed = 2

  const maybePp = blocks[startIndex + 2]
  if (maybePp && maybePp.type === 'paragraph' && isOptionalPpParagraph(maybePp)) {
    content.push(maybePp)
    consumed += 1
  }

  return { attrs, content, consumed }
}

function analyzeNonCanonicalSignatureGroups(content) {
  const issues = []

  for (let i = 0; i < content.length; i += 1) {
    const node = content[i]
    if (!isPlainObject(node)) continue
    if (node.type === 'signatureBlock') continue

    if (node.type === 'paragraph') {
      // Solo se analiza la REGIÓN DE FIRMA, anclada en las líneas de guiones. Las variables de
      // firma también aparecen en el cuerpo del contrato (comparecencia, PERSONERÍA, cláusulas
      // de precio), y marcarlas ahí producía un falso positivo por plantilla que abortaba el
      // wrap de las 17.
      if (isUnderscoreParagraph(node)) {
        const next = content[i + 1]
        const nextVar = next && next.type === 'paragraph' ? findSignatureVariableInParagraph(next) : null
        if (!nextVar) {
          issues.push('Línea de guiones sin párrafo de nombre con variable de firma')
        }
      }
    }
  }

  return issues
}

function wrapSignatureBlocksInDoc(doc) {
  if (!isPlainObject(doc) || doc.type !== 'doc' || !Array.isArray(doc.content)) {
    return { doc, wrapped: 0, changed: false, issues: ['Documento inválido: se esperaba type doc con content[]'] }
  }

  const preIssues = analyzeNonCanonicalSignatureGroups(doc.content)
  if (preIssues.length) {
    return { doc, wrapped: 0, changed: false, issues: preIssues }
  }

  const newContent = []
  let wrapped = 0
  let i = 0

  while (i < doc.content.length) {
    const node = doc.content[i]
    if (node?.type === 'signatureBlock') {
      newContent.push(node)
      i += 1
      continue
    }

    const match = tryMatchCanonicalGroup(doc.content, i)
    if (match) {
      newContent.push({
        type: 'signatureBlock',
        attrs: match.attrs,
        content: match.content,
      })
      wrapped += 1
      i += match.consumed
      continue
    }

    newContent.push(node)
    i += 1
  }

  const changed = wrapped > 0
  return {
    doc: changed ? { ...doc, content: newContent } : doc,
    wrapped,
    changed,
    issues: [],
  }
}

module.exports = {
  BACKUP_NOTE,
  SIGNATURE_VARIABLES,
  wrapSignatureBlocksInDoc,
  analyzeNonCanonicalSignatureGroups,
  paragraphPlainText,
  isUnderscoreParagraph,
  findSignatureVariableInParagraph,
  tryMatchCanonicalGroup,
}
