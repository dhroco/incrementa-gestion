const UNITS = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const TEENS = [
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve'
]
const TENS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const VEINTI = [
  '',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve'
]
const HUNDREDS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos'
]

/**
 * @param {number} n 0–99
 * @param {boolean} [useUn]
 * @returns {string}
 */
function under100(n, useUn = false) {
  if (n === 0) return ''
  if (n < 10) return useUn && n === 1 ? 'un' : UNITS[n]
  if (n < 20) return TEENS[n - 10]
  if (n < 30) return useUn && n === 21 ? 'veintiún' : VEINTI[n - 20]
  const ten = Math.floor(n / 10)
  const unit = n % 10
  if (unit === 0) return TENS[ten]
  const unitWord = useUn && unit === 1 ? 'un' : UNITS[unit]
  return `${TENS[ten]} y ${unitWord}`
}

/**
 * @param {number} n 0–999
 * @param {boolean} [useUn]
 * @returns {string}
 */
function under1000(n, useUn = false) {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const hundred = Math.floor(n / 100)
  const rest = n % 100
  const parts = []
  if (hundred > 0) {
    if (hundred === 1 && rest === 0) parts.push('cien')
    else if (hundred === 1) parts.push('ciento')
    else parts.push(HUNDREDS[hundred])
  }
  const restWords = under100(rest, useUn && rest === 1)
  if (restWords) parts.push(restWords)
  return parts.join(' ')
}

/**
 * Converts a non-negative integer to words in Spanish (masculine, no currency).
 * @param {number} n
 * @returns {string}
 */
function numberToWords(n) {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
    throw new Error('n must be a non-negative integer')
  }
  if (n === 0) return 'cero'

  const parts = []
  const millions = Math.floor(n / 1_000_000)
  const afterMillions = n % 1_000_000
  const thousands = Math.floor(afterMillions / 1_000)
  const remainder = afterMillions % 1_000

  if (millions > 0) {
    if (millions === 1) parts.push('un millón')
    else parts.push(`${under1000(millions)} millones`)
  }
  if (thousands > 0) {
    if (thousands === 1) parts.push('mil')
    else parts.push(`${under1000(thousands, true)} mil`)
  }
  if (remainder > 0) {
    parts.push(under1000(remainder))
  }

  return parts.join(' ')
}

module.exports = { numberToWords }
