const { cardinal } = require('./formatDuracion')

// Formatos de publicación ofrecidos para la variable `formato_reel`.
// El label es lo que ve el usuario; en el contrato se escribe en minúsculas,
// en singular o plural según `cantidad_reels`.
const FORMATOS = [
  { label: 'Reel', singular: 'reel', plural: 'reels' },
  { label: 'Video', singular: 'video', plural: 'videos' },
  { label: 'Historia', singular: 'historia', plural: 'historias' },
  { label: 'Story', singular: 'story', plural: 'stories' },
  { label: 'Post', singular: 'post', plural: 'posts' },
  { label: 'Carrusel', singular: 'carrusel', plural: 'carruseles' },
  { label: 'Short', singular: 'short', plural: 'shorts' }
]

const FORMATO_REEL_OPTIONS = FORMATOS.map((f) => f.label)

// Clave de búsqueda: minúsculas, sin tildes y sin la `s` final, para que
// "Vídeos", "videos" y "Video" caigan todos en la misma entrada.
function lookupKey(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/s$/u, '')
}

function findFormato(raw) {
  const key = lookupKey(raw)
  if (key === '') return undefined
  return FORMATOS.find((f) => lookupKey(f.singular) === key)
}

// Plural genérico en español para un formato fuera del catálogo: las voces
// terminadas en vocal toman "s" y las terminadas en consonante "es".
function pluralGenerico(word) {
  if (/s$/u.test(word)) return word
  if (/[aeiouáéíóú]$/u.test(word)) return `${word}s`
  if (/ión$/u.test(word)) return `${word.replace(/ión$/u, 'iones')}`
  return `${word}es`
}

/**
 * Cantidad de reels en palabras y cifras, sin sustantivo: 1 → "un (1)", 3 → "tres (3)".
 * El sustantivo lo aporta `formato_reel`, que se escribe a continuación en la cláusula 2.3.
 * @param {unknown} value
 * @returns {string}
 */
function formatCantidadReels(value) {
  const raw = String(value ?? '').trim()
  if (raw === '') return raw
  const m = raw.replace(/\./gu, '').match(/^(\d{1,4})$/u)
  if (!m) return raw
  const n = parseInt(m[1], 10)
  return `${cardinal(n, false)} (${n})`
}

/**
 * Formato de publicación en minúsculas, concordando en número con la cantidad:
 * ("Reel", 1) → "reel"; ("Video", 3) → "videos". Si la cantidad no es un entero
 * válido se asume singular. Un formato fuera del catálogo se escribe en minúsculas
 * y se pluraliza con la regla genérica del español.
 * @param {unknown} formato
 * @param {unknown} cantidad — entero, o el valor crudo de `cantidad_reels`
 * @returns {string}
 */
function formatFormatoReel(formato, cantidad) {
  const raw = String(formato ?? '').trim()
  if (raw === '') return raw

  const n =
    typeof cantidad === 'number' && Number.isInteger(cantidad)
      ? cantidad
      : parseInt(String(cantidad ?? '').replace(/\./gu, ''), 10)
  const plural = Number.isFinite(n) && n !== 1

  const known = findFormato(raw)
  if (known) return plural ? known.plural : known.singular

  const lower = raw.toLowerCase()
  return plural ? pluralGenerico(lower) : lower
}

module.exports = { formatCantidadReels, formatFormatoReel, FORMATO_REEL_OPTIONS }
