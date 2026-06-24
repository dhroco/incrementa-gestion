#!/usr/bin/env node
/**
 * Elimina un usuario de aplicación con perfil ADMINISTRADOR_PLATAFORMA (solo Postgres).
 * No modifica identidades en Microsoft Entra; gestionar el tenant aparte si corresponde.
 *
 * Uso (desde el directorio `backend`):
 *   node scripts/delete-app-user.js --email=admin@ejemplo.cl --dry-run
 *   CONFIRM_DELETE_APP_USER=YES node scripts/delete-app-user.js --user-id=<uuid-entra-oid>
 */

const { db } = require('../db/knex')
const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')

const ALLOWED_PROFILE_CODES = new Set(['ADMINISTRADOR_PLATAFORMA'])

function parseArgs(argv) {
  const out = { dryRun: false, email: null, userId: null, userProfileId: null }
  for (const raw of argv.slice(2)) {
    if (raw === '--dry-run') {
      out.dryRun = true
      continue
    }
    const m = raw.match(/^--([^=]+)=(.*)$/)
    if (!m) continue
    const key = m[1]
    const val = m[2]
    if (key === 'email') out.email = val
    else if (key === 'user-id') out.userId = val
    else if (key === 'user-profile-id') out.userProfileId = val
  }
  return out
}

function isUuid(s) {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  )
}

async function loadAppUserContext(knex, { userId, userProfileId, email }) {
  let query = knex('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .select(
      'up.id as user_profile_id',
      'up.user_id as entra_user_id',
      'up.email as email',
      'p.code as profile_code',
      'p.label as profile_label'
    )

  if (userProfileId) {
    query = query.where('up.id', userProfileId)
  } else if (userId) {
    query = query.where('up.user_id', userId)
  } else if (email) {
    query = query.where('up.email', email)
  } else {
    return { ok: false, code: 'INVALID', message: 'Falta identificador de usuario.' }
  }

  const row = await query.first()

  if (!row) {
    return { ok: false, code: 'NO_PROFILE', message: 'No existe user_profile para ese usuario.' }
  }

  if (!ALLOWED_PROFILE_CODES.has(row.profile_code)) {
    return {
      ok: false,
      code: 'PROFILE_NOT_ALLOWED',
      message: `El perfil es "${row.profile_code}". Este script solo admite: ${[...ALLOWED_PROFILE_CODES].join(', ')}.`
    }
  }

  return {
    ok: true,
    data: row
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const modes = [args.email, args.userId, args.userProfileId].filter(Boolean)
  if (modes.length !== 1) {
    console.error(
      'Indica exactamente uno de: --email=... | --user-id=<uuid-entra-oid> | --user-profile-id=<uuid-user_profile>'
    )
    process.exit(1)
  }

  if (args.userId && !isUuid(args.userId)) {
    console.error('--user-id debe ser un UUID válido.')
    process.exit(1)
  }
  if (args.userProfileId && !isUuid(args.userProfileId)) {
    console.error('--user-profile-id debe ser un UUID válido (public.user_profile.id).')
    process.exit(1)
  }

  let lookup = {}
  if (args.email) {
    const norm = normalizeAuthEmail(args.email)
    if (!norm) {
      console.error('Email inválido o vacío.')
      process.exit(1)
    }
    lookup = { email: norm }
  } else if (args.userId) {
    lookup = { userId: args.userId }
  } else {
    lookup = { userProfileId: args.userProfileId }
  }

  const ctx = await loadAppUserContext(db, lookup)
  if (!ctx.ok) {
    console.error(ctx.message)
    process.exit(1)
  }

  const d = ctx.data
  console.log('Objetivo:')
  console.log(`  perfil             = ${d.profile_code} (${d.profile_label ?? ''})`)
  console.log(`  Entra user id      = ${d.entra_user_id}`)
  console.log(`  email              = ${d.email ?? ''}`)
  console.log(`  user_profile.id    = ${d.user_profile_id}`)
  if (args.dryRun) {
    console.log('\n[--dry-run] No se ejecutaron borrados.')
    process.exit(0)
  }

  if (process.env.CONFIRM_DELETE_APP_USER !== 'YES') {
    console.error('\nPara ejecutar de verdad, establece CONFIRM_DELETE_APP_USER=YES (o usa --dry-run para simular).')
    process.exit(1)
  }

  await db.transaction(async (trx) => {
    const delUp = await trx('user_profile').where({ id: d.user_profile_id }).del()
    if (delUp !== 1) {
      throw new Error(`Se esperaba borrar 1 user_profile, filas eliminadas: ${delUp}`)
    }
  })

  console.log('\nListo: registro de aplicación eliminado (user_profile). La identidad en Microsoft Entra no fue modificada.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
