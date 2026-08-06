const test = require('node:test')
const assert = require('node:assert/strict')
const {
  formatCantidadReels,
  formatFormatoReel,
  FORMATO_REEL_OPTIONS
} = require('../utils/formatReels')

// --- formatCantidadReels: palabras + cifra, sin sustantivo ---

test('formatCantidadReels(1) returns un (1)', () => {
  assert.equal(formatCantidadReels('1'), 'un (1)')
})

test('formatCantidadReels(3) returns tres (3)', () => {
  assert.equal(formatCantidadReels('3'), 'tres (3)')
})

test('formatCantidadReels(21) apocopates to veintiún (21)', () => {
  assert.equal(formatCantidadReels('21'), 'veintiún (21)')
})

test('formatCantidadReels accepts thousands separator', () => {
  assert.equal(formatCantidadReels('1.000'), 'mil (1000)')
})

test('formatCantidadReels leaves empty value untouched', () => {
  assert.equal(formatCantidadReels(''), '')
  assert.equal(formatCantidadReels(null), '')
})

test('formatCantidadReels leaves non-numeric value untouched', () => {
  assert.equal(formatCantidadReels('varios'), 'varios')
})

// --- formatFormatoReel: minúsculas y concordancia de número ---

test('formatFormatoReel("Reel", 1) returns reel', () => {
  assert.equal(formatFormatoReel('Reel', 1), 'reel')
})

test('formatFormatoReel("Video", 3) returns videos', () => {
  assert.equal(formatFormatoReel('Video', 3), 'videos')
})

test('formatFormatoReel("Reel", 2) pluralizes as reels, not reeles', () => {
  assert.equal(formatFormatoReel('Reel', 2), 'reels')
})

test('formatFormatoReel accepts the raw string cantidad', () => {
  assert.equal(formatFormatoReel('Video', '3'), 'videos')
  assert.equal(formatFormatoReel('Video', '1'), 'video')
})

test('formatFormatoReel matches ignoring case, accents and trailing s', () => {
  assert.equal(formatFormatoReel('vídeos', 3), 'videos')
  assert.equal(formatFormatoReel('REELS', 1), 'reel')
})

test('formatFormatoReel pluralizes catalog irregulars', () => {
  assert.equal(formatFormatoReel('Story', 3), 'stories')
  assert.equal(formatFormatoReel('Carrusel', 3), 'carruseles')
  assert.equal(formatFormatoReel('Historia', 3), 'historias')
})

test('formatFormatoReel falls back to generic Spanish plural for unknown formats', () => {
  assert.equal(formatFormatoReel('Pieza', 3), 'piezas')
  assert.equal(formatFormatoReel('Publicación', 3), 'publicaciones')
  assert.equal(formatFormatoReel('Pieza', 1), 'pieza')
})

test('formatFormatoReel assumes singular when cantidad is missing', () => {
  assert.equal(formatFormatoReel('Video', null), 'video')
  assert.equal(formatFormatoReel('Video', ''), 'video')
})

test('formatFormatoReel leaves empty value untouched', () => {
  assert.equal(formatFormatoReel('', 3), '')
  assert.equal(formatFormatoReel(null, 3), '')
})

test('FORMATO_REEL_OPTIONS exposes the select catalog', () => {
  assert.ok(FORMATO_REEL_OPTIONS.includes('Reel'))
  assert.ok(FORMATO_REEL_OPTIONS.includes('Video'))
})

// --- Los dos casos textuales pedidos para la cláusula 2.3 ---

test('clause 2.3 renders "un (1) reel"', () => {
  const cantidad = formatCantidadReels('1')
  const formato = formatFormatoReel('Reel', '1')
  assert.equal(
    `la generación y publicación de ${cantidad} ${formato} en`,
    'la generación y publicación de un (1) reel en'
  )
})

test('clause 2.3 renders "tres (3) videos"', () => {
  const cantidad = formatCantidadReels('3')
  const formato = formatFormatoReel('Video', '3')
  assert.equal(
    `la generación y publicación de ${cantidad} ${formato} en`,
    'la generación y publicación de tres (3) videos en'
  )
})
