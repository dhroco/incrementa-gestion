#!/usr/bin/env node
/**
 * Barrido de firmas pendientes en Firme.
 * Uso (desde `backend`): node scripts/firme-barrido.js
 */

const { isFirmeConfigured } = require('../lib/firmeClient')

const OMITIDO = '{ "ok": true, "omitido": "Firme no está configurado" }\n'

async function defaultSweep() {
  const { db } = require('../db/knex')
  const { createFirmeSigningService } = require('../services/firmeSigningService')
  return createFirmeSigningService({ db }).sweepPending()
}

async function defaultDestroy() {
  const { db } = require('../db/knex')
  await db.destroy()
}

async function runBarrido({
  configured = isFirmeConfigured,
  sweepPending = defaultSweep,
  destroy = defaultDestroy,
  stdout = process.stdout,
  stderr = process.stderr
} = {}) {
  let code = 0
  try {
    if (!configured()) {
      stdout.write(OMITIDO)
      return 0
    }
    const summary = await sweepPending()
    stdout.write(`${JSON.stringify(summary)}\n`)
  } catch (err) {
    stderr.write(`${err && err.code ? err.code : 'ERROR'}\n`)
    code = 1
  } finally {
    try {
      await destroy()
    } catch (err) {
      stderr.write(`${err && err.code ? err.code : 'ERROR'}\n`)
      code = 1
    }
  }
  return code
}

if (require.main === module) {
  runBarrido().then((code) => {
    process.exit(code)
  })
}

module.exports = { runBarrido }
