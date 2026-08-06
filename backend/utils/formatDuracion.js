const { numberToWords } = require('./numberToWords')

// Unidades soportadas: singular canónico, plural y género.
const UNITS = [
  { test: /^d[ií]as?$/, singular: 'día', plural: 'días', fem: false },
  { test: /^mes(es)?$/, singular: 'mes', plural: 'meses', fem: false },
  { test: /^a[ñn]os?$/, singular: 'año', plural: 'años', fem: false },
  { test: /^semanas?$/, singular: 'semana', plural: 'semanas', fem: true }
]
const UNIT_MES = UNITS[1] // meses
const UNIT_DIA = UNITS[0] // días

// Cardinal en palabras con apocopación ("uno"->"un"/"veintiún"/"...y un"; fem "una").
function cardinal(n, fem) {
  const w = numberToWords(n) // masculino base: "uno","veintiuno","treinta y uno","doce","cien"
  return fem
    ? w.replace(/veintiuno\b/, 'veintiuna').replace(/uno$/, 'una')
    : w.replace(/veintiuno\b/, 'veintiún').replace(/uno$/, 'un')
}

/**
 * Formatea una cantidad "<palabras> (<n>) <unidad>". Si el usuario no indica unidad,
 * se usa `defaultUnit`. Si el valor no empieza con número, se devuelve tal cual.
 * @param {unknown} value
 * @param {{singular:string,plural:string,fem:boolean}} defaultUnit
 * @returns {string}
 */
function format(value, defaultUnit) {
  const raw = String(value ?? '').trim()
  if (raw === '') return raw
  const m = raw.match(/^(\d{1,4})\s*(.*)$/)
  if (!m) return raw
  const n = parseInt(m[1], 10)
  const unitRaw = m[2].trim().toLowerCase().replace(/\./g, '')
  const unit = unitRaw === '' ? defaultUnit : UNITS.find((u) => u.test.test(unitRaw))
  if (!unit) return raw // unidad desconocida → no arriesgar, dejar como está
  const unitWord = n === 1 ? unit.singular : unit.plural
  return `${cardinal(n, unit.fem)} (${n}) ${unitWord}`
}

// Duración de ejecución: default meses. Ej "1 mes"->"un (1) mes", "12"->"doce (12) meses".
function formatDuracion(value) {
  return format(value, UNIT_MES)
}

// Días de cesión: default días. Ej "30"->"treinta (30) días", "1"->"un (1) día".
function formatDias(value) {
  return format(value, UNIT_DIA)
}

module.exports = { formatDuracion, formatDias, cardinal }
