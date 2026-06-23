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
  const keys = placeholderKeysInText('Hola {{proveedor_nombre}} — {{proveedor_rut}} y {{proveedor_nombre}}')
  assert.deepEqual(keys.sort(), ['proveedor_nombre', 'proveedor_rut'].sort())
})

test('buildSubstitutionMap maps persona natural supplier', () => {
  const supplier = {
    supplier_type: 'persona_natural',
    full_name: 'Ana Pérez',
    rut_display: '12345678-5',
    address: 'Calle 1'
  }
  const company = { business_name: 'ACME', rut_body: '76543210', rut_dv: 'K' }
  const map = buildSubstitutionMap(supplier, company, null, { custom_key: 'valor' })
  assert.equal(map.proveedor_nombre, 'Ana Pérez')
  assert.equal(map.proveedor_rut, '12345678-5')
  assert.equal(map.proveedor_red_social, '')
  assert.equal(map.custom_key, 'valor')
})

test('buildSubstitutionMap maps company commercial name', () => {
  const supplier = { supplier_type: 'persona_natural', full_name: 'Ana', rut_display: '1-9' }
  const company = { business_name: 'Dynamics Corp. SpA', short_name: 'Dynamics' }
  const map = buildSubstitutionMap(supplier, company, null)
  assert.equal(map.company_legal_name, 'Dynamics Corp. SpA')
  assert.equal(map.company_nombre_comercial, 'Dynamics')
})

test('buildSubstitutionMap maps empresa supplier', () => {
  const supplier = {
    supplier_type: 'empresa',
    razon_social: 'Servicios TI SpA',
    rut_empresa_display: '76543210-K',
    direccion_empresa: 'Av. Central 100',
    giro: 'Servicios TI',
    nombre_rep_legal: 'Luis Díaz',
    rut_rep_legal_display: '11111111-1'
  }
  const company = { business_name: 'ACME' }
  const map = buildSubstitutionMap(supplier, company, null)
  assert.equal(map.proveedor_nombre, 'Servicios TI SpA')
  assert.equal(map.proveedor_giro, 'Servicios TI')
  assert.equal(map.lugar_contrato, '')
})

test('buildSubstitutionMap maps client fields', () => {
  const supplier = { supplier_type: 'persona_natural', full_name: 'Ana', rut_display: '1-9' }
  const company = { business_name: 'ACME' }
  const client = { name: 'Cliente X', brand: 'Marca Y', brand_account: '@marca' }
  const map = buildSubstitutionMap(supplier, company, client)
  assert.equal(map.client_name, 'Cliente X')
  assert.equal(map.client_brand, 'Marca Y')
  assert.equal(map.client_brand_account, '@marca')
  assert.equal(map.client_product_campaign, '')
})

test('buildSubstitutionMap resolves client_product_campaign via override only', () => {
  const supplier = { supplier_type: 'persona_natural', full_name: 'Ana', rut_display: '1-9' }
  const company = { business_name: 'ACME' }
  const client = {
    name: 'Cliente X',
    brand: 'Marca Y',
    product_campaigns: [{ name: 'Verano 2026' }]
  }
  const withoutOverride = buildSubstitutionMap(supplier, company, client)
  assert.equal(withoutOverride.client_product_campaign, '')

  const withOverride = buildSubstitutionMap(supplier, company, client, {
    client_product_campaign: 'Verano 2026'
  })
  assert.equal(withOverride.client_product_campaign, 'Verano 2026')
})

test('applySubstitutions replaces known placeholders', () => {
  const text = 'Sr/a {{proveedor_nombre}}, empresa {{company_legal_name}}.'
  const map = { proveedor_nombre: 'Luis', company_legal_name: 'SpA' }
  assert.equal(applySubstitutions(text, map), 'Sr/a Luis, empresa SpA.')
})

test('unresolvedKeys lists empty values', () => {
  const text = '{{proveedor_nombre}} {{missing_x}}'
  const map = { proveedor_nombre: 'Zoe', missing_x: '' }
  assert.deepEqual(unresolvedKeys(text, map), ['missing_x'])
})

