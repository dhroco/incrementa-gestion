import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { fetchEnrichedSession } from '../api/enrichedSessionApi'
import appConfig from '../../config.js'
import { mapAuthErrorToSpanish } from '../auth/mapAuthErrorToSpanish'
import { normalizeAuthEmail } from '../auth/normalizeAuthEmail'
import { supabase } from '../auth/supabaseClient'
import { clearSessionCompanyContext, hydrateAccountantCompanyContext } from './sessionCompanySlice'

export const invalidateSessionThunk = createAsyncThunk(
  'auth/invalidateSession',
  async ({ reason } = {}, { dispatch }) => {
    dispatch(sessionUpdated(null))
    dispatch(setAuthGlobalMessage(reason === 'unauthorized' ? 'Su sesión expiró. Inicie sesión nuevamente.' : null))
    try {
      await supabase.auth.signOut()
    } catch {
      // best-effort
    }
    return null
  }
)

export const signInWithPasswordThunk = createAsyncThunk(
  'auth/signInWithPassword',
  async ({ email, password }, { rejectWithValue }) => {
    const normalizedEmail = normalizeAuthEmail(email)
    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    if (error) return rejectWithValue(mapAuthErrorToSpanish(error))
    return data.session
  }
)

export const signOutThunk = createAsyncThunk('auth/signOut', async (_, { rejectWithValue }) => {
  const { error } = await supabase.auth.signOut()
  if (error) return rejectWithValue('No se pudo cerrar la sesión. Intente nuevamente.')
  return null
})

/**
 * Loads internal profile + display identity from backend using the current Supabase access token.
 * @returns {Promise<
 *   | { kind: 'skipped' }
 *   | { kind: 'ok'; profile: { code: string; label: string }; email: string | null; name: string | null; company?: { id: string, business_name: string | null } | null }
 *   | { kind: 'no_profile'; email: string | null }
 *   | { kind: 'error'; message: string }
 * >}
 */
