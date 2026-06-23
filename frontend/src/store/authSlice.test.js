import { describe, expect, it } from 'vitest'
import {
  authReducer,
  fetchEnrichedSessionThunk,
  setInitialized,
  setMsalUser
} from './authSlice'

const baseExtras = {
  signOutError: null,
  enrichmentStatus: 'idle',
  enrichmentError: null,
  enrichedEmail: null,
  enrichedName: null,
  enrichedProfile: null,
  enrichedCompany: null,
  enrichedIsActive: null,
  avatarUrl: null,
  contactEmail: null,
  widgetPreferences: null
}

describe('authReducer', () => {
  it('starts uninitialized', () => {
    const state = authReducer(undefined, { type: '@@init' })
    expect(state.initialized).toBe(false)
    expect(state.user).toBeNull()
    expect(state.enrichmentStatus).toBe('idle')
  })

  it('setMsalUser stores user from MSAL account', () => {
    const state = authReducer(undefined, setMsalUser({ id: 'u1', email: 'a@b.cl' }))
    expect(state.user).toEqual({ id: 'u1', email: 'a@b.cl' })
  })

  it('setInitialized toggles flag', () => {
    let state = authReducer(undefined, setInitialized(true))
    expect(state.initialized).toBe(true)
    state = authReducer(state, setInitialized(false))
    expect(state.initialized).toBe(false)
  })

  it('fetchEnrichedSession fulfilled ok stores profile and email', () => {
    const prior = {
      user: { id: 'u1', email: 'a@b.cl' },
      initialized: true,
      globalMessage: null,
      ...baseExtras,
      enrichmentStatus: 'loading'
    }
    const state = authReducer(
      prior,
      fetchEnrichedSessionThunk.fulfilled(
        {
          kind: 'ok',
          email: 'a@b.cl',
          name: 'Ana',
          profile: { code: 'ADMIN', label: 'Admin' },
          company: null,
          permissions: [{ action: 'read', subject: 'Company' }],
          isActive: true,
          avatarUrl: null,
          contactEmail: null,
          widgetPreferences: null,
          user: { id: 'u1', email: 'a@b.cl' }
        },
        '',
        undefined
      )
    )
    expect(state.enrichedEmail).toBe('a@b.cl')
    expect(state.enrichedProfile).toEqual({ code: 'ADMIN', label: 'Admin' })
    expect(state.enrichmentStatus).toBe('succeeded')
  })

  it('fetchEnrichedSession fulfilled no_profile sets missing_profile', () => {
    const prior = {
      user: { id: 'u1', email: 'a@b.cl' },
      initialized: true,
      globalMessage: null,
      ...baseExtras,
      enrichmentStatus: 'loading'
    }
    const state = authReducer(
      prior,
      fetchEnrichedSessionThunk.fulfilled(
        {
          kind: 'no_profile',
          email: 'a@b.cl',
          user: { id: 'u1', email: 'a@b.cl' }
        },
        '',
        undefined
      )
    )
    expect(state.enrichmentStatus).toBe('missing_profile')
    expect(state.enrichedEmail).toBe('a@b.cl')
  })
})
