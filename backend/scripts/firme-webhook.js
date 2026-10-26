#!/usr/bin/env node
/**
 * Alta y consulta de la suscripción de webhooks en Firme.
 * Uso (desde `backend`):
 *   node scripts/firme-webhook.js registrar <url>
 *   node scripts/firme-webhook.js listar
 *   node scripts/firme-webhook.js borrar <id>
 *   node scripts/firme-webhook.js estado <id>
 */

const EVENT_TYPES = ['document.signed', 'document.status_changed', 'signature.signed', 'signature.rejected']
const ADMIN_403 = 'Se requiere un token de administrador de la empresa.'

function sameEvents(eventTypes) {
  const current = [...(eventTypes || [])].map(String).sort()
  const expected = [...EVENT_TYPES].sort()
  return current.length === expected.length && current.every((value, index) => value === expected[index])
}

function writeLine(write, line) {
  write(`${line}\n`)
}

async function registrar({ url, client, sleep, write }) {
  let subscriptions
  try {
    subscriptions = await client.listWebhooks()
  } catch (err) {
    if (err && err.status === 403) {
      writeLine(write, ADMIN_403)
      return 1
    }
    throw err
  }

  for (const item of subscriptions) {
    if (item && item.url === url && !sameEvents(item.eventTypes)) {
      await client.deleteWebhook(item.id)
    }
  }

  let created
  try {
    created = await client.createWebhook({ url, eventTypes: EVENT_TYPES })
  } catch (err) {
    if (err && err.status === 403) {
      writeLine(write, ADMIN_403)
      return 1
    }
    throw err
  }

  const id = created && (created.id || created.subscriptionId)
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const status = await client.getWebhook(id)
    if (status && status.isConfirmed) {
      writeLine(write, `${id} ${status.status || 'confirmed'}`)
      return 0
    }
    if (attempt < 9) await sleep(3000)
  }
  writeLine(write, `${id} confirmación pendiente`)
  return 0
}

async function runWebhook({
  argv = process.argv.slice(2),
  client,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  write = (line) => process.stdout.write(line)
} = {}) {
  const [command, arg] = argv
  const firme = client || require('../lib/firmeClient').createFirmeClient()
  if (command === 'registrar') {
    if (!arg) {
      writeLine(write, 'Falta la URL.')
      return 1
    }
    return registrar({ url: arg, client: firme, sleep, write })
  }
  if (command === 'listar') {
    const items = await firme.listWebhooks()
    for (const item of items) {
      writeLine(write, `${item.id} ${item.url || ''} ${(item.eventTypes || []).join(',')}`)
    }
    return 0
  }
  if (command === 'borrar') {
    if (!arg) {
      writeLine(write, 'Falta el id.')
      return 1
    }
    await firme.deleteWebhook(arg)
    writeLine(write, `${arg} borrado`)
    return 0
  }
  if (command === 'estado') {
    if (!arg) {
      writeLine(write, 'Falta el id.')
      return 1
    }
    const status = await firme.getWebhook(arg)
    writeLine(write, `${arg} ${status && status.status ? status.status : 'unknown'}`)
    return 0
  }
  writeLine(write, 'Uso: registrar <url> | listar | borrar <id> | estado <id>')
  return 1
}

if (require.main === module) {
  runWebhook()
    .then((code) => {
      process.exit(code)
    })
    .catch((err) => {
      process.stderr.write(`${err && err.code ? err.code : 'ERROR'}\n`)
      process.exit(1)
    })
}

module.exports = { runWebhook, EVENT_TYPES }