export const fetchEnrichedSessionThunk = createAsyncThunk(
  'auth/fetchEnrichedSession',
  async (arg, { dispatch, getState, signal }) => {
    const session = getState().auth.session
    if (!session?.access_token) {
      return { kind: 'skipped' }
    }
    try {
      const { ok, status, body } = await fetchEnrichedSession(
        appConfig.API_BASE_URL,
        session.access_token,
        { signal }
      )
      if (ok && body && typeof body === 'object') {
        const p = body.profile
        if (p && typeof p.code === 'string' && typeof p.label === 'string') {
          const company =
            body.company && typeof body.company === 'object'
              ? {
                  id: typeof body.company.id === 'string' ? body.company.id : null,
                  business_name:
                    typeof body.company.business_name === 'string' || body.company.business_name === null
                      ? body.company.business_name
                      : null
                }
              : null
          const navigation =
            body.navigation && typeof body.navigation === 'object'
              ? {
                  tree: Array.isArray(body.navigation.tree) ? body.navigation.tree : [],
                  routes: Array.isArray(body.navigation.routes) ? body.navigation.routes : [],
                  grantedCodes: Array.isArray(body.navigation.grantedCodes) ? body.navigation.grantedCodes : undefined
                }
              : { tree: [], routes: [] }
          const mustChangePassword = body.mustChangePassword === true
          const isActive = body.isActive === false ? false : body.isActive === true ? true : null
          const name =
            typeof body.name === 'string' && body.name.trim().length > 0 ? body.name.trim() : null

          const uid = session?.user?.id
          if (p.code === 'CONTADOR' && typeof uid === 'string') {
            const raw = body.assignedCompanies
            const assignedCompanies = Array.isArray(raw)
              ? raw
                  .filter((x) => x && typeof x.id === 'string')
                  .map((x) => ({
                    id: x.id,
                    business_name:
                      typeof x.business_name === 'string' || x.business_name === null ? x.business_name : null
                  }))
              : []
            dispatch(hydrateAccountantCompanyContext({ userId: uid, assignedCompanies }))
          } else {
            dispatch(clearSessionCompanyContext())
          }

          return {
            kind: 'ok',
            profile: { code: p.code, label: p.label },
            email: typeof body.email === 'string' || body.email === null ? body.email : null,
            name,
            company: company && typeof company.id === 'string' ? company : null,
            navigation,
            mustChangePassword,
            isActive
          }
        }
      }
      if (
        status === 403 &&
        body &&
        typeof body === 'object' &&
        (body.code === 'ACCOUNTANT_INACTIVE' || body.code === 'USER_INACTIVE')
      ) {
        dispatch(clearSessionCompanyContext())
        return {
          kind: 'accountant_inactive',
          email: typeof body.email === 'string' || body.email === null ? body.email : null
        }
      }
      if (status === 404 && body && typeof body === 'object' && body.code === 'PROFILE_NOT_ASSIGNED') {
        dispatch(clearSessionCompanyContext())
        return {
          kind: 'no_profile',
          email: typeof body.email === 'string' || body.email === null ? body.email : null
        }
      }
      if (status === 401) {
        dispatch(clearSessionCompanyContext())
        dispatch(invalidateSessionThunk({ reason: 'unauthorized' }))
        return {
          kind: 'error',
          message: 'No autorizado. Inicie sesión nuevamente.'
        }
      }
      const messageFromBody =
        body && typeof body === 'object' && typeof body.message === 'string' ? body.message : null
      dispatch(clearSessionCompanyContext())
      return {
        kind: 'error',
        message: messageFromBody || 'No se pudo cargar la sesión de la aplicación. Intente nuevamente.'
      }
    } catch (e) {
      if (e && typeof e === 'object' && e.name === 'AbortError') {
        return { kind: 'skipped' }
      }
      dispatch(clearSessionCompanyContext())
      return {
        kind: 'error',
        message: 'Error de red al cargar la sesión. Intente nuevamente.'
      }
    }
  },
  {
    condition: (arg, { getState }) => {
      const { session, enrichmentStatus, mustChangePassword } = getState().auth
      const force = arg && typeof arg === 'object' && arg.force === true
      if (!session?.access_token) return false
      if (enrichmentStatus === 'loading') return false
      if (!force && enrichmentStatus === 'succeeded' && !mustChangePassword) return false
      return true
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    session: null,
    user: null,
    initialized: false,
    globalMessage: null,
    signInError: null,
    signInSubmitting: false,
    signOutError: null,
    /** @type {'idle' | 'loading' | 'succeeded' | 'failed' | 'missing_profile' | 'empty_navigation' | 'accountant_inactive'} */
    enrichmentStatus: 'idle',
    enrichmentError: null,
    enrichedEmail: null,
    enrichedProfile: null,
    enrichedCompany: null,
    /** @type {{ tree: unknown[], routes: unknown[] } | null} */
    enrichedNavigation: null,
    mustChangePassword: false,
    /** @type {boolean | null} null si no aplica (no contador) */
    enrichedIsActive: null
  },
  reducers: {
    sessionUpdated(state, action) {
      const session = action.payload
      const nextUserId = session?.user?.id ?? null
      const prevUserId = state.user?.id ?? null

      if (!session) {
        state.enrichmentStatus = 'idle'
        state.enrichmentError = null
        state.enrichedEmail = null
        state.enrichedName = null
        state.enrichedProfile = null
        state.enrichedCompany = null
        state.enrichedNavigation = null
        state.mustChangePassword = false
        state.enrichedIsActive = null
      } else if (nextUserId !== prevUserId) {
        state.enrichmentStatus = 'idle'
        state.enrichmentError = null
        state.enrichedEmail = null
        state.enrichedName = null
        state.enrichedProfile = null
        state.enrichedCompany = null
        state.enrichedNavigation = null
        state.mustChangePassword = false
        state.enrichedIsActive = null
      }

      state.session = session
      state.user = session?.user ?? null
    },
    setAuthGlobalMessage(state, action) {
      state.globalMessage = typeof action.payload === 'string' ? action.payload : null
    },
    setInitialized(state, action) {
      state.initialized = action.payload
    },
    clearSignInError(state) {
      state.signInError = null
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signInWithPasswordThunk.pending, (state) => {
        state.signInSubmitting = true
        state.signInError = null
        state.globalMessage = null
      })
      .addCase(signInWithPasswordThunk.fulfilled, (state, action) => {
        state.signInSubmitting = false
        if (action.payload) {
          state.session = action.payload
          state.user = action.payload.user ?? null
        }
      })
      .addCase(signInWithPasswordThunk.rejected, (state, action) => {
        state.signInSubmitting = false
        state.signInError =
          typeof action.payload === 'string' ? action.payload : 'No se pudo iniciar sesión.'
      })
      .addCase(signOutThunk.pending, (state) => {
        state.signOutError = null
      })
      .addCase(signOutThunk.rejected, (state, action) => {
        state.signOutError =
          typeof action.payload === 'string' ? action.payload : 'No se pudo cerrar la sesión.'
      })
      .addCase(fetchEnrichedSessionThunk.pending, (state) => {
        state.enrichmentStatus = 'loading'
        state.enrichmentError = null
      })
      .addCase(fetchEnrichedSessionThunk.fulfilled, (state, action) => {
        const result = action.payload
        if (result.kind === 'skipped') {
          state.enrichmentStatus = 'idle'
          return
        }
        if (result.kind === 'ok') {
          state.enrichedEmail = result.email
          state.enrichedName = result.name ?? null
          state.enrichedProfile = result.profile
          state.enrichedCompany = result.company ?? null
          state.enrichedNavigation = result.navigation
          state.mustChangePassword = !!result.mustChangePassword
          state.enrichedIsActive = result.isActive === true || result.isActive === false ? result.isActive : null
          const routes = result.navigation?.routes
          if (!routes || routes.length === 0) {
            if (result.mustChangePassword) {
              state.enrichmentStatus = 'succeeded'
              state.enrichmentError = null
            } else {
              state.enrichmentStatus = 'empty_navigation'
              state.enrichmentError = null
            }
          } else {
            state.enrichmentStatus = 'succeeded'
            state.enrichmentError = null
          }
          return
        }
        if (result.kind === 'accountant_inactive') {
          state.enrichmentStatus = 'accountant_inactive'
          state.enrichmentError = null
          state.enrichedEmail = result.email
          state.enrichedName = null
          state.enrichedProfile = null
          state.enrichedCompany = null
          state.enrichedNavigation = null
          state.mustChangePassword = false
          state.enrichedIsActive = false
          return
        }
        if (result.kind === 'no_profile') {
          state.enrichmentStatus = 'missing_profile'
          state.enrichmentError = null
          state.enrichedEmail = result.email
          state.enrichedName = null
          state.enrichedProfile = null
          state.enrichedCompany = null
          state.enrichedNavigation = null
          state.mustChangePassword = false
          state.enrichedIsActive = null
          return
        }
        state.enrichmentStatus = 'failed'
        state.enrichmentError = result.message
        state.enrichedName = null
        state.enrichedProfile = null
        state.enrichedCompany = null
        state.enrichedNavigation = null
        state.mustChangePassword = false
        state.enrichedIsActive = null
      })
      .addCase(fetchEnrichedSessionThunk.rejected, (state, action) => {
        state.enrichmentStatus = 'failed'
        state.enrichmentError =
          typeof action.payload === 'string'
            ? action.payload
            : action.error?.message || 'No se pudo cargar la sesión de la aplicación.'
        state.enrichedName = null
      })
  }
})

