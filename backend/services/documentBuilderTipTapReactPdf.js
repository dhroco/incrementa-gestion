const path = require('path')
const React = require('react')
const { Document, Page, View, Text, StyleSheet, Font, renderToBuffer } = require('@react-pdf/renderer')
const { sanitizeTextForWinAnsi, normalizeTextForPdfTokenization } = require('./documentBuilderPdfTextUtils')

const PAGE = { W: 595.28, H: 841.89 }
const MARGIN = 48
const BODY = 11
/** En @react-pdf, `lineHeight` es un factor (1 = 100%), NO puntos. Nunca usar fontSize * ratio aquí. */
const LINE_HEIGHT_RATIO = 1.35

let fontFamily = 'Helvetica'
let fontRegistered = false

function tryRegisterLora() {
  if (fontRegistered) return
  fontRegistered = true
  const loraDir = path.join(__dirname, '..', 'node_modules', '@fontsource', 'lora', 'files')
  try {
    Font.register({
      family: 'Lora',
      fonts: [
        { src: path.join(loraDir, 'lora-latin-400-normal.woff'), fontWeight: 400 },
        { src: path.join(loraDir, 'lora-latin-700-normal.woff'), fontWeight: 700 },
        { src: path.join(loraDir, 'lora-latin-400-italic.woff'), fontWeight: 400, fontStyle: 'italic' },
        { src: path.join(loraDir, 'lora-latin-700-italic.woff'), fontWeight: 700, fontStyle: 'italic' },
      ],
    })
    fontFamily = 'Lora'
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[documentBuilderTipTapReactPdf] Lora register failed, using Helvetica:', e?.message || e)
  }
}

const warnedTypes = new Set()

function variableHasFormattingFlag(attrs, marks, type) {
  if (attrs && attrs[type]) return true
  return Array.isArray(marks) && marks.some((m) => m?.type === type)
}

function parseMarks(marks) {
  let bold = false
  let italic = false
  let underline = false
  let uppercase = false
  if (!Array.isArray(marks)) return { bold, italic, underline, uppercase }
  for (const m of marks) {
    const t = m?.type
    if (t === 'bold') bold = true
    if (t === 'italic') italic = true
    if (t === 'underline') underline = true
    if (t === 'uppercase') uppercase = true
  }
  return { bold, italic, underline, uppercase }
}

/**
 * @param {unknown} nodes
 * @returns {Array<{ break?: boolean, text?: string, bold?: boolean, italic?: boolean, underline?: boolean, uppercase?: boolean }>}
 */
function flattenInline(nodes) {
  const out = []
  if (!Array.isArray(nodes)) return out
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue
    if (n.type === 'text' && typeof n.text === 'string') {
      const st = parseMarks(n.marks)
      const parts = normalizeTextForPdfTokenization(n.text).split(/\n/u)
      for (let i = 0; i < parts.length; i += 1) {
        if (i > 0) out.push({ break: true })
        if (parts[i].length) {
          const text = st.uppercase ? parts[i].toUpperCase() : parts[i]
          out.push({ text, ...st })
        }
      }
    } else if (n.type === 'hardBreak') {
      out.push({ break: true })
    } else if (n.type === 'variable') {
      const attrs = n.attrs && typeof n.attrs === 'object' ? n.attrs : {}
      const nodeMarks = Array.isArray(n.marks) ? n.marks : []
      const vid = typeof attrs.variableId === 'string' ? attrs.variableId.trim() : ''
      let text = vid ? `{{${vid}}}` : ''
      const uppercase = variableHasFormattingFlag(attrs, nodeMarks, 'uppercase')
      if (uppercase && text) text = text.toUpperCase()
      out.push({
        text,
        bold: variableHasFormattingFlag(attrs, nodeMarks, 'bold'),
        italic: variableHasFormattingFlag(attrs, nodeMarks, 'italic'),
        underline: variableHasFormattingFlag(attrs, nodeMarks, 'underline'),
        uppercase,
      })
    } else if (Array.isArray(n.content)) {
      out.push(...flattenInline(n.content))
    }
  }
  return out
}

/**
 * Une tramos consecutivos con el mismo estilo; los saltos quedan como { type: 'br' }.
 * @param {ReturnType<typeof flattenInline>} flat
 * @returns {Array<{ type: 'br' } | { text: string, bold: boolean, italic: boolean, underline: boolean }>}
 */
function flatToCoalescedParts(flat) {
  /** @type {Array<{ type: 'br' } | { text: string, bold: boolean, italic: boolean, underline: boolean }>} */
  const out = []
  for (const f of flat) {
    if (f.break) {
      out.push({ type: 'br' })
      continue
    }
    if (f.text === undefined) continue
    const bold = Boolean(f.bold)
    const italic = Boolean(f.italic)
    const underline = Boolean(f.underline)
    const uppercase = Boolean(f.uppercase)
    const last = out[out.length - 1]
    if (
      last &&
      last.type !== 'br' &&
      'text' in last &&
      last.bold === bold &&
      last.italic === italic &&
      last.underline === underline &&
      last.uppercase === uppercase
    ) {
      last.text += f.text
    } else {
      out.push({ text: f.text, bold, italic, underline, uppercase })
    }
  }
  return out
}

