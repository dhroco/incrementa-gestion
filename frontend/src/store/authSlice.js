import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { unpackRules } from '@casl/ability/extra'
import { fetchEnrichedSession } from '../api/enrichedSessionApi'
import appConfig from '../../config.js'
import { acquireApiAccessToken, getActiveMsalAccount, msalUserFromAccount } from '../auth/msalToken'
import { msalInstance } from '../auth/msalInstance'
import { clearSessionCompanyContext } from './sessionCompanySlice'
import { ability } from '../lib/ability'

function clearEnrichedFields(state) {
  state.enrichmentStatus = 'idle'
  state.enrichmentError = null
  state.enrichedEmail = null
  state.enrichedName = null
  state.enrichedProfile = null
  state.enrichedCompany = null
  state.enrichedIsActive = null
  state.avatarUrl = null
  state.contactEmail = null
  state.widgetPreferences = null
}

export const signOutThunk = createAsyncThunk('auth/signOut', async ({ reason } = {}, { dispatch }) => {
  if (reason === 'unauthorized') {
    dispatch(setAuthGlobalMessage('Su sesión expiró. Inicie sesión nuevamente.'))
  }
  ability.update([])
  dispatch(clearAuthState())
  try {
    await msalInstance.logoutRedirect({
      postLogoutRedirectUri: window.location.origin
    })
  } catch {
    // best-effort
  }
  return null
})

export const invalidateSessionThunk = createAsyncThunk(
  'auth/invalidateSession',
  async ({ reason } = {}, { dispatch }) => {
    await dispatch(signOutThunk({ reason }))
    return null
  }
)

/**
 * Loads internal profile + display identity from backend using the current MSAL access token.
 */
