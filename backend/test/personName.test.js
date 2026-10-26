const test = require('node:test')
const assert = require('node:assert/strict')
const { composeFullName, splitFullName } = require('../utils/personName')

function normalized(value) {
  return String(value).trim().replace(/\s+/g, ' ')
}

const table = [
  {
    input: 'María José Pérez Soto',
    firstNames: 'María José',
    lastName: 'Pérez',
    maternalLastName: 'Soto'
  },
  {
    input: 'Juan Pérez',
    firstNames: 'Juan',
    lastName: 'Pérez',
    maternalLastName: ''
  },
  {
    input: 'Ana de la Fuente Soto',
    firstNames: 'Ana',
    lastName: 'de la Fuente',
    maternalLastName: 'Soto'
  },
  {
    input: 'Juan de la Cruz Pérez Soto',
    firstNames: 'Juan de la Cruz',
    lastName: 'Pérez',
    maternalLastName: 'Soto'
  },
  {
    input: 'Madonna',
    firstNames: 'Madonna',
    lastName: '',
    maternalLastName: ''
  },
  {
    input: '  Pedro   Soto  Ruiz  ',
    firstNames: 'Pedro',
    lastName: 'Soto',
    maternalLastName: 'Ruiz'
  }
]

test('splitFullName assigns the recorte table and preserves accents', () => {
  for (const row of table) {
    assert.deepEqual(splitFullName(row.input), {
      firstNames: row.firstNames,
      lastName: row.lastName,
      maternalLastName: row.maternalLastName
    })
  }
  assert.deepEqual(splitFullName('Ana DE LA Fuente Soto'), {
    firstNames: 'Ana',
    lastName: 'DE LA Fuente',
    maternalLastName: 'Soto'
  })
  assert.deepEqual(splitFullName('Juan de'), {
    firstNames: 'Juan',
    lastName: 'de',
    maternalLastName: ''
  })
})

test('empty and non-string input returns three empty strings', () => {
  for (const value of ['', '   ', null, undefined, 0, {}]) {
    assert.deepEqual(splitFullName(value), {
      firstNames: '',
      lastName: '',
      maternalLastName: ''
    })
  }
})

test('composeFullName(splitFullName(x)) equals x with whitespace normalized', () => {
  for (const row of table) {
    assert.equal(composeFullName(splitFullName(row.input)), normalized(row.input))
  }
})

test('composeFullName trims parts and omits empty ones', () => {
  assert.equal(
    composeFullName({ firstNames: '  Ana ', lastName: ' ', maternalLastName: ' Soto ' }),
    'Ana Soto'
  )
  assert.equal(
    composeFullName({ firstNames: null, lastName: '', maternalLastName: undefined }),
    ''
  )
})