export const { sessionUpdated, setAuthGlobalMessage, setInitialized, clearSignInError } =
  authSlice.actions
export const authReducer = authSlice.reducer

export function selectSession(state) {
  return state.auth.session
}

export function selectUser(state) {
  return state.auth.user
}

export function selectAuthInitialized(state) {
  return state.auth.initialized
}

export function selectIsAuthenticated(state) {
  return !!state.auth.session
}

export function selectSignInError(state) {
  return state.auth.signInError
}

export function selectSignInSubmitting(state) {
  return state.signInSubmitting
}

export function selectAuthGlobalMessage(state) {
  return state.auth.globalMessage
}

export function selectEnrichmentStatus(state) {
  return state.auth.enrichmentStatus
}

export function selectEnrichmentError(state) {
  return state.auth.enrichmentError
}

export function selectEnrichedEmail(state) {
  return state.auth.enrichedEmail
}

export function selectEnrichedName(state) {
  return state.auth.enrichedName
}

export function selectEnrichedProfile(state) {
  return state.auth.enrichedProfile
}

export function selectEnrichedCompany(state) {
  return state.auth.enrichedCompany
}

export function selectEnrichedNavigation(state) {
  return state.auth.enrichedNavigation
}

export function selectMustChangePassword(state) {
  return state.auth.mustChangePassword
}

export function selectEnrichedIsActive(state) {
  return state.auth.enrichedIsActive
}
