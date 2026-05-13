import { createSlice } from '@reduxjs/toolkit'

function storageKey(userId) {
  return `gfa-selected-company:${userId}`
}

/**
 * Lee la última empresa elegida (persistencia entre sesiones de login).
 * Migra una vez desde sessionStorage si existía solo ahí.
 */
function readPersistedCompanyId(userId) {
  if (!userId) return null
  try {
    const key = storageKey(userId)
    const fromLocal = localStorage.getItem(key)
    if (fromLocal) return fromLocal
    const fromSession = sessionStorage.getItem(key)
    if (fromSession) {
      localStorage.setItem(key, fromSession)
      sessionStorage.removeItem(key)
      return fromSession
    }
  } catch {
    // ignore quota / private mode
  }
  return null
}

/**
 * Persiste la selección en localStorage. La validez (asignada + activa) se comprueba
 * al hidratar contra `assignedCompanies` del backend.
 */
function writePersistedCompanyId(userId, companyId) {
  if (!userId || !companyId) return
  try {
    const key = storageKey(userId)
    localStorage.setItem(key, companyId)
    sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function pickInitialSelection(userId, assigned) {
  if (!userId || !Array.isArray(assigned) || assigned.length === 0) return null
  const stored = readPersistedCompanyId(userId)
  if (stored && assigned.some((a) => a && a.id === stored)) return stored
  return assigned[0].id
}

const initialState = {
  /** @type {{ id: string, business_name: string | null }[]>} */
  assignedCompanies: [],
  /** @type {string | null} */
  selectedCompanyId: null
}

const sessionCompanySlice = createSlice({
  name: 'sessionCompany',
  initialState,
  reducers: {
    hydrateAccountantCompanyContext(state, action) {
      const userId = typeof action.payload?.userId === 'string' ? action.payload.userId : null
      const raw = action.payload?.assignedCompanies
      const assigned = Array.isArray(raw)
        ? raw
            .filter((x) => x && typeof x.id === 'string')
            .map((x) => ({
              id: x.id,
              business_name: typeof x.business_name === 'string' || x.business_name === null ? x.business_name : null
            }))
        : []
      state.assignedCompanies = assigned
      const selected = pickInitialSelection(userId, assigned)
      state.selectedCompanyId = selected
      if (userId && selected) {
        writePersistedCompanyId(userId, selected)
      }
    },
    setSelectedCompanyId(state, action) {
      const companyId = typeof action.payload?.companyId === 'string' ? action.payload.companyId : null
      const userId = typeof action.payload?.userId === 'string' ? action.payload.userId : null
      state.selectedCompanyId = companyId
      if (userId && companyId) {
        writePersistedCompanyId(userId, companyId)
      }
    },
    clearSessionCompanyContext: () => initialState
  },
  extraReducers: (builder) => {
    builder.addCase('auth/sessionUpdated', (state, action) => {
      if (!action.payload) {
        return initialState
      }
      return state
    })
  }
})

export const { hydrateAccountantCompanyContext, setSelectedCompanyId, clearSessionCompanyContext } =
  sessionCompanySlice.actions
export const sessionCompanyReducer = sessionCompanySlice.reducer

export function selectAssignedCompanies(state) {
  return state.sessionCompany.assignedCompanies
}

export function selectSelectedCompanyId(state) {
  return state.sessionCompany.selectedCompanyId
}
