const VALID_STATUSES = new Set(['draft', 'active', 'inactive'])

function normalizeStatusInput(value) {
  if (value == null) return null
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  return v.length ? v : null
}

function isAllowedStatusTransition(fromStatus, toStatus) {
  if (!fromStatus || !toStatus) return false
  if (fromStatus === toStatus) return true

  // Explicit lifecycle:
  // - draft -> active
  // - active -> inactive
  // - inactive -> active
  if (fromStatus === 'draft' && toStatus === 'active') return true
  if (fromStatus === 'active' && toStatus === 'inactive') return true
  if (fromStatus === 'inactive' && toStatus === 'active') return true
  return false
}

/**
 * Validate a requested status change.
 * @param {{ fromStatus: string, toStatusInput: unknown, isInUseByActiveTemplate: () => Promise<boolean> }} args
 */
async function validateClauseStatusChange({ fromStatus, toStatusInput, isInUseByActiveTemplate }) {
  const toStatus = normalizeStatusInput(toStatusInput)
  if (!toStatus || !VALID_STATUSES.has(toStatus)) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'CLAUSE_INVALID_STATUS',
      message: 'Estado inválido. Use Borrador, Activa o Inactiva.',
      toStatus: null,
    }
  }

  const from = normalizeStatusInput(fromStatus)
  if (!from || !VALID_STATUSES.has(from)) {
    // Defensive: DB should guarantee allowed values.
    return {
      ok: false,
      httpStatus: 500,
      code: 'CLAUSE_STATUS_CORRUPTED',
      message: 'Estado actual inválido en el sistema.',
      toStatus: null,
    }
  }

  if (!isAllowedStatusTransition(from, toStatus)) {
    return {
      ok: false,
      httpStatus: 409,
      code: 'INVALID_STATUS_TRANSITION',
      message: 'Transición de estado no permitida.',
      toStatus: null,
    }
  }

  if (from !== toStatus && toStatus === 'inactive') {
    const inUse = await isInUseByActiveTemplate()
    if (inUse) {
      return {
        ok: false,
        httpStatus: 409,
        code: 'CLAUSE_IN_USE_BY_ACTIVE_TEMPLATE',
        message: 'No se puede inactivar porque la cláusula está en uso en una plantilla activa.',
        toStatus: null,
      }
    }
  }

  return { ok: true, toStatus }
}

module.exports = {
  normalizeStatusInput,
  isAllowedStatusTransition,
  validateClauseStatusChange,
}