test('unresolvedKeys lists empty contract variables as missing', () => {
  const text = '{{lugar_contrato}} {{precio_numero}}'
  const supplier = { supplier_type: 'persona_natural', full_name: 'Ana', rut_display: '1-9' }
  const company = { business_name: 'ACME' }
  const map = buildSubstitutionMap(supplier, company, null)
  assert.deepEqual(unresolvedKeys(text, map).sort(), ['lugar_contrato', 'precio_numero'].sort())
})

test('buildSubstitutionMap applies contract overrides', () => {
  const supplier = { supplier_type: 'persona_natural', full_name: 'Ana', rut_display: '1-9' }
  const company = { business_name: 'ACME' }
  const map = buildSubstitutionMap(supplier, company, null, {
    lugar_contrato: 'Santiago',
    precio_numero: '1.500.000',
    precio_texto: 'un millón quinientos mil'
  })
  assert.equal(map.lugar_contrato, 'Santiago')
  assert.equal(map.precio_numero, '1.500.000')
  assert.equal(map.precio_texto, 'un millón quinientos mil')
})

test('applySubstitutionsToTipTapDoc replaces variable nodes and brace tokens', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'variable', attrs: { variableId: 'proveedor_nombre' } },
          { type: 'text', text: ' — {{company_legal_name}}' }
        ]
      }
    ]
  }
  const map = { proveedor_nombre: 'Ana', company_legal_name: 'ACME' }
  const out = applySubstitutionsToTipTapDoc(doc, map)
  const p = out.content[0]
  assert.equal(p.content[0].type, 'text')
  assert.equal(p.content[0].text, 'Ana')
  assert.equal(p.content[1].text, ' — ACME')
})

test('applySubstitutionsToTipTapDoc uppercases variable with uppercase attr', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'variable', attrs: { variableId: 'proveedor_nombre', uppercase: true } }]
      }
    ]
  }
  const out = applySubstitutionsToTipTapDoc(doc, { proveedor_nombre: 'Ana Pérez' })
  assert.equal(out.content[0].content[0].type, 'text')
  assert.equal(out.content[0].content[0].text, 'ANA PÉREZ')
})

test('applySubstitutionsToTipTapDoc uppercases marked text including substituted tokens', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'hola {{proveedor_nombre}}',
            marks: [{ type: 'uppercase' }]
          }
        ]
      }
    ]
  }
  const out = applySubstitutionsToTipTapDoc(doc, { proveedor_nombre: 'Ana' })
  assert.equal(out.content[0].content[0].text, 'HOLA ANA')
})

test('applySubstitutionsToTipTapDoc preserves bold and uppercase on variable attrs', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'variable',
            attrs: { variableId: 'proveedor_nombre', uppercase: true, bold: true }
          }
        ]
      }
    ]
  }
  const out = applySubstitutionsToTipTapDoc(doc, { proveedor_nombre: 'Ana Pérez' })
  const textNode = out.content[0].content[0]
  assert.equal(textNode.type, 'text')
  assert.equal(textNode.text, 'ANA PÉREZ')
  assert.deepEqual(textNode.marks, [{ type: 'bold' }, { type: 'uppercase' }])
})

test('applySubstitutionsToTipTapDoc preserves bold and uppercase marks on variable node', () => {
  const doc = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'variable',
            attrs: { variableId: 'proveedor_nombre', label: 'Nombre', group: 'proveedor' },
            marks: [{ type: 'bold' }, { type: 'uppercase' }]
          }
        ]
      }
    ]
  }
  const out = applySubstitutionsToTipTapDoc(doc, { proveedor_nombre: 'Ana Pérez' })
  const textNode = out.content[0].content[0]
  assert.equal(textNode.text, 'ANA PÉREZ')
  assert.deepEqual(textNode.marks, [{ type: 'bold' }, { type: 'uppercase' }])
})
