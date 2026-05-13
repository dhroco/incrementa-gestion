#!/usr/bin/env node
/**
 * Elimina un usuario contador (perfil CONTADOR) y datos relacionados en Postgres/Supabase.
 *
 * Esquema relevante (migraciones del repo):
 * - `user_profile.user_id` → `auth.users.id`
 * - `accountant.id` / `company_internal_user.id` → `user_profile.id` (ON DELETE CASCADE)
 * - `accountant_company` → `accountant` (ON DELETE CASCADE)
 * - `clause.created_by|updated_by|last_edited_by` → `user_profile.id` (ON DELETE SET NULL)
 *
 * Antes de borrar `auth.users` se limpian tablas típicas del esquema `auth` que referencian
 * al usuario (sesiones, identidades, etc.), igual que en `seeds/012_reset_users_except_allowlisted_email.js`.
 *
 * Uso (desde el directorio `backend`):
 *   node scripts/delete-accountant-user.js --email=contador@ejemplo.cl --dry-run
 *   CONFIRM_DELETE_ACCOUNTANT=YES node scripts/delete-accountant-user.js --user-id=<uuid-auth>
 *
 * Identificación (una opción):
 *   --email=...           correo en auth.users (normalizado como en la app)
 *   --user-id=...         UUID de auth.users (Supabase)
 *   --accountant-id=...   UUID de public.user_profile.id del contador (= accountant.id)
 *
 * Seguridad: sin `--dry-run`, exige CONFIRM_DELETE_ACCOUNTANT=YES en el entorno.
 */

const { db } = require('../db/knex')
const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')
const { deleteAuthDependentsForUsers } = require('../lib/deleteAuthUserDependents')

const CONTADOR = 'CONTADOR'

function parseArgs(argv) {
  const out = { dryRun: false, email: null, userId: null, accountantProfileId: null }
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
    else if (key === 'accountant-id') out.accountantProfileId = val
  }
  return out
}

function isUuid(s) {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  )
}

/**
 * @param {import('knex').Knex} knex
 * @param {string} authUserId
 */
async function loadContadorContext(knex, authUserId) {
  const row = await knex('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .leftJoin('auth.users as au', 'au.id', 'up.user_id')
    .select(
      'up.id as user_profile_id',
      'up.user_id as auth_user_id',
      'p.code as profile_code',
      'au.email as email'
    )
    .where('up.user_id', authUserId)
    .first()

  if (!row) {
    return { ok: false, code: 'NO_PROFILE', message: 'No existe user_profile para ese usuario de Auth.' }
  }
  if (row.profile_code !== CONTADOR) {
    return {
      ok: false,
      code: 'NOT_CONTADOR',
      message: `El perfil es "${row.profile_code}", no CONTADOR. No se eliminó nada.`,
    }
  }

  const acCount = await knex('accountant_company').where({ accountant_id: row.user_profile_id }).count('* as c').first()
  const hasAccountantRow = await knex('accountant').select('id').where({ id: row.user_profile_id }).first()

  return {
    ok: true,
    data: {
      ...row,
      accountant_company_rows: Number(acCount?.c ?? 0),
      has_accountant_row: Boolean(hasAccountantRow),
    },
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const modes = [args.email, args.userId, args.accountantProfileId].filter(Boolean)
  if (modes.length !== 1) {
    console.error(
      'Indica exactamente uno de: --email=... | --user-id=<uuid-auth> | --accountant-id=<uuid-user_profile>'
    )
    process.exit(1)
  }

  if (args.userId && !isUuid(args.userId)) {
    console.error('--user-id debe ser un UUID válido.')
    process.exit(1)
  }
  if (args.accountantProfileId && !isUuid(args.accountantProfileId)) {
    console.error('--accountant-id debe ser un UUID válido (user_profile.id).')
    process.exit(1)
  }

  let authUserId = args.userId

  if (args.email) {
    const norm = normalizeAuthEmail(args.email)
    if (!norm) {
      console.error('Email inválido o vacío.')
      process.exit(1)
    }
    const u = await db.withSchema('auth').from('users').select('id').whereRaw('lower(trim(email)) = ?', [norm]).first()
    if (!u?.id) {
      console.error(`No hay usuario en auth.users con correo: ${norm}`)
      process.exit(1)
    }
    authUserId = u.id
  } else if (args.accountantProfileId) {
    const up = await db('user_profile').select('user_id').where({ id: args.accountantProfileId }).first()
    if (!up?.user_id) {
      console.error('No existe user_profile con ese --accountant-id.')
      process.exit(1)
    }
    authUserId = up.user_id
  }

  const ctx = await loadContadorContext(db, authUserId)
  if (!ctx.ok) {
    console.error(ctx.message)
    process.exit(1)
  }

  const d = ctx.data
  console.log('Objetivo:')
  console.log(`  auth.users.id     = ${d.auth_user_id}`)
  console.log(`  user_profile.id   = ${d.user_profile_id}`)
  console.log(`  email             = ${d.email ?? '(n/a)'}`)
  console.log(`  accountant row    = ${d.has_accountant_row ? 'sí' : 'no (inconsistencia posible)'}`)
  console.log(`  accountant_company filas = ${d.accountant_company_rows}`)

  const clauseRefs = await db('clause')
    .where(function () {
      this.where('created_by', d.user_profile_id)
        .orWhere('updated_by', d.user_profile_id)
        .orWhere('last_edited_by', d.user_profile_id)
    })
    .count('* as c')
    .first()
  console.log(`  cláusulas con autoría hacia este perfil = ${Number(clauseRefs?.c ?? 0)} (quedarán en NULL)`)

  if (args.dryRun) {
    console.log('\n[--dry-run] No se ejecutaron borrados.')
    process.exit(0)
  }

  if (process.env.CONFIRM_DELETE_ACCOUNTANT !== 'YES') {
    console.error(
      '\nPara ejecutar de verdad, establece CONFIRM_DELETE_ACCOUNTANT=YES (o usa --dry-run para simular).'
    )
    process.exit(1)
  }

  await db.transaction(async (trx) => {
    await deleteAuthDependentsForUsers(trx, [authUserId])

    const delUp = await trx('user_profile').where({ user_id: authUserId }).del()
    if (delUp !== 1) {
      throw new Error(`Se esperaba borrar 1 user_profile, filas eliminadas: ${delUp}`)
    }

    const delAuth = await trx.withSchema('auth').from('users').where({ id: authUserId }).del()
    if (delAuth !== 1) {
      throw new Error(`Se esperaba borrar 1 auth.users, filas eliminadas: ${delAuth}`)
    }
  })

  console.log('\nListo: usuario contador eliminado (user_profile + auth.users y dependencias).')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
