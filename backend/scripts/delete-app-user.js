#!/usr/bin/env node
/**
 * Elimina un usuario de aplicación (perfil interno soportado) y datos relacionados en Postgres/Supabase.
 *
 * Cubre:
 * - **Administrador de plataforma** (`ADMINISTRADOR_PLATAFORMA`): solo `user_profile` + Auth (sin `accountant` ni `company_internal_user`).
 * - **Usuario empresa administrador** (`USUARIO_EMPRESA_ADMINISTRADOR`): `user_profile` + `company_internal_user` (CASCADE al borrar `user_profile`).
 * - **Contador** (`CONTADOR`): `user_profile` + `accountant` + `accountant_company` (misma mecánica que `delete-accountant-user.js`).
 *
 * Esquema relevante (migraciones del repo):
 * - `user_profile.user_id` → `auth.users.id`
 * - `accountant.id` / `company_internal_user.id` → `user_profile.id` (ON DELETE CASCADE)
 * - `accountant_company` → `accountant` (ON DELETE CASCADE)
 * - `clause.created_by|updated_by|last_edited_by` → `user_profile.id` (ON DELETE SET NULL)
 *
 * Antes de borrar `auth.users` se limpian tablas típicas del esquema `auth` que referencian al usuario
 * (`lib/deleteAuthUserDependents.js`).
 *
 * Uso (desde el directorio `backend`):
 *   node scripts/delete-app-user.js --email=admin@ejemplo.cl --dry-run
 *   CONFIRM_DELETE_APP_USER=YES node scripts/delete-app-user.js --user-id=<uuid-auth>
 *
 * Identificación (exactamente una opción):
 *   --email=...              correo en auth.users (normalizado como en la app)
 *   --user-id=...            UUID de auth.users (Supabase)
 *   --user-profile-id=...  UUID de public.user_profile.id
 *
 * Seguridad: sin `--dry-run`, exige `CONFIRM_DELETE_APP_USER=YES` en el entorno.
 *
 * Nota: Para contadores también existe `scripts/delete-accountant-user.js` (solo CONTADOR + `CONFIRM_DELETE_ACCOUNTANT`).
 *        Este script es el equivalente general para los perfiles de aplicación listados arriba.
 */

const { db } = require('../db/knex')
const { normalizeAuthEmail } = require('../lib/normalizeAuthEmail')
const { deleteAuthDependentsForUsers } = require('../lib/deleteAuthUserDependents')

/** Perfiles que este script puede eliminar (datos de negocio en tablas públicas conocidas). */
const ALLOWED_PROFILE_CODES = new Set(['ADMINISTRADOR_PLATAFORMA', 'USUARIO_EMPRESA_ADMINISTRADOR', 'CONTADOR'])

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

/**
 * @param {import('knex').Knex} knex
 * @param {string} authUserId
 */
async function loadAppUserContext(knex, authUserId) {
  const row = await knex('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .leftJoin('auth.users as au', 'au.id', 'up.user_id')
    .select(
      'up.id as user_profile_id',
      'up.user_id as auth_user_id',
      'p.code as profile_code',
      'p.label as profile_label',
      'au.email as email'
    )
    .where('up.user_id', authUserId)
    .first()

  if (!row) {
    return { ok: false, code: 'NO_PROFILE', message: 'No existe user_profile para ese usuario de Auth.' }
  }

  if (!ALLOWED_PROFILE_CODES.has(row.profile_code)) {
    return {
      ok: false,
      code: 'PROFILE_NOT_ALLOWED',
      message: `El perfil es "${row.profile_code}". Este script solo admite: ${[...ALLOWED_PROFILE_CODES].join(', ')}.`,
    }
  }

  const userProfileId = row.user_profile_id

  const acCount = await knex('accountant_company').where({ accountant_id: userProfileId }).count('* as c').first()
  const hasAccountantRow = await knex('accountant').select('id').where({ id: userProfileId }).first()
  const hasCompanyInternal = await knex('company_internal_user').select('id', 'company_id').where({ id: userProfileId }).first()

  const clauseRefs = await knex('clause')
    .where(function () {
      this.where('created_by', userProfileId)
        .orWhere('updated_by', userProfileId)
        .orWhere('last_edited_by', userProfileId)
    })
    .count('* as c')
    .first()

  return {
    ok: true,
    data: {
      ...row,
      accountant_company_rows: Number(acCount?.c ?? 0),
      has_accountant_row: Boolean(hasAccountantRow),
      company_internal_user: hasCompanyInternal
        ? { company_id: hasCompanyInternal.company_id }
        : null,
      clause_refs: Number(clauseRefs?.c ?? 0),
    },
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const modes = [args.email, args.userId, args.userProfileId].filter(Boolean)
  if (modes.length !== 1) {
    console.error(
      'Indica exactamente uno de: --email=... | --user-id=<uuid-auth> | --user-profile-id=<uuid-user_profile>'
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
  } else if (args.userProfileId) {
    const up = await db('user_profile').select('user_id').where({ id: args.userProfileId }).first()
    if (!up?.user_id) {
      console.error('No existe user_profile con ese --user-profile-id.')
      process.exit(1)
    }
    authUserId = up.user_id
  }

  const ctx = await loadAppUserContext(db, authUserId)
  if (!ctx.ok) {
    console.error(ctx.message)
    process.exit(1)
  }

  const d = ctx.data
  console.log('Objetivo:')
  console.log(`  perfil             = ${d.profile_code} (${d.profile_label ?? ''})`)
  console.log(`  auth.users.id      = ${d.auth_user_id}`)
  console.log(`  user_profile.id    = ${d.user_profile_id}`)
  console.log(`  email              = ${d.email ?? '(n/a)'}`)
  console.log(`  fila accountant    = ${d.has_accountant_row ? 'sí' : 'no'}`)
  console.log(`  accountant_company filas = ${d.accountant_company_rows}`)
  console.log(
    `  company_internal_user = ${d.company_internal_user ? `sí (company_id=${d.company_internal_user.company_id})` : 'no'}`
  )
  console.log(`  cláusulas con autoría hacia este perfil = ${d.clause_refs} (quedarán en NULL por FK)`)

  if (args.dryRun) {
    console.log('\n[--dry-run] No se ejecutaron borrados.')
    process.exit(0)
  }

  if (process.env.CONFIRM_DELETE_APP_USER !== 'YES') {
    console.error('\nPara ejecutar de verdad, establece CONFIRM_DELETE_APP_USER=YES (o usa --dry-run para simular).')
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

  console.log('\nListo: usuario de aplicación eliminado (user_profile en cascada + auth.users y dependencias auth.*).')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
