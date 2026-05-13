/**
 * Un usuario con permiso de **crear** trabajadores debe poder **editar** (misma pantalla de alta).
 * En BD a veces solo se inserta el grant CREATE; el de EDIT se alinea por migración y por OR aquí.
 */
const CAN_EDIT = 'NAV_ACTION_TRABAJADORES_TRABAJADORES_EDIT'
const CAN_CREATE = 'NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE'

const MUTATE_CODES = [CAN_EDIT, CAN_CREATE]

/**
 * @param {Set<string>} grantedCodes
 * @returns {boolean}
 */
export function canMutateTrabajadores(grantedCodes) {
  if (!grantedCodes || typeof grantedCodes.has !== 'function') return false
  return MUTATE_CODES.some((c) => grantedCodes.has(c))
}

export const TRABAJADORES_MUTATE_GRANT_CODES = MUTATE_CODES
