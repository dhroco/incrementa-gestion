const test = require('node:test')
const assert = require('node:assert/strict')

const { numberToWords } = require('../utils/numberToWords')
const { formatCantidad } = require('../utils/formatCantidad')

const CASES = [
  [20, 'veinte'],
  [120, 'ciento veinte'],
  [1020, 'mil veinte'],
  [2020, 'dos mil veinte'],
  [20000, 'veinte mil'],
  [21000, 'veintiún mil'],
  [31000, 'treinta y un mil'],
  [41000, 'cuarenta y un mil'],
  [101000, 'ciento un mil'],
  [120000, 'ciento veinte mil'],
  [199999, 'ciento noventa y nueve mil novecientos noventa y nueve'],
  [520000, 'quinientos veinte mil'],
  [521300, 'quinientos veintiún mil trescientos'],
  [1000000, 'un millón'],
  [1001000, 'un millón mil'],
  [1100000, 'un millón cien mil'],
  [2520040, 'dos millones quinientos veinte mil cuarenta'],
  [21000000, 'veintiún millones'],
  [31000000, 'treinta y un millones'],
  [101000000, 'ciento un millones'],
  [74990, 'setenta y cuatro mil novecientos noventa'],
  [500000, 'quinientos mil'],
  [560000, 'quinientos sesenta mil']
]

test('los montos con «20» o terminados en 1 en los miles se escriben completos', () => {
  for (const [n, words] of CASES) assert.equal(numberToWords(n), words, String(n))
})

test('ningún número del 0 al 2.100.000 deja palabras vacías ni espacios sobrantes', () => {
  for (let n = 0; n <= 2_100_000; n++) {
    const words = numberToWords(n)
    assert.ok(words.length > 0, String(n))
    assert.equal(words, words.trim().replace(/\s+/g, ' '), String(n))
  }
})

test('toda cifra «20» de un grupo aparece como veinte en las palabras', () => {
  for (let n = 1; n <= 999_999; n++) {
    const hundreds = n % 100
    const thousandsTail = Math.floor(n / 1000) % 100
    if (hundreds === 20) assert.match(numberToWords(n), /veinte$/, String(n))
    if (thousandsTail === 20) assert.match(numberToWords(n), /veinte mil/, String(n))
  }
})

test('los valores que ya funcionaban no cambian', () => {
  assert.equal(numberToWords(0), 'cero')
  assert.equal(numberToWords(21), 'veintiuno')
  assert.equal(numberToWords(100), 'cien')
  assert.equal(numberToWords(101), 'ciento uno')
  assert.equal(numberToWords(1_500_000), 'un millón quinientos mil')
  assert.equal(numberToWords(2_350_000), 'dos millones trescientos cincuenta mil')
})

test('las variables de cantidad también escriben el 20', () => {
  assert.equal(formatCantidad(20), 'veinte (20)')
  assert.equal(formatCantidad(20, { fem: true }), 'veinte (20)')
  assert.equal(formatCantidad(120), 'ciento veinte (120)')
})
