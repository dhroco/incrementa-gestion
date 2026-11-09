const test = require('node:test')
const assert = require('node:assert/strict')

const { buildSignedGcsPath } = require('../services/contractSigningService')

const BASE = { companyId: 'c1', supplierId: 's1', templateCode: 'SERV', docId: 'd1' }

test('la ruta del contrato firmado usa la fecha inyectada (mes de Santiago), no el reloj real', () => {
  assert.equal(
    buildSignedGcsPath({ ...BASE, date: new Date('2026-10-26T15:00:00.000Z') }),
    'contratos-firmados/c1/s1/SERV/2026/10/d1_firmado.pdf'
  )
  assert.equal(
    buildSignedGcsPath({ ...BASE, date: new Date('2027-01-15T12:00:00.000Z') }),
    'contratos-firmados/c1/s1/SERV/2027/01/d1_firmado.pdf'
  )
})

test('el cambio de mes se mide en hora de Santiago, no en UTC', () => {
  // 1-nov 02:30 UTC todavía es 31-oct en Santiago (UTC-3 en horario de verano chileno).
  assert.equal(
    buildSignedGcsPath({ ...BASE, date: new Date('2026-11-01T02:30:00.000Z') }),
    'contratos-firmados/c1/s1/SERV/2026/10/d1_firmado.pdf'
  )
  assert.equal(
    buildSignedGcsPath({ ...BASE, date: new Date('2026-11-01T04:00:00.000Z') }),
    'contratos-firmados/c1/s1/SERV/2026/11/d1_firmado.pdf'
  )
})

test('sin fecha inyectada usa la fecha real (como en producción)', () => {
  const path = buildSignedGcsPath(BASE)
  const year = String(new Date().getUTCFullYear())
  assert.match(path, new RegExp(`^contratos-firmados/c1/s1/SERV/(${year}|${Number(year) - 1}|${Number(year) + 1})/\\d{2}/d1_firmado\\.pdf$`))
})