/**
 * @param {unknown} attrs
 * @returns { 'left' | 'right' | 'center' | 'justify' }
 */
function blockAlign(attrs) {
  if (attrs == null || typeof attrs !== 'object') return 'left'
  let raw = attrs.textAlign
  if (raw == null && attrs.style && typeof attrs.style === 'string') {
    const m = attrs.style.match(/text-align:\s*(\w+)/i)
    if (m) raw = m[1]
  }
  if (raw == null && typeof attrs.class === 'string') {
    const c = attrs.class
    if (c.includes('has-text-align-center')) raw = 'center'
    else if (c.includes('has-text-align-right')) raw = 'right'
    else if (c.includes('has-text-align-justify') || c.includes('has-text-align-justified')) raw = 'justify'
    else if (c.includes('has-text-align-left')) raw = 'left'
  }
  const a = typeof raw === 'string' ? raw.trim().toLowerCase() : 'left'
  if (a === 'center' || a === 'right' || a === 'justify' || a === 'justified') {
    return a === 'justified' ? 'justify' : a
  }
  return 'left'
}

function headingSize(level) {
  if (level <= 1) return 16
  if (level === 2) return 14
  return 12
}

const CONTENT_W = PAGE.W - 2 * MARGIN

const baseStyles = StyleSheet.create({
  page: { padding: MARGIN, fontSize: BODY, color: '#000' },
  wrap: { width: CONTENT_W },
  /* stretch: el Text hijo ocupa el ancho útil; si no, textAlign center/right no aplica (caja = ancho del texto) */
  paragraphBlock: { width: CONTENT_W, marginBottom: 2, flexDirection: 'column', alignItems: 'stretch' },
  paragraphBlockInList: { width: '100%', marginBottom: 2, flexDirection: 'column', alignItems: 'stretch' },
  bulletRow: { flexDirection: 'row', marginBottom: 2, width: CONTENT_W, alignItems: 'flex-start' },
  bulletMark: { width: 18, fontSize: BODY, fontWeight: 700 },
  bulletText: { flex: 1, width: 0, flexBasis: 0, flexDirection: 'column', alignItems: 'stretch' },
})

/**
 * Un flujo de texto: el texto “normal” va como string en el padre; solo negrita/cursiva/subrayado
 * usan <Text> hijo. Así @react-pdf no reserva “una línea entera” por segmento.
 * @param {ReturnType<typeof flatToCoalescedParts>} parts
 * @param {string} [align]
 */
/**
 * @param {object} p
 * @param {ReturnType<typeof flatToCoalescedParts>} p.parts
 * @param {boolean} [p.inList] Dentro de lista, el ancho es 100% de la columna (no CONTENT_W, más estrecho).
 */
function TextFlow({ parts, fontSize, align = 'left', inList = false }) {
  const w = inList ? '100%' : CONTENT_W
  const baseStyle = {
    fontSize,
    lineHeight: LINE_HEIGHT_RATIO,
    textAlign: align,
    width: w,
    maxWidth: w,
    fontFamily,
  }
  if (!parts || parts.length === 0) {
    return React.createElement(View, { style: { minHeight: fontSize * 1.2, width: w } })
  }
  let key = 0
  const ch = []
  for (const p of parts) {
    if (p && p.type === 'br') {
      ch.push('\n')
      continue
    }
    if (p == null || !('text' in p)) continue
    const t = sanitizeTextForWinAnsi(/** @type {string} */ (p.text))
    if (t.length === 0) continue
    if (!p.bold && !p.italic && !p.underline) {
      ch.push(t)
      continue
    }
    ch.push(
      React.createElement(
        Text,
        {
          key: `e${key++}`,
          style: {
            fontWeight: p.bold ? 700 : 400,
            fontStyle: p.italic ? 'italic' : 'normal',
            textDecoration: p.underline ? 'underline' : 'none',
            fontSize,
            fontFamily,
          },
        },
        t
      )
    )
  }
  if (ch.length === 0) {
    return React.createElement(View, { style: { minHeight: fontSize * 1, width: w } })
  }
  return React.createElement(Text, { style: baseStyle }, ch)
}

/**
 * @param {unknown} node
 * @param {number} listDepth
 * @param {{ index?: number, ordered?: boolean }} [list]
 */
