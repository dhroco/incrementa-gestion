const test = require('node:test')
const assert = require('node:assert/strict')
const { buildSignedAttachmentName } = require('../utils/signedAttachmentName')

test('nombre con producto, proveedor, mes y año de la firma', () => {
  assert.equal(
    buildSignedAttachmentName({
      productName: 'Solbiot',
      supplierName: 'Valentina Vera',
      signedAt: new Date('2026-09-15T15:00:00Z')
    }),
    'Contrato servicios Influencer Solbiot Valentina Vera - septiembre 2026 - firmado.pdf'
  )
})

test('el mes se calcula en hora de Santiago, no en UTC', () => {
  // 1-oct 01:30 UTC sigue siendo 30-sep en Chile (UTC-3/-4)
  assert.match(
    buildSignedAttachmentName({ supplierName: 'A', signedAt: new Date('2026-10-01T01:30:00Z') }),
    /- septiembre 2026 - firmado\.pdf$/
  )
  // 1-ene 02:00 UTC sigue siendo 31-dic del año anterior
  assert.match(
    buildSignedAttachmentName({ supplierName: 'A', signedAt: new Date('2027-01-01T02:00:00Z') }),
    /- diciembre 2026 - firmado\.pdf$/
  )
})

test('sin producto se omite; sin nada queda el encabezado', () => {
  const signedAt = new Date('2026-11-23T13:00:00Z')
  assert.equal(
    buildSignedAttachmentName({ supplierName: 'Valentina Vera', signedAt }),
    'Contrato servicios Influencer Valentina Vera - noviembre 2026 - firmado.pdf'
  )
  assert.equal(
    buildSignedAttachmentName({ signedAt }),
    'Contrato servicios Influencer - noviembre 2026 - firmado.pdf'
  )
})

test('quita caracteres inválidos para nombres de archivo y espacios repetidos', () => {
  const name = buildSignedAttachmentName({
    productName: 'Sol/biot: "Pro"  ',
    supplierName: 'A\\B*C?',
    signedAt: new Date('2026-11-23T13:00:00Z')
  })
  assert.equal(name, 'Contrato servicios Influencer Sol biot Pro A B C - noviembre 2026 - firmado.pdf')
})

test('fecha inválida o ausente no rompe', () => {
  assert.match(buildSignedAttachmentName({ supplierName: 'A', signedAt: 'x' }), /- firmado\.pdf$/)
})