export const fetchEnrichedSessionThunk = createAsyncThunk(
  'auth/fetchEnrichedSession',
  async (arg, { dispatch, signal }) => {
    const accessToken = await acquireApiAccessToken()
    if (!accessToken) {
      return { kind: 'skipped' }
    }
    try {
      const { ok, status, body } = await fetchEnrichedSession(appConfig.API_BASE_URL, accessToken, {
        signal
      })
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
          const permissions = Array.isArray(body.permissions) ? body.permissions : []
          if (permissions.length > 0) {
            ability.update(unpackRules(permissions))
          } else {
            ability.update([])
          }
          const isActive = body.isActive === false ? false : body.isActive === true ? true : null
          const name =
            typeof body.name === 'string' && body.name.trim().length > 0 ? body.name.trim() : null
          const avatarUrl =
            typeof body.avatar_url === 'string' && body.avatar_url.trim().length > 0
              ? body.avatar_url.trim()
              : null
          const contactEmailFromBody =
            typeof body.contact_email === 'string' && body.contact_email.trim().length > 0
              ? body.contact_email.trim()
              : null
          const widgetPreferences =
            body.widget_preferences != null &&
            typeof body.widget_preferences === 'object' &&
            !Array.isArray(body.widget_preferences)
              ? body.widget_preferences
              : null

          dispatch(clearSessionCompanyContext())

          return {
            kind: 'ok',
            profile: { code: p.code, label: p.label },
            email: typeof body.email === 'string' || body.email === null ? body.email : null,
            name,
            company: company && typeof company.id === 'string' ? company : null,
            permissions,
            isActive,
            avatarUrl,
            contactEmail: contactEmailFromBody,
            widgetPreferences,
            user: msalUserFromAccount(getActiveMsalAccount())
          }
        }
      }
      if (
        status === 403 &&
        body &&
        typeof body === 'object' &&
        body.code === 'USER_INACTIVE'
      ) {
        dispatch(clearSessionCompanyContext())
        return {
          kind: 'user_inactive',
          email: typeof body.email === 'string' || body.email === null ? body.email : null,
          user: msalUserFromAccount(getActiveMsalAccount())
        }
      }
      if (status === 404 && body && typeof body === 'object' && body.code === 'PROFILE_NOT_ASSIGNED') {
        dispatch(clearSessionCompanyContext())
        return {
          kind: 'no_profile',
          email: typeof body.email === 'string' || body.email === null ? body.email : null,
          user: msalUserFromAccount(getActiveMsalAccount())
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
      const { enrichmentStatus } = getState().auth
      const force = arg && typeof arg === 'object' && arg.force === true
      if (!getActiveMsalAccount()) return false
      if (enrichmentStatus === 'loading') return false
      if (!force && enrichmentStatus === 'succeeded') return false
      return true
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    initialized: false,
    globalMessage: null,
    signOutError: null,
    enrichmentStatus: 'idle',
    enrichmentError: null,
    enrichedEmail: null,
    enrichedProfile: null,
    enrichedCompany: null,
    enrichedIsActive: null,
    avatarUrl: null,
    contactEmail: null,
    widgetPreferences: null
  },
  reducers: {
    setMsalUser(state, action) {
      state.user = action.payload ?? null
    },
    clearAuthState(state) {
      clearEnrichedFields(state)
      state.user = null
    },
    setAuthGlobalMessage(state, action) {
      state.globalMessage = typeof action.payload === 'string' ? action.payload : null
    },
    setInitialized(state, action) {
      state.initialized = action.payload
    },
    updateProfileData(state, action) {
      const payload = action.payload
      if (!payload || typeof payload !== 'object') return
      if (payload.contactEmail !== undefined) {
        state.contactEmail =
          typeof payload.contactEmail === 'string' || payload.contactEmail === null
            ? payload.contactEmail
            : state.contactEmail
      }
      if (payload.widgetPreferences !== undefined) {
        state.widgetPreferences =
          payload.widgetPreferences != null && typeof payload.widgetPreferences === 'object'
            ? payload.widgetPreferences
            : payload.widgetPreferences === null
              ? null
              : state.widgetPreferences
      }
      if (payload.avatarUrl !== undefined) {
        state.avatarUrl =
          typeof payload.avatarUrl === 'string' || payload.avatarUrl === null
            ? payload.avatarUrl
            : state.avatarUrl
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signOutThunk.pending, (state) => {
        state.signOutError = null
      })
      .addCase(signOutThunk.fulfilled, (state) => {
        clearEnrichedFields(state)
        state.user = null
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
        if (result.user) {
          state.user = result.user
        }
        if (result.kind === 'ok') {
          state.enrichedEmail = result.email
          state.enrichedName = result.name ?? null
          state.enrichedProfile = result.profile
          state.enrichedCompany = result.company ?? null
          state.enrichedIsActive = result.isActive === true || result.isActive === false ? result.isActive : null
          state.avatarUrl = result.avatarUrl ?? null
          state.contactEmail = result.contactEmail ?? null
          state.widgetPreferences = result.widgetPreferences ?? null
          const permissions = result.permissions
          if (!permissions || permissions.length === 0) {
            state.enrichmentStatus = 'empty_navigation'
            state.enrichmentError = null
          } else {
            state.enrichmentStatus = 'succeeded'
            state.enrichmentError = null
          }
          return
        }
        if (result.kind === 'user_inactive') {
          state.enrichmentStatus = 'user_inactive'
          state.enrichmentError = null
          state.enrichedEmail = result.email
          state.enrichedName = null
          state.enrichedProfile = null
          state.enrichedCompany = null
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
          state.enrichedIsActive = null
          return
        }
        state.enrichmentStatus = 'failed'
        state.enrichmentError = result.message
        state.enrichedName = null
        state.enrichedProfile = null
        state.enrichedCompany = null
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

export const { setMsalUser, clearAuthState, setAuthGlobalMessage, setInitialized, updateProfileData } =
  authSlice.actions
export const authReducer = authSlice.reducer

export function selectUser(state) {
  return state.auth.user
}

export function selectAuthInitialized(state) {
  return state.auth.initialized
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

export function selectEnrichedIsActive(state) {
  return state.auth.enrichedIsActive
}

export function selectAvatarUrl(state) {
  return state.auth.avatarUrl
}

export function selectContactEmail(state) {
  return state.auth.contactEmail
}

export function selectWidgetPreferences(state) {
  return state.auth.widgetPreferences
}
