const test = require('node:test')
const assert = require('node:assert/strict')

const fx = require('./fixtures/plantillas-canje-pago-boost.json')
const { addBoostToClause24, personeriaEscrituraPublica, flat } = require('../utils/templateCanjePagoBoost')

const doc18 = fx.CONTRATO_0018
const text = (doc) => doc.content.map(flat)

test('boost: la cláusula 2.4 queda igual a la de CONTRATO_0002 de producción y no cambia nada más', () => {
  const result = addBoostToClause24(doc18)
  assert.equal(result.status, 'applied')
  const index = doc18.content.findIndex((p) => flat(p).startsWith('2.4 '))
  assert.deepEqual(result.content.content[index], fx.clausula_2_4_con_boost_0002)
  result.content.content.forEach((p, i) => {
    if (i !== index) assert.deepEqual(p, doc18.content[i], `párrafo ${i}`)
  })
  assert.equal(result.content.content.length, doc18.content.length)
})

test('boost: es idempotente y no modifica la entrada', () => {
  const before = structuredClone(doc18)
  const once = addBoostToClause24(doc18)
  assert.deepEqual(doc18, before)
  assert.equal(addBoostToClause24(once.content).status, 'already')
})

test('boost: sin la 2.4 esperada devuelve mismatch', () => {
  const broken = structuredClone(doc18)
  const index = broken.content.findIndex((p) => flat(p).startsWith('2.4 '))
  broken.content[index].content.pop()
  assert.equal(addBoostToClause24(broken).status, 'mismatch')
  const none = structuredClone(doc18)
  none.content.splice(index, 1)
  assert.equal(addBoostToClause24(none).status, 'mismatch')
})

test('personería: queda igual a la de CONTRATO_0004 de producción y no cambia nada más', () => {
  const result = personeriaEscrituraPublica(doc18)
  assert.equal(result.status, 'applied')
  const index = doc18.content.findIndex((p) => flat(p).startsWith('La personería de {{proveedor_rep_legal}}'))
  assert.deepEqual(result.content.content[index], fx.personeria_escritura_publica_0004)
  result.content.content.forEach((p, i) => {
    if (i !== index) assert.deepEqual(p, doc18.content[i], `párrafo ${i}`)
  })
  assert.ok(!text(result.content).join('\n').includes('{{fecha_estatuto}}'))
})

test('personería: idempotente y mismatch si no es la del certificado', () => {
  const once = personeriaEscrituraPublica(doc18)
  assert.equal(personeriaEscrituraPublica(once.content).status, 'already')
  const broken = structuredClone(doc18)
  const index = broken.content.findIndex((p) => flat(p).startsWith('La personería de {{proveedor_rep_legal}}'))
  broken.content[index].content = [{ type: 'text', text: 'La personería de {{proveedor_rep_legal}} otra cosa' }]
  assert.notEqual(personeriaEscrituraPublica(broken).status, 'applied')
})

test('0019 = 0018 con boost + personería de escritura pública: conserva canje más pago', () => {
  const con19 = personeriaEscrituraPublica(addBoostToClause24(doc18).content).content
  const full = text(con19).join('\n')
  assert.ok(full.includes('(boost)'))
  assert.ok(full.includes('{{pago_dinero_numero}}'))
  assert.ok(full.includes('{{fecha_escritura}}'))
  assert.ok(full.includes('{{nombre_notaria}}'))
})
