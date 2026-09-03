const test = require('node:test')
const assert = require('node:assert/strict')
const {
  wrapSignatureBlocksInDoc,
  tryMatchCanonicalGroup,
  isUnderscoreParagraph,
} = require('../utils/wrapTemplateSignatureBlocks')

function para(text) {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function varPara(variableId) {
  return {
    type: 'paragraph',
    content: [{ type: 'variable', attrs: { variableId } }],
  }
}

test('tryMatchCanonicalGroup wraps underscore + company rep 1 + optional p.p.', () => {
  const blocks = [para('________________________'), varPara('company_legal_rep1_name'), para('p.p. EMPRESA SpA')]
  const match = tryMatchCanonicalGroup(blocks, 0)
  assert.ok(match)
  assert.equal(match.consumed, 3)
  assert.deepEqual(match.attrs, { party: 'company', repIndex: 1 })
})

test('wrapSignatureBlocksInDoc wraps supplier block', () => {
  const doc = {
    type: 'doc',
    content: [para('Intro'), para('________________________'), varPara('proveedor_nombre')],
  }
  const result = wrapSignatureBlocksInDoc(doc)
  assert.equal(result.changed, true)
  assert.equal(result.wrapped, 1)
  assert.equal(result.doc.content[1].type, 'signatureBlock')
  assert.deepEqual(result.doc.content[1].attrs, { party: 'supplier', repIndex: null })
})

test('wrapSignatureBlocksInDoc is idempotent on already wrapped blocks', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'signatureBlock',
        attrs: { party: 'company', repIndex: 1 },
        content: [para('________________________'), varPara('company_legal_rep1_name')],
      },
    ],
  }
  const result = wrapSignatureBlocksInDoc(doc)
  assert.equal(result.changed, false)
  assert.equal(result.wrapped, 0)
  assert.equal(result.doc.content[0].type, 'signatureBlock')
})

test('wrapSignatureBlocksInDoc reports non-canonical signature variable', () => {
  const doc = {
    type: 'doc',
    content: [varPara('proveedor_nombre')],
  }
  const result = wrapSignatureBlocksInDoc(doc)
  assert.equal(result.changed, false)
  assert.ok(result.issues.length >= 1)
})

test('isUnderscoreParagraph accepts underscore-only lines', () => {
  assert.equal(isUnderscoreParagraph(para('________________________')), true)
  assert.equal(isUnderscoreParagraph(para('Ana Usuario')), false)
})

test('second run does not duplicate signatureBlock', () => {
  const doc = {
    type: 'doc',
    content: [para('________________________'), varPara('company_legal_rep2_name')],
  }
  const first = wrapSignatureBlocksInDoc(doc)
  const second = wrapSignatureBlocksInDoc(first.doc)
  assert.equal(first.changed, true)
  assert.equal(second.changed, false)
  assert.equal(second.doc.content.filter((n) => n.type === 'signatureBlock').length, 1)
})
