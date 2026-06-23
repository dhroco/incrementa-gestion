const test = require('node:test')
const assert = require('node:assert/strict')
const { numberToWords } = require('../utils/numberToWords')

test('numberToWords(0) returns cero', () => {
  assert.equal(numberToWords(0), 'cero')
})

test('numberToWords(21) returns veintiuno', () => {
  assert.equal(numberToWords(21), 'veintiuno')
})

test('numberToWords(100) returns cien', () => {
  assert.equal(numberToWords(100), 'cien')
})

test('numberToWords(101) returns ciento uno', () => {
  assert.equal(numberToWords(101), 'ciento uno')
})

test('numberToWords(1500000) returns un millón quinientos mil', () => {
  assert.equal(numberToWords(1_500_000), 'un millón quinientos mil')
})

test('numberToWords(2350000) returns dos millones trescientos cincuenta mil', () => {
  assert.equal(numberToWords(2_350_000), 'dos millones trescientos cincuenta mil')
})
