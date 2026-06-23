/** @typedef {'empty' | 'paragraph' | 'bullet' | 'ordered'} PasteLineKind */

/** @typedef {{ kind: PasteLineKind, depth: number, text: string, number?: number }} ClassifiedLine */

const BULLET_MARKER = /^(?:[•·◦▪●○‣⁃\-*–—])\s+(.+)$/
const ORDERED_DOT = /^(\d+)[.)]\s+(.+)$/
const ORDERED_PAREN = /^\((\d+)\)\s+(.+)$/
const ORDERED_DASH = /^(\d+)\s+[-–—]\s+(.+)$/

/**
 * Curates plain-text clipboard payloads (Word, PDF, HTML copied as text, Notepad, etc.)
 * before TipTap block insertion.
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizePastedPlainText(raw) {
  let t = String(raw ?? '')

  t = t.replace(/^\uFEFF/u, '')
  t = t.replace(/\r\n?/g, '\n')
  t = t.replace(/[\u2028\u2029]/g, '\n')
  t = t.replace(/[\v\f\u0085]/g, '\n')
  t = t.replace(/[\u200B-\u200F\u2060\uFEFF\u00AD\u034F\u061C\uFFFC\uFFFD]/gu, '')
  t = t.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/gu, ' ')
  t = t.replace(/\t/g, ' ')
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')

  t = t
    .split('\n')
    .map((line) => line.replace(/ +$/g, ''))
    .join('\n')

  t = t.replace(/\n{3,}/g, '\n\n')

  return t.trim()
}

/**
 * @param {string} line
 * @returns {ClassifiedLine}
 */
export function classifyPasteLine(line) {
  if (line === '') return { kind: 'empty', depth: 0, text: '' }

  const indentMatch = line.match(/^(\s*)([\s\S]*)$/)
  const depth = Math.min(8, Math.floor((indentMatch?.[1]?.length ?? 0) / 2))
  const body = indentMatch?.[2] ?? line

  const bullet = body.match(BULLET_MARKER)
  if (bullet) {
    return { kind: 'bullet', depth, text: bullet[1].trimEnd() }
  }

  const ordDot = body.match(ORDERED_DOT)
  if (ordDot) {
    return { kind: 'ordered', depth, text: ordDot[2].trimEnd(), number: parseInt(ordDot[1], 10) }
  }

  const ordParen = body.match(ORDERED_PAREN)
  if (ordParen) {
    return { kind: 'ordered', depth, text: ordParen[2].trimEnd(), number: parseInt(ordParen[1], 10) }
  }

  const ordDash = body.match(ORDERED_DASH)
  if (ordDash) {
    return { kind: 'ordered', depth, text: ordDash[2].trimEnd(), number: parseInt(ordDash[1], 10) }
  }

  return { kind: 'paragraph', depth: 0, text: line }
}

/**
 * @param {string} text
 * @returns {{ type: 'paragraph', content: Array<{ type: 'text', text: string }> }}
 */
function paragraphNode(text) {
  return {
    type: 'paragraph',
    content: text.length ? [{ type: 'text', text }] : [],
  }
}

/**
 * @param {Extract<ClassifiedLine, { kind: 'bullet' | 'ordered' }>[]} lines
 * @param {'bullet' | 'ordered'} kind
 */
function buildListTree(lines, kind) {
  const listType = kind === 'bullet' ? 'bulletList' : 'orderedList'
  const rootContent = []
  /** @type {Array<{ depth: number, listContent: unknown[], parentItem: { type: 'listItem', content: unknown[] }, subListNode: { type: string, content: unknown[] } }>} */
  const stack = []

  let startNumber = 1
  if (kind === 'ordered' && typeof lines[0]?.number === 'number' && lines[0].number !== 1) {
    startNumber = lines[0].number
  }

  for (const line of lines) {
    while (stack.length > 0 && stack[stack.length - 1].depth >= line.depth) {
      const leaving = stack.pop()
      if (leaving && leaving.subListNode.content.length > 0) {
        leaving.parentItem.content.push(leaving.subListNode)
      }
    }

    const parentContent = stack.length > 0 ? stack[stack.length - 1].subListNode.content : rootContent
    const listItem = {
      type: 'listItem',
      content: [paragraphNode(line.text)],
    }
    parentContent.push(listItem)

    stack.push({
      depth: line.depth,
      listContent: parentContent,
      parentItem: listItem,
      subListNode: { type: listType, content: [] },
    })
  }

  while (stack.length > 0) {
    const leaving = stack.pop()
    if (leaving && leaving.subListNode.content.length > 0) {
      leaving.parentItem.content.push(leaving.subListNode)
    }
  }

  /** @type {{ type: string, content: unknown[], attrs?: { start: number } }} */
  const node = { type: listType, content: rootContent }
  if (kind === 'ordered' && startNumber !== 1) {
    node.attrs = { start: startNumber }
  }
  return node
}

/**
 * @param {string[]} lines
 * @returns {unknown[]}
 */
export function blocksFromSanitizedLines(lines) {
  /** @type {unknown[]} */
  const blocks = []
  /** @type {Extract<ClassifiedLine, { kind: 'bullet' | 'ordered' }>[]} */
  let pendingList = []
  /** @type {'bullet' | 'ordered' | null} */
  let pendingKind = null

  function flushList() {
    if (pendingList.length === 0 || !pendingKind) return
    blocks.push(buildListTree(pendingList, pendingKind))
    pendingList = []
    pendingKind = null
  }

  for (const line of lines) {
    const cls = classifyPasteLine(line)

    if (cls.kind === 'empty') {
      flushList()
      blocks.push(paragraphNode(''))
      continue
    }

    if (cls.kind === 'paragraph') {
      flushList()
      blocks.push(paragraphNode(cls.text))
      continue
    }

    if (pendingKind != null && pendingKind !== cls.kind) {
      flushList()
    }

    pendingKind = cls.kind
    pendingList.push(cls)
  }

  flushList()
  return blocks
}

/**
 * @param {unknown} raw
 * @returns {unknown[]}
 */
export function blocksFromSanitizedPaste(raw) {
  const normalized = sanitizePastedPlainText(raw)
  if (!normalized) return []
  return blocksFromSanitizedLines(normalized.split('\n'))
}

/** @deprecated Use blocksFromSanitizedPaste — kept for existing imports/tests. */
export function paragraphsFromSanitizedPaste(raw) {
  return blocksFromSanitizedPaste(raw)
}
