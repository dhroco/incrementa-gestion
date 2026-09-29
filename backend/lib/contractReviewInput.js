const { createHash } = require('node:crypto')
const { tipTapDocToPlainTextAsync } = require('../utils/tipTapPlainText')
const { getDynamicTextDefinition } = require('../services/dynamicTextCatalog')

function getVariableMeta(id) {
  return require('../services/documentBuilderService').getVariableMeta(id)
}

const CLAUSE_NUMBER = /^2\.\d/

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function topLevelBlocks(doc) {
  if (!isPlainObject(doc) || !Array.isArray(doc.content)) return []
  return doc.content.filter((node) => isPlainObject(node))
}

function collectParagraphs(node, out) {
  if (!isPlainObject(node)) return
  if (node.type === 'paragraph') out.push(node)
  if (!Array.isArray(node.content)) return
  for (const child of node.content) collectParagraphs(child, out)
}

function collectDynamicTextIds(doc) {
  const ids = []
  const seen = new Set()

  function walk(node) {
    if (!isPlainObject(node)) return
    if (node.type === 'variable' && typeof node.attrs?.variableId === 'string') {
      const id = String(node.attrs.variableId).trim()
      if (id && !seen.has(id) && getVariableMeta(id).type === 'dynamic_text') {
        seen.add(id)
        ids.push(id)
      }
    }
    if (!Array.isArray(node.content)) return
    for (const child of node.content) walk(child)
  }

  walk(doc)
  return ids
}

function normalizedDynamicValue(overrides, id) {
  const raw = overrides?.[id]
  if (raw == null) return ''
  return String(raw).trim().replace(/\s+/g, ' ')
}

function blankToNull(value) {
  if (value == null) return null
  const text = String(value)
  return text.trim() === '' ? null : text
}

function buildDynamicTexts(templateDoc, overrides) {
  return collectDynamicTextIds(templateDoc).map((id) => {
    const def = getDynamicTextDefinition(id)
    const meta = getVariableMeta(id)
    return {
      id,
      label: def?.label ?? meta.label,
      instruccion: def?.instruccion ?? '',
      value: normalizedDynamicValue(overrides, id)
    }
  })
}

function buildDatos(supplier, overrides) {
  const networks = Array.isArray(supplier?.social_networks) ? supplier.social_networks : []
  return {
    redesDelProveedor: networks.map((network) => ({
      red: blankToNull(network?.name),
      cuenta: blankToNull(network?.account_name)
    })),
    mes_ejecucion: blankToNull(overrides?.mes_ejecucion),
    fecha_contrato: blankToNull(overrides?.fecha_contrato)
  }
}

async function sectionTextFromSubstitutedDoc(doc) {
  const blocks = topLevelBlocks(doc)
  const texts = []
  for (const block of blocks) {
    texts.push(await tipTapDocToPlainTextAsync(block))
  }

  const segundo = texts.findIndex((text) => text.trim().startsWith('SEGUNDO'))
  const tercero = texts.findIndex((text) => text.trim().startsWith('TERCERO'))
  if (segundo !== -1 && tercero !== -1 && tercero > segundo) {
    return texts.slice(segundo, tercero).join('\n\n')
  }

  const paragraphs = []
  collectParagraphs(doc, paragraphs)
  const clauseTexts = []
  for (const paragraph of paragraphs) {
    const text = await tipTapDocToPlainTextAsync(paragraph)
    if (CLAUSE_NUMBER.test(text.trim())) clauseTexts.push(text)
  }
  return clauseTexts.join('\n\n')
}

async function buildContractReviewInput({ templateDoc, substitutedDoc, overrides, supplier }) {
  const sectionText = await sectionTextFromSubstitutedDoc(substitutedDoc)
  const dynamicTexts = buildDynamicTexts(templateDoc, overrides)
  const datos = buildDatos(supplier, overrides)
  const payload = { sectionText, dynamicTexts, datos }
  return {
    payload,
    inputHash: hashContractReviewInput(payload),
    hasDynamicText: dynamicTexts.length > 0
  }
}

function hashContractReviewInput(payload) {
  const canonical = {
    sectionText: payload.sectionText,
    dynamicTexts: payload.dynamicTexts.map((item) => ({
      id: item.id,
      label: item.label,
      instruccion: item.instruccion,
      value: item.value
    })),
    datos: {
      redesDelProveedor: payload.datos.redesDelProveedor.map((network) => ({
        red: network.red,
        cuenta: network.cuenta
      })),
      mes_ejecucion: payload.datos.mes_ejecucion,
      fecha_contrato: payload.datos.fecha_contrato
    }
  }
  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex')
}

module.exports = {
  collectDynamicTextIds,
  buildContractReviewInput,
  hashContractReviewInput,
  sectionTextFromSubstitutedDoc
}
