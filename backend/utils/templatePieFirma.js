/**
 * Pie de firma de las plantillas de contrato (CONTRATO_0001 a CONTRATO_0015, proveedores con RUT chileno):
 *   1. se elimina el pie de firma del influencer (lo agrega Firme.cl en su proceso de firma): el bloque
 *      `signatureBlock` del proveedor se conserva pero queda con un solo párrafo vacío;
 *   2. se agrega más espacio entre el último párrafo y la firma del representante de la empresa: 5 párrafos vacíos
 *      justificados antes del párrafo vacío que precede al bloque de firma de la empresa.
 * Es exactamente el cambio que David hizo a mano en CONTRATO_0001 de producción el 12-nov-2026. Función pura sobre
 * el `content_json`: verifica la estructura del final de la plantilla, es idempotente y respeta lo ya editado a mano
 * (si ya hay párrafos de espacio, no agrega más; si el bloque del proveedor ya está vacío, no lo toca).
 */

const TEMPLATE_CODES = Array.from({ length: 15 }, (_, i) => `CONTRATO_${String(i + 1).padStart(4, '0')}`)
const EXTRA_SPACE_PARAGRAPHS = 5

const emptyParagraph = (textAlign) => ({ type: 'paragraph', attrs: { textAlign } })
const isEmptyParagraph = (node, textAlign) =>
  node?.type === 'paragraph' && !(node.content && node.content.length) && (textAlign === undefined || (node.attrs?.textAlign ?? null) === textAlign)

function nodeText(node) {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'variable') return `{{${node.attrs?.variableId}}}`
  return (node.content ?? []).map(nodeText).join('')
}

const lastIndexWhere = (list, predicate) => {
  for (let i = list.length - 1; i >= 0; i--) if (predicate(list[i])) return i
  return -1
}

/** Bloque de firma del proveedor ya vaciado: un único párrafo vacío. */
function isEmptiedSupplierBlock(node) {
  return node?.type === 'signatureBlock' && node.content?.length === 1 && isEmptyParagraph(node.content[0])
}

/**
 * Bloque de firma del proveedor original: la línea de firma y los datos del proveedor. En las plantillas de empresa
 * son tres líneas (firma, representante legal, «p.p. razón social»); en las de persona natural, dos (firma y nombre).
 */
function isOriginalSupplierBlock(node) {
  if (node?.type !== 'signatureBlock' || !Array.isArray(node.content) || ![2, 3].includes(node.content.length)) return false
  if (!node.content.every((p) => p?.type === 'paragraph')) return false
  const text = nodeText(node)
  return text.startsWith('_____') && /\{\{proveedor_(rep_legal|nombre)\}\}/.test(text)
}

/**
 * @param {object} contentJson
 * @param {string} code
 * @returns {{ content: object, status: 'applied'|'already'|'excluded', replaced: number, applied?: string[], reason?: string }}
 */
function rewritePieFirma(contentJson, code) {
  if (!TEMPLATE_CODES.includes(code)) {
    throw new Error(`La plantilla ${code} no está en la tabla de plantillas con pie de firma.`)
  }
  const content = structuredClone(contentJson)
  const blocks = content.content ?? []
  const excluded = (reason) => ({ content, status: 'excluded', replaced: 0, reason })

  const company = lastIndexWhere(blocks, (n) => n?.type === 'signatureBlock' && n.attrs?.party === 'company')
  if (company < 0) return excluded('no tiene el bloque de firma de la empresa')
  if (blocks.filter((n) => n?.type === 'signatureBlock' && n.attrs?.party === 'company').length !== 1) {
    return excluded('tiene más de un bloque de firma de la empresa')
  }
  const supplier = company + 2
  if (supplier !== blocks.length - 1 || blocks[supplier]?.type !== 'signatureBlock' || blocks[supplier].attrs?.party !== 'supplier') {
    return excluded('el final no es «firma de la empresa, párrafo vacío, firma del proveedor»')
  }
  if (!isEmptyParagraph(blocks[company - 1], null) || !isEmptyParagraph(blocks[company + 1])) {
    return excluded('falta el párrafo vacío antes de la firma de la empresa o entre las dos firmas')
  }

  // Espacio: cuántos párrafos vacíos justificados ya hay antes del párrafo vacío que precede a la firma de la empresa.
  let existingSpace = 0
  for (let i = company - 2; i >= 0 && isEmptyParagraph(blocks[i], 'justify'); i--) existingSpace++
  const textBefore = blocks[company - 2 - existingSpace]
  if (!textBefore || textBefore.type !== 'paragraph' || !nodeText(textBefore).trim()) {
    return excluded('lo que hay antes del espacio no es el último párrafo del contrato')
  }

  const supplierEmptied = isEmptiedSupplierBlock(blocks[supplier])
  if (!supplierEmptied && !isOriginalSupplierBlock(blocks[supplier])) {
    return excluded('el bloque de firma del proveedor no es el original ni está vaciado')
  }

  const applied = []
  if (existingSpace === 0) {
    blocks.splice(company - 1, 0, ...Array.from({ length: EXTRA_SPACE_PARAGRAPHS }, () => emptyParagraph('justify')))
    applied.push('espacio')
  }
  if (!supplierEmptied) {
    const last = blocks.length - 1
    blocks[last] = { type: 'signatureBlock', attrs: structuredClone(blocks[last].attrs), content: [emptyParagraph('center')] }
    applied.push('pie del influencer')
  }
  return applied.length ? { content, status: 'applied', replaced: applied.length, applied } : { content, status: 'already', replaced: 0 }
}

module.exports = { rewritePieFirma, TEMPLATE_CODES, EXTRA_SPACE_PARAGRAPHS }
