const test = require('node:test')
const assert = require('node:assert/strict')

const knexfileMod = require.resolve('../knexfile')
const configMod = require.resolve('../config')

function loadKnexfile(env) {
  const prev = {}
  for (const [k, v] of Object.entries(env)) {
    prev[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  delete require.cache[knexfileMod]
  delete require.cache[configMod]
  try {
    return require('../knexfile')
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    delete require.cache[knexfileMod]
    delete require.cache[configMod]
  }
}

const URL_AZURE = 'postgresql://app:clave@psql-incrementa-preprod.postgres.database.azure.com:5432/incrementa'

test('por defecto la conexión usa TLS y valida el certificado', () => {
  const kf = loadKnexfile({ DATABASE_URL: URL_AZURE, PGSSLMODE: undefined })
  assert.deepEqual(kf.connection.ssl, { rejectUnauthorized: true })
  assert.equal(kf.connection.connectionString, URL_AZURE)
})

test('PGSSLMODE=require también valida el certificado', () => {
  const kf = loadKnexfile({ DATABASE_URL: URL_AZURE, PGSSLMODE: 'require' })
  assert.deepEqual(kf.connection.ssl, { rejectUnauthorized: true })
})

test('PGSSLMODE=disable apaga TLS', () => {
  const kf = loadKnexfile({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', PGSSLMODE: 'disable' })
  assert.equal(kf.connection.ssl, false)
})

test('se quita sslmode de la URL para que no anule la validación', () => {
  const kf = loadKnexfile({ DATABASE_URL: `${URL_AZURE}?sslmode=require&application_name=api`, PGSSLMODE: undefined })
  const url = new URL(kf.connection.connectionString)
  assert.equal(url.searchParams.get('sslmode'), null)
  assert.equal(url.searchParams.get('application_name'), 'api')
  assert.equal(url.hostname, 'psql-incrementa-preprod.postgres.database.azure.com')
})

test('la clave con caracteres especiales sobrevive a quitar sslmode', () => {
  const raw = 'postgresql://app:Cl%40ve%21@psql.postgres.database.azure.com:5432/incrementa?sslmode=require'
  const kf = loadKnexfile({ DATABASE_URL: raw, PGSSLMODE: undefined })
  const url = new URL(kf.connection.connectionString)
  assert.equal(decodeURIComponent(url.password), 'Cl@ve!')
})

test('sin DATABASE_URL no falla al importar', () => {
  const kf = loadKnexfile({ DATABASE_URL: undefined, ENVIRONMENT: 'dev' })
  assert.equal(kf.connection.connectionString, undefined)
})
