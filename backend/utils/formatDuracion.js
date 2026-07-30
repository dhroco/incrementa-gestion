const { numberToWords } = require('./numberToWords')

// Unidades soportadas: singular canónico, plural y género.
const UNITS = [
  { test: /^d[ií]as?$/, singular: 'día', plural: 'días', fem: false },
  { test: /^mes(es)?$/, singular: 'mes', plural: 'meses', fem: false },
  { test: /^a[ñn]os?$/, singular: 'año', plural: 'años', fem: false },
  { test: /^semanas?$/, singular: 'semana', plural: 'semanas', fem: true }
]
const DEFAULT_UNIT = UNITS[1] // meses

// Cardinal en palabras con apocopación ("uno"->"un"/"veintiún"/"...y un"; fem "una").
function cardinal(n, fem) {
  const w = numberToWords(n) // masculino base: "uno","veintiuno","treinta y uno","doce","cien"
  return fem
    ? w.replace(/veintiuno\b/, 'veintiuna').replace(/uno$/, 'una')
    : w.replace(/veintiuno\b/, 'veintiún').replace(/uno$/, 'un')
}

/**
 * Formatea una duración ingresada por el usuario a la forma legal
 * "<palabras> (<n>) <unidad>". Si no hay unidad, se asume meses.
 * Ej: "1 mes"->"un (1) mes", "30 dias"->"treinta (30) días", "12"->"doce (12) meses".
 * Si el valor no empieza con un número, se devuelve tal cual (ya viene formateado).
 * @param {unknown} value
 * @returns {string}
 */
function formatDuracion(value) {
  const raw = String(value ?? '').trim()
  if (raw === '') return raw
  const m = raw.match(/^(\d{1,4})\s*(.*)$/)
  if (!m) return raw
  const n = parseInt(m[1], 10)
  const unitRaw = m[2].trim().toLowerCase().replace(/\./g, '')
  const unit = unitRaw === '' ? DEFAULT_UNIT : UNITS.find((u) => u.test.test(unitRaw))
  if (!unit) return raw // unidad desconocida → no arriesgar, dejar como está
  const unitWord = n === 1 ? unit.singular : unit.plural
  return `${cardinal(n, unit.fem)} (${n}) ${unitWord}`
}

module.exports = { formatDuracion }
