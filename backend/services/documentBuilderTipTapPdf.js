const fs = require('fs')
const path = require('path')

/**
 * Standard 14 fonts encode text as WinAnsi; TAB (U+0009) and most C0 controls are not encodable.
 * Custom fonts tolerate more glyphs; we still normalize whitespace and strip controls.
 * @param {string} s
 * @returns {string}
 */
function sanitizeTextForWinAnsi(s) {
  return String(s ?? '')
    .replace(/\t/g, ' ')
    .replace(/\v|\f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
}

/**
 * TipTap / paste often inserts TAB, NBSP, or ZWSP *inside* a word. Our tokenizer uses
 * `\S+\s*` so those characters split one word into two tokens; justified lines then add
 * extra space between tokens → visible "gratifi cación". Remove joiners only between
 * letters/digits/marks; leave e.g. "Sr.\u00a0Juan" (punctuation before NBSP) intact.
 * @param {string} s
 * @returns {string}
 */
function normalizeTextForPdfTokenization(s) {
  let t = String(s ?? '')
  t = t.replace(/\u00ad/gu, '')
  t = t.replace(/\u200b|\u200c|\u200d/gu, '')
  // Only between letters (not digit–letter): avoids gluing "Col1" + tab + "Col2" into "Col1Col2".
  t = t.replace(/(?<=\p{L}\p{M}*)[\t\u00a0\u1680\u2000-\u200a](?=\p{L}\p{M}*)/gu, '')
  t = t.replace(/\t|\v|\f/gu, ' ')
  return t
}

/**
 * @param {number} lineIdx
 * @param {number} lineCount
 * @param {number} lw
 * @param {number} maxW
 */
function shouldJustifyLine(lineIdx, lineCount, lw, maxW) {
  const slack = maxW - lw
  if (lineIdx === lineCount - 1 && slack > 2) return false
  return true
}

/**
 * Whether justified extra spacing may be inserted after token `i` (between i and i+1).
 * @param {{ text: string }[]} toks
 * @param {number} i
 */
function justifyGapAfterToken(toks, i) {
  if (i < 0 || i >= toks.length - 1) return false
  const a = sanitizeTextForWinAnsi(toks[i].text)
  const b = sanitizeTextForWinAnsi(toks[i + 1].text)
  return /\s$/u.test(a) || /^\s/u.test(b)
}

function countJustifyGaps(toks) {
  let n = 0
  for (let i = 0; i < toks.length - 1; i += 1) {
    if (justifyGapAfterToken(toks, i)) n += 1
  }
  return n
}

/**
 * TipTap often splits one word into consecutive `text` nodes with different marks (e.g. "gratif" normal + "cación" bold).
 * If we keep them separate, wrapping/justify still sees two tokens. Merge when join is clearly inside a word.
 * @param {{ text?: string }} a
 * @param {{ text?: string }} b
 */
function shouldMergePdfSplitWord(a, b) {
  const sa = sanitizeTextForWinAnsi(String(a.text ?? ''))
  const sb = sanitizeTextForWinAnsi(String(b.text ?? ''))
  if (/\s$/u.test(sa) || /^\s/u.test(sb)) return false
  if (!/\p{L}\p{M}*$/u.test(sa) || !/^\p{L}\p{M}*/u.test(sb)) return false
  const ta = sa.replace(/\s+$/u, '')
  const rest = sb.replace(/^\s+/u, '')
  // Avoid "para" + "llevar" style pairs; allow "grat" + "ificación" (short prefix + long tail).
  if (ta.length < 5 && rest.length < 7) return false
  if (rest.length < 3) return false
  return true
}

/**
 * Merge inline pieces for PDF: same marks as before, plus split-word joins (marks OR-combined).
 * @param {Array<{ break?: boolean, text?: string, bold?: boolean, italic?: boolean, underline?: boolean }>} pieces
 */
function mergeAdjacentPiecesForPdf(pieces) {
  const merged = []
  for (const p of pieces) {
    if (p.break) {
      merged.push({ break: true })
      continue
    }
    const last = merged[merged.length - 1]
    if (!last || last.break) {
      merged.push({
        text: p.text,
        bold: Boolean(p.bold),
        italic: Boolean(p.italic),
        underline: Boolean(p.underline)
      })
      continue
    }
    const sameMarks =
      Boolean(last.bold) === Boolean(p.bold) &&
      Boolean(last.italic) === Boolean(p.italic) &&
      Boolean(last.underline) === Boolean(p.underline)
    if (sameMarks) {
      last.text = String(last.text ?? '') + String(p.text ?? '')
      continue
    }
    if (shouldMergePdfSplitWord(last, p)) {
      last.text = String(last.text ?? '') + String(p.text ?? '')
      last.bold = Boolean(last.bold || p.bold)
      last.italic = Boolean(last.italic || p.italic)
      last.underline = Boolean(last.underline || p.underline)
      continue
    }
    merged.push({
      text: p.text,
      bold: Boolean(p.bold),
      italic: Boolean(p.italic),
      underline: Boolean(p.underline)
    })
  }
  return merged
}

/**
 * TipTap JSON → PDF (pdf-lib) with basic rich text: headings, paragraphs, lists,
 * bold/italic/underline, hardBreak, paragraph/heading textAlign (left/center/right/justify).
 * Body uses Lora (same family as clause editor); embeds WOFF from @fontsource/lora + @pdf-lib/fontkit.
 * @param {unknown} doc
 * @returns {Promise<Uint8Array>}
 */
async function buildPdfBytesFromTipTapDoc(doc) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')

  const pdfDoc = await PDFDocument.create()

  async function loadFonts() {
    const loraDir = path.join(__dirname, '..', 'node_modules', '@fontsource', 'lora', 'files')
    const files = {
      regular: 'lora-latin-400-normal.woff',
      bold: 'lora-latin-700-normal.woff',
      oblique: 'lora-latin-400-italic.woff',
      boldOblique: 'lora-latin-700-italic.woff'
    }
    try {
      const fkMod = require('@pdf-lib/fontkit')
      const fontkit = fkMod.default || fkMod
      pdfDoc.registerFontkit(fontkit)
      const read = (name) => {
        const p = path.join(loraDir, name)
        return fs.readFileSync(p)
      }
      const [regular, bold, oblique, boldOblique] = await Promise.all([
        pdfDoc.embedFont(read(files.regular)),
        pdfDoc.embedFont(read(files.bold)),
        pdfDoc.embedFont(read(files.oblique)),
        pdfDoc.embedFont(read(files.boldOblique))
      ])
      return { regular, bold, oblique, boldOblique }
    } catch (e) {
      console.warn('[documentBuilderTipTapPdf] Lora embed failed, using Helvetica:', e?.message || e)
      return {
        regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
        bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        oblique: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
        boldOblique: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)
      }
    }
  }

  const fonts = await loadFonts()

  const margin = 48
  const pageWidth = 595.28
  const pageHeight = 841.89
  const contentWidth = pageWidth - 2 * margin
  const bodySize = 11
  const lineFactor = 1.35
  const color = rgb(0, 0, 0)

  function pickFont(bold, italic) {
    if (bold && italic) return fonts.boldOblique
    if (bold) return fonts.bold
    if (italic) return fonts.oblique
    return fonts.regular
  }

  function parseMarks(marks) {
    let bold = false
    let italic = false
    let underline = false
    if (!Array.isArray(marks)) return { bold, italic, underline }
    for (const m of marks) {
      const t = m?.type
      if (t === 'bold') bold = true
      if (t === 'italic') italic = true
      if (t === 'underline') underline = true
    }
    return { bold, italic, underline }
  }

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
          if (parts[i].length) out.push({ text: parts[i], ...st })
        }
      } else if (n.type === 'hardBreak') {
        out.push({ break: true })
      } else if (n.type === 'variable') {
        const vid = typeof n.attrs?.variableId === 'string' ? n.attrs.variableId.trim() : ''
        out.push({ text: vid ? `{{${vid}}}` : '', bold: false, italic: false, underline: false })
      } else if (Array.isArray(n.content)) {
        out.push(...flattenInline(n.content))
      }
    }
    return out
  }

  function splitVisualLines(flatPieces) {
    /** @type {typeof flatPieces[]} */
    const lines = [[]]
    for (const f of flatPieces) {
      if (f.break) {
        lines.push([])
      } else if (f.text) {
        lines[lines.length - 1].push(f)
      }
    }
    return lines
  }

  function tokenizeWords(pieces, size) {
    const tokens = []
    const merged = mergeAdjacentPiecesForPdf(pieces)
    for (const p of merged) {
      if (p.break) {
        tokens.push({ break: true })
        continue
      }
      const re = /\S+\s*/gu
      let m
      const t = p.text
      while ((m = re.exec(t))) {
        tokens.push({
          text: m[0],
          bold: p.bold,
          italic: p.italic,
          underline: p.underline,
          size
        })
      }
    }
    return tokens
  }

  function measureToken(tok) {
    if (tok.break) return 0
    const t = sanitizeTextForWinAnsi(tok.text)
    const font = pickFont(tok.bold, tok.italic)
    return font.widthOfTextAtSize(t, tok.size)
  }

  function wrapTokensToLines(tokens, maxWidth) {
    /** @type {typeof tokens[]} */
    const lines = []
    let cur = []
    let curW = 0

    function flush() {
      if (cur.length) {
        lines.push(cur)
        cur = []
        curW = 0
      }
    }

    for (const tok of tokens) {
      if (tok.break) {
        flush()
        lines.push([])
        continue
      }
      const w = measureToken(tok)
      if (curW + w <= maxWidth || cur.length === 0) {
        cur.push(tok)
        curW += w
      } else {
        flush()
        cur.push(tok)
        curW = w
      }
    }
    flush()
    return lines
  }

  function lineWidth(lineToks) {
    return lineToks.reduce((s, t) => s + (t.break ? 0 : measureToken(t)), 0)
  }

  function drawTokensLine(page, lineToks, x0, y) {
    let x = x0
    for (const tok of lineToks) {
      if (tok.break) continue
      const font = pickFont(tok.bold, tok.italic)
      const t = sanitizeTextForWinAnsi(tok.text)
      page.drawText(t, { x, y, size: tok.size, font, color })
      const w = font.widthOfTextAtSize(t, tok.size)
      if (tok.underline) {
        page.drawLine({
          start: { x, y: y - 1 },
          end: { x: x + w, y: y - 1 },
          thickness: 0.5,
          color
        })
      }
      x += w
    }
  }

  /** @param {ReturnType<typeof wrapTokensToLines>[0]} lineToks */
  function drawJustifiedLine(page, lineToks, xBase, y, targetWidth) {
    const toks = lineToks.filter((t) => !t.break)
    if (toks.length === 0) return
    if (toks.length === 1) {
      drawTokensLine(page, toks, xBase, y)
      return
    }
    const widths = toks.map((t) => measureToken(t))
    const sum = widths.reduce((a, b) => a + b, 0)
    const slack = targetWidth - sum
    const gaps = countJustifyGaps(toks)
    const extra = gaps > 0 && slack > 0 ? slack / gaps : 0
    let x = xBase
    for (let i = 0; i < toks.length; i += 1) {
      const tok = toks[i]
      const font = pickFont(tok.bold, tok.italic)
      const t = sanitizeTextForWinAnsi(tok.text)
      page.drawText(t, { x, y, size: tok.size, font, color })
      const w = font.widthOfTextAtSize(t, tok.size)
      if (tok.underline) {
        page.drawLine({
          start: { x, y: y - 1 },
          end: { x: x + w, y: y - 1 },
          thickness: 0.5,
          color
        })
      }
      x += w
      if (i < toks.length - 1 && justifyGapAfterToken(toks, i)) x += extra
    }
  }

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  function newPage() {
    page = pdfDoc.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }

  function needSpace(h) {
    if (y - h < margin) {
      newPage()
    }
  }

  function blockAlign(attrs) {
    const a = attrs && typeof attrs.textAlign === 'string' ? attrs.textAlign.trim().toLowerCase() : 'left'
    if (a === 'center' || a === 'right' || a === 'justify' || a === 'justified') return a === 'justified' ? 'justify' : a
    return 'left'
  }

  function drawAlignedLine(lineToks, align, xBase, effWidth, lineIdx, lineCount) {
    const lw = lineWidth(lineToks)
    const justify =
      align === 'justify' && shouldJustifyLine(lineIdx, lineCount, lw, effWidth) && lineToks.filter((t) => !t.break).length > 0
    if (justify) {
      drawJustifiedLine(page, lineToks, xBase, y, effWidth)
      return
    }
    let x0 = xBase
    if (align === 'center') x0 = xBase + (effWidth - lw) / 2
    if (align === 'right') x0 = xBase + (effWidth - lw)
    drawTokensLine(page, lineToks, x0, y)
  }

  function renderParagraphLike(inlineNodes, attrs, fontSize) {
    const align = blockAlign(attrs)
    const flat = flattenInline(inlineNodes)
    const visualLines = splitVisualLines(flat)
    const lh = fontSize * lineFactor

    for (const vl of visualLines) {
      if (vl.length === 0) {
        needSpace(lh)
        y -= lh
        continue
      }
      const tokens = tokenizeWords(vl, fontSize)
      const wrapped = wrapTokensToLines(tokens, contentWidth)
      const n = wrapped.length
      for (let i = 0; i < n; i += 1) {
        const lineToks = wrapped[i]
        if (!lineToks.length) continue
        needSpace(lh)
        drawAlignedLine(lineToks, align, margin, contentWidth, i, n)
        y -= lh
      }
    }
  }

  function headingSize(level) {
    if (level <= 1) return 16
    if (level === 2) return 14
    return 12
  }

  function renderBlocks(blocks, extraIndent) {
    function renderParagraph(node, listIndent) {
      const fs = bodySize
      const flat = flattenInline(node.content)
      const visualLines = splitVisualLines(flat)
      const lh = fs * lineFactor
      const align = blockAlign(node.attrs)
      const effWidth = contentWidth - listIndent
      const xBase = margin + listIndent

      for (const vl of visualLines) {
        if (vl.length === 0) {
          needSpace(lh)
          y -= lh
          continue
        }
        const tokens = tokenizeWords(vl, fs)
        const wrapped = wrapTokensToLines(tokens, effWidth)
        const n = wrapped.length
        for (let i = 0; i < n; i += 1) {
          const lineToks = wrapped[i]
          if (!lineToks.length) continue
          needSpace(lh)
          drawAlignedLine(lineToks, align, xBase, effWidth, i, n)
          y -= lh
        }
      }
    }

    function renderHeading(node) {
      const level = Number(node.attrs?.level) || 1
      const fs = headingSize(level)
      y -= 2
      renderParagraphLike(node.content || [], node.attrs, fs)
      y -= 2
    }

    function renderListItem(item, listIndent, marker) {
      const lh = bodySize * lineFactor
      const markerStr = String(marker)
      const markerFont = fonts.bold
      const mw = markerFont.widthOfTextAtSize(markerStr, bodySize)
      const textStart = margin + listIndent + mw + 6
      const wrapW = pageWidth - textStart - margin
      const first = (item.content || [])[0]
      if (first && first.type === 'paragraph') {
        const align = blockAlign(first.attrs)
        const flat = flattenInline(first.content)
        const tokens = tokenizeWords(flat, bodySize)
        const wrapped = wrapTokensToLines(tokens, wrapW)
        const n = wrapped.length
        for (let li = 0; li < n; li += 1) {
          const lineToks = wrapped[li]
          if (!lineToks.length) continue
          needSpace(lh)
          if (li === 0) {
            page.drawText(markerStr, {
              x: margin + listIndent,
              y,
              size: bodySize,
              font: markerFont,
              color
            })
          }
          drawAlignedLine(lineToks, align, textStart, wrapW, li, n)
          y -= lh
        }
        for (let i = 1; i < (item.content || []).length; i += 1) {
          renderBlock(item.content[i], listIndent + 18)
        }
      } else {
        needSpace(lh)
        page.drawText(markerStr, { x: margin + listIndent, y, size: bodySize, font: markerFont, color })
        y -= lh
        for (const ch of item.content || []) {
          renderBlock(ch, listIndent + 18)
        }
      }
    }

    function renderOrderedList(node, listIndent) {
      const start = Number(node.attrs?.start) || 1
      let idx = start
      for (const item of node.content || []) {
        if (item.type === 'listItem') {
          renderListItem(item, listIndent, `${idx}. `)
          idx += 1
        }
      }
    }

    function renderBulletList(node, listIndent) {
      for (const item of node.content || []) {
        if (item.type === 'listItem') {
          renderListItem(item, listIndent, '• ')
        }
      }
    }

    function renderBlock(node, listIndent) {
      if (!node || typeof node !== 'object') return
      const t = node.type
      if (t === 'paragraph') {
        renderParagraph(node, listIndent || 0)
        y -= 2
      } else if (t === 'heading') {
        renderHeading(node)
      } else if (t === 'bulletList') {
        renderBulletList(node, listIndent || 0)
        y -= 2
      } else if (t === 'orderedList') {
        renderOrderedList(node, listIndent || 0)
        y -= 2
      } else if (t === 'blockquote') {
        renderBlocks(node.content || [], (extraIndent || 0) + 12)
        y -= 2
      } else if (t === 'horizontalRule') {
        needSpace(8)
        y -= 4
        page.drawLine({
          start: { x: margin, y },
          end: { x: pageWidth - margin, y },
          thickness: 0.75,
          color
        })
        y -= 8
      } else if (Array.isArray(node.content)) {
        renderBlocks(node.content, extraIndent)
      } else if (t === 'text' && typeof node.text === 'string') {
        renderParagraphLike([node], {}, bodySize)
        y -= 2
      }
    }

    for (const b of blocks || []) {
      renderBlock(b, 0)
    }
  }

  const root = doc && typeof doc === 'object' && doc.type === 'doc' ? doc : { type: 'doc', content: [] }
  renderBlocks(root.content || [], 0)

  return pdfDoc.save()
}

module.exports = {
  buildPdfBytesFromTipTapDoc,
  sanitizeTextForWinAnsi,
  shouldJustifyLine,
  normalizeTextForPdfTokenization,
  justifyGapAfterToken,
  countJustifyGaps,
  shouldMergePdfSplitWord,
  mergeAdjacentPiecesForPdf
}
