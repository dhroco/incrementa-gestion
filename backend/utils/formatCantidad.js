const { cardinal } = require('./formatDuracion')

const CANTIDAD_MESSAGE_SUFFIX = 'debe ser un número entero mayor que cero (por ejemplo: 30).'

/**
 * Lee una cantidad escrita como entero positivo ("30"). No admite decimales,
 * signos ni unidades: la unidad ("días", "horas", "meses") va fija en la plantilla.
 * @param {unknown} value
 * @returns {{ ok: true, value: number } | { ok: false }}
 */
function parseCantidad(value) {
  const text = String(value ?? '').trim()
  if (!/^\d{1,4}$/.test(text)) return { ok: false }
  const n = parseInt(text, 10)
  if (n < 1) return { ok: false }
  return { ok: true, value: n }
}

/**
 * Cantidad en palabras y cifra, sin unidad: "30" -> "treinta (30)".
 * `fem` concuerda el número con un sustantivo femenino ("una (1)", "veintiuna (21)").
 * Si el valor no es una cantidad válida, se devuelve tal cual.
 * @param {unknown} value
 * @param {{ fem?: boolean }} [options]
 * @returns {string}
 */
function formatCantidad(value, { fem = false } = {}) {
  const parsed = parseCantidad(value)
  if (!parsed.ok) return String(value ?? '').trim()
  return `${cardinal(parsed.value, fem)} (${parsed.value})`
}

module.exports = { parseCantidad, formatCantidad, CANTIDAD_MESSAGE_SUFFIX }