function renderBlock(node, listDepth, list) {
  if (!node || typeof node !== 'object') return null
  const t = node.type
  if (t === 'paragraph') {
    const inList = list != null
    const align = blockAlign(node.attrs)
    const parts = flatToCoalescedParts(flattenInline(node.content))
    const blockStyle = inList
      ? { ...baseStyles.paragraphBlockInList, marginLeft: listDepth, marginTop: 1 }
      : { ...baseStyles.paragraphBlock, marginLeft: listDepth, marginTop: 1 }
    return React.createElement(
      View,
      { key: 'p', style: blockStyle },
      React.createElement(TextFlow, { parts, fontSize: BODY, align, inList })
    )
  }
  if (t === 'heading') {
    const inList = list != null
    const level = Number(node.attrs?.level) || 1
    const fs = headingSize(level)
    const align = blockAlign(node.attrs)
    const parts = flatToCoalescedParts(flattenInline(node.content || []))
    const blockStyle = inList
      ? { ...baseStyles.paragraphBlockInList, marginTop: 4, marginBottom: 4, marginLeft: listDepth }
      : { ...baseStyles.paragraphBlock, marginTop: 4, marginBottom: 4, marginLeft: listDepth }
    return React.createElement(
      View,
      { key: 'h', style: blockStyle },
      React.createElement(TextFlow, { parts, fontSize: fs, align, inList })
    )
  }
  if (t === 'bulletList') {
    let idx = 0
    return React.createElement(
      React.Fragment,
      null,
      ...(node.content || [])
        .filter((it) => it && it.type === 'listItem')
        .map((it) => {
          idx += 1
          return renderListItem(it, listDepth, '• ', idx, false)
        })
    )
  }
  if (t === 'orderedList') {
    const start = Number(node.attrs?.start) || 1
    let n = 0
    return React.createElement(
      React.Fragment,
      null,
      ...(node.content || [])
        .filter((it) => it && it.type === 'listItem')
        .map((it) => {
          n += 1
          return renderListItem(it, listDepth, `${start + n - 1}. `, n, true)
        })
    )
  }
  if (t === 'blockquote') {
    return React.createElement(
      View,
      { key: 'bq', style: { borderLeftWidth: 2, borderLeftColor: '#cccccc', paddingLeft: 8, marginLeft: 8, marginBottom: 4 } },
      ...((node.content || [])
        .map((ch, j) => React.createElement(React.Fragment, { key: `bq${j}` }, renderBlock(ch, listDepth + 12, undefined)))
        .filter(Boolean))
    )
  }
  if (t === 'horizontalRule') {
    return React.createElement(View, {
      key: 'hr',
      style: { borderBottomWidth: 0.75, borderBottomColor: '#000', marginTop: 4, marginBottom: 8, width: '100%' }
    })
  }
  if (t === 'doc' && Array.isArray(node.content)) {
    return (node.content || []).map((ch, i) =>
      React.createElement(React.Fragment, { key: `d${i}` }, renderBlock(ch, listDepth, undefined))
    )
  }
  if (Array.isArray(node.content) && t !== 'text') {
    return (node.content || []).map((ch, i) =>
      React.createElement(React.Fragment, { key: `a${i}` }, renderBlock(ch, listDepth, list))
    )
  }
  if (t && !warnedTypes.has(t)) {
    warnedTypes.add(t)
    // eslint-disable-next-line no-console
    console.warn(`[documentBuilderTipTapReactPdf] unsupported node type skipped: ${t}`)
  }
  return null
}

/**
 * @param {unknown} item
 * @param {number} listDepth
 * @param {string} marker
 * @param {number} k
 * @param {boolean} _ordered
 */
function renderListItem(item, listDepth, marker, k, _ordered) {
  const children = item && Array.isArray(item.content) ? item.content : []
  return React.createElement(
    View,
    { key: `li${k}`, style: baseStyles.bulletRow },
    React.createElement(
      Text,
      { style: { ...baseStyles.bulletMark, fontFamily, marginLeft: listDepth } },
      marker
    ),
    React.createElement(
      View,
      { style: { ...baseStyles.bulletText } },
      children.map((ch, i) =>
        React.createElement(React.Fragment, { key: `c${i}` }, renderBlock(ch, 0, { ordered: _ordered, index: k }))
      )
    )
  )
}

/**
 * @param {unknown} doc
 */
function TipTapPdfDocument({ doc }) {
  const root = doc && typeof doc === 'object' && doc.type === 'doc' ? doc : { type: 'doc', content: [] }
  const pageStyle = [baseStyles.page, { fontFamily }]
  const content = (root.content || [])
    .map((b, i) => {
      const inner = renderBlock(b, 0, undefined)
      if (inner == null) return null
      return React.createElement(React.Fragment, { key: `b${i}` }, inner)
    })
    .filter(Boolean)
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: [PAGE.W, PAGE.H], style: pageStyle },
      ...content
    )
  )
}

/**
 * @param {unknown} doc
 * @returns {Promise<Buffer>}
 */
async function buildPdfBytesFromTipTapWithReactPdf(doc) {
  tryRegisterLora()
  warnedTypes.clear()
  const el = React.createElement(TipTapPdfDocument, { doc })
  const buffer = await renderToBuffer(el)
  return buffer
}

module.exports = {
  buildPdfBytesFromTipTapWithReactPdf,
  TipTapPdfDocument,
  tryRegisterLora,
  flattenInline,
  flatToCoalescedParts,
}
