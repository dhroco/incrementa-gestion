const { db } = require('../db/knex')
const { isValidPermissionPair } = require('../config/permissionsCatalog')

const PLATFORM_ADMIN_CODE = 'ADMINISTRADOR_PLATAFORMA'

function isUniqueViolation(err) {
  return err && err.code === '23505'
}

function mapPermissionRow(row) {
  return {
    id: row.id,
    action: row.action,
    subject: row.subject,
    inverted: row.inverted === true
  }
}

function mapProfileRow(row) {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    createdAt: row.created_at ?? null
  }
}

async function countUsersByProfileIds(profileIds) {
  if (!profileIds.length) return new Map()
  const rows = await db('user_profile')
    .select('profile_id')
    .count('* as count')
    .whereIn('profile_id', profileIds)
    .groupBy('profile_id')
  const map = new Map()
  for (const row of rows) {
    map.set(row.profile_id, Number(row.count) || 0)
  }
  return map
}

async function countPermissionsByProfileIds(profileIds) {
  if (!profileIds.length) return new Map()
  const rows = await db('role_permissions')
    .select('role_id')
    .count('* as count')
    .whereIn('role_id', profileIds)
    .groupBy('role_id')
  const map = new Map()
  for (const row of rows) {
    map.set(row.role_id, Number(row.count) || 0)
  }
  return map
}

async function fullAccessProfileIds(profileIds) {
  if (!profileIds.length) return new Set()
  const rows = await db('role_permissions')
    .select('role_id')
    .whereIn('role_id', profileIds)
    .where({ action: 'manage', subject: 'all' })
  return new Set(rows.map((row) => row.role_id))
}

async function listRoles() {
  const rows = await db('profile')
    .select('id', 'code', 'label', 'created_at')
    .orderBy('label', 'asc')

  const profileIds = rows.map((row) => row.id)
  const [usersByProfile, permissionsByProfile, fullAccessIds] = await Promise.all([
    countUsersByProfileIds(profileIds),
    countPermissionsByProfileIds(profileIds),
    fullAccessProfileIds(profileIds)
  ])

  return {
    ok: true,
    data: {
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        label: row.label,
        createdAt: row.created_at ?? null,
        permissionsCount: permissionsByProfile.get(row.id) ?? 0,
        usersCount: usersByProfile.get(row.id) ?? 0,
        hasFullAccess: fullAccessIds.has(row.id)
      }))
    }
  }
}

async function getRoleById(roleId) {
  const profile = await db('profile').where({ id: roleId }).first()
  if (!profile) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Rol no encontrado.' }
  }

  const [permissions, usersCountRow] = await Promise.all([
    db('role_permissions')
      .select('id', 'action', 'subject', 'inverted')
      .where({ role_id: roleId })
      .orderBy('subject', 'asc')
      .orderBy('action', 'asc'),
    db('user_profile').where({ profile_id: roleId }).count('* as count').first()
  ])

  return {
    ok: true,
    data: {
      role: {
        ...mapProfileRow(profile),
        usersCount: Number(usersCountRow?.count) || 0
      },
      permissions: permissions.map(mapPermissionRow)
    }
  }
}

async function createRole({ code, label }) {
  const normalizedCode = typeof code === 'string' ? code.trim() : ''
  const normalizedLabel = typeof label === 'string' ? label.trim() : ''

  if (!normalizedCode) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'El código es obligatorio.' }
  }
  if (!normalizedLabel) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'El nombre del rol es obligatorio.' }
  }

  try {
    const [inserted] = await db('profile')
      .insert({ code: normalizedCode, label: normalizedLabel })
      .returning(['id', 'code', 'label', 'created_at'])

    return { ok: true, status: 201, data: { role: mapProfileRow(inserted) } }
  } catch (err) {
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        status: 409,
        code: 'DUPLICATE_CODE',
        message: 'Ya existe un rol con ese código.'
      }
    }
    throw err
  }
}

async function updateRoleLabel({ roleId, label }) {
  const normalizedLabel = typeof label === 'string' ? label.trim() : ''
  if (!normalizedLabel) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'El nombre del rol es obligatorio.' }
  }

  const profile = await db('profile').where({ id: roleId }).first()
  if (!profile) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Rol no encontrado.' }
  }

  const [updated] = await db('profile')
    .where({ id: roleId })
    .update({ label: normalizedLabel, updated_at: db.fn.now() })
    .returning(['id', 'code', 'label', 'created_at'])

  return { ok: true, data: { role: mapProfileRow(updated) } }
}

async function deleteRole(roleId) {
  const profile = await db('profile').where({ id: roleId }).first()
  if (!profile) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Rol no encontrado.' }
  }

  if (profile.code === PLATFORM_ADMIN_CODE) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'El rol de Administrador de plataforma no puede eliminarse.'
    }
  }

  const usersCountRow = await db('user_profile').where({ profile_id: roleId }).count('* as count').first()
  const usersCount = Number(usersCountRow?.count) || 0
  if (usersCount > 0) {
    return {
      ok: false,
      status: 409,
      code: 'ROLE_IN_USE',
      message: 'No se puede eliminar un rol con usuarios asignados.'
    }
  }

  await db('profile').where({ id: roleId }).del()
  return { ok: true, data: { deleted: true } }
}

function normalizePermissionsInput(permissions) {
  if (!Array.isArray(permissions)) return null
  const normalized = []
  const seen = new Set()
  for (const item of permissions) {
    const action = typeof item?.action === 'string' ? item.action.trim() : ''
    const subject = typeof item?.subject === 'string' ? item.subject.trim() : ''
    if (!action || !subject) continue
    const key = `${subject}:${action}`
    if (seen.has(key)) continue
    if (!isValidPermissionPair({ action, subject })) {
      return { error: `Permiso inválido: ${action} / ${subject}.` }
    }
    seen.add(key)
    normalized.push({ action, subject })
  }
  return { permissions: normalized }
}

async function replaceRolePermissions({ roleId, permissions }) {
  const profile = await db('profile').where({ id: roleId }).first()
  if (!profile) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Rol no encontrado.' }
  }

  const parsed = normalizePermissionsInput(permissions)
  if (!parsed) {
    return {
      ok: false,
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'El campo permissions debe ser un arreglo.'
    }
  }
  if (parsed.error) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: parsed.error }
  }

  const saved = await db.transaction(async (trx) => {
    await trx('role_permissions').where({ role_id: roleId }).del()
    if (parsed.permissions.length === 0) return []

    const rows = parsed.permissions.map(({ action, subject }) => ({
      role_id: roleId,
      action,
      subject,
      inverted: false
    }))
    const inserted = await trx('role_permissions')
      .insert(rows)
      .returning(['id', 'action', 'subject', 'inverted'])
    return inserted.map(mapPermissionRow)
  })

  return { ok: true, data: { permissions: saved } }
}

module.exports = {
  listRoles,
  getRoleById,
  createRole,
  updateRoleLabel,
  deleteRole,
  replaceRolePermissions
}
