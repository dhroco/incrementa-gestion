const test = require('node:test')
const assert = require('node:assert/strict')
const {
  buildSubstitutionMap,
  applySubstitutions,
  applySubstitutionsToTipTapDoc,
  unresolvedKeys,
  placeholderKeysInText
} = require('../services/documentBuilderVariableContext')

test('placeholderKeysInText collects unique keys', () => {
  const keys = placeholderKeysInText('Hola {{worker_name}} — {{worker_rut}} y {{worker_name}}')
  assert.deepEqual(keys.sort(), ['worker_name', 'worker_rut'].sort())
})

test('buildSubstitutionMap merges overrides', () => {
  const employee = { full_name: 'Ana María Pérez', rut: '1-9', position_name: 'Dev', work_schedule_name: 'Completa' }
  const company = { business_name: 'ACME', rut_body: '76543210', rut_dv: 'K' }
  const map = buildSubstitutionMap(employee, company, { custom_key: 'valor' })
  assert.equal(map.worker_name, 'Ana')
  assert.ok(map.worker_lastname.includes('Pérez'))
  assert.equal(map.custom_key, 'valor')
})

test('applySubstitutions replaces known placeholders', () => {
  const text = 'Sr/a {{worker_name}}, empresa {{company_legal_name}}.'
  const map = { worker_name: 'Luis', company_legal_name: 'SpA' }
  assert.equal(applySubstitutions(text, map), 'Sr/a Luis, empresa SpA.')
})

test('unresolvedKeys lists empty values', () => {
  const text = '{{worker_name}} {{missing_x}}'
  const map = { worker_name: 'Zoe', missing_x: '' }
  assert.deepEqual(unresolvedKeys(text, map), ['missing_x'])
})

test('applySubstitutionsToTipTapDoc replaces variable nodes and brace tokens', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'variable', attrs: { variableId: 'worker_name' } },
          { type: 'text', text: ' — {{company_legal_name}}' }
        ]
      }
    ]
  }
  const map = { worker_name: 'Ana', company_legal_name: 'ACME' }
  const out = applySubstitutionsToTipTapDoc(doc, map)
  const p = out.content[0]
  assert.equal(p.content[0].type, 'text')
  assert.equal(p.content[0].text, 'Ana')
  assert.equal(p.content[1].text, ' — ACME')
})
