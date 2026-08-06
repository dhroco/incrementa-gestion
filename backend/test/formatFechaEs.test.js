const test = require('node:test')
const assert = require('node:assert/strict')
const { formatFechaEs } = require('../utils/formatFechaEs')

// --- string ISO (override del formulario o del MCP) ---

test('formatFechaEs formats an ISO date string', () => {
  assert.equal(formatFechaEs('2024-03-15'), '15 de marzo de 2024')
})

test('formatFechaEs formats an ISO datetime string', () => {
  assert.equal(formatFechaEs('2024-03-15T00:00:00.000Z'), '15 de marzo de 2024')
})

test('formatFechaEs does not pad the day', () => {
  assert.equal(formatFechaEs('2024-03-05'), '5 de marzo de 2024')
})

test('formatFechaEs covers every month name', () => {
  const esperados = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]
  esperados.forEach((mes, i) => {
    const mm = String(i + 1).padStart(2, '0')
    assert.equal(formatFechaEs(`2024-${mm}-01`), `1 de ${mes} de 2024`)
  })
})

// --- Date (lo que pg devuelve para columnas `date`) ---

test('formatFechaEs formats a Date instance', () => {
  // Medianoche local, que es como pg construye el valor de una columna `date`.
  assert.equal(formatFechaEs(new Date(2024, 2, 15)), '15 de marzo de 2024')
})

test('formatFechaEs uses local components so the day does not shift', () => {
  // En zonas al oeste de Greenwich, toISOString() sobre esta fecha daría el día
  // siguiente en UTC; el resultado debe seguir siendo el día local.
  const d = new Date(2024, 11, 31)
  assert.equal(formatFechaEs(d), '31 de diciembre de 2024')
})

test('formatFechaEs returns empty string for an invalid Date', () => {
  assert.equal(formatFechaEs(new Date('no es fecha')), '')
})

// --- valores que no son fecha ---

test('formatFechaEs leaves an already formatted value untouched', () => {
  assert.equal(formatFechaEs('15 de marzo de 2024'), '15 de marzo de 2024')
})

test('formatFechaEs leaves a non-ISO string untouched', () => {
  assert.equal(formatFechaEs('15/03/2024'), '15/03/2024')
})

test('formatFechaEs leaves an out-of-range ISO value untouched', () => {
  assert.equal(formatFechaEs('2024-13-40'), '2024-13-40')
})

test('formatFechaEs returns empty string for null and undefined', () => {
  assert.equal(formatFechaEs(null), '')
  assert.equal(formatFechaEs(undefined), '')
  assert.equal(formatFechaEs(''), '')
})
