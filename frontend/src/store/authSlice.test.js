import { describe, expect, it } from 'vitest'
import {
  authReducer,
  clearSignInError,
  fetchEnrichedSessionThunk,
  sessionUpdated,
  setInitialized
} from './authSlice'

const baseExtras = {
  signInError: null,
  signInSubmitting: false,
  signOutError: null,
  enrichmentStatus: 'idle',
  enrichmentError: null,
  enrichedEmail: null,
  enrichedName: null,
  enrichedProfile: null,
  enrichedCompany: null,
  enrichedNavigation: null,
  mustChangePassword: false,
  enrichedIsActive: null
}

describe('authReducer', () => {
  it('starts uninitialized', () => {
    const state = authReducer(undefined, { type: '@@init' })
    expect(state.initialized).toBe(false)
    expect(state.session).toBeNull()
    expect(state.enrichmentStatus).toBe('idle')
  })

  it('sessionUpdated stores session and user', () => {
    const session = { user: { id: 'u1', email: 'a@b.cl' } }
    const state = authReducer(undefined, sessionUpdated(session))
    expect(state.session).toEqual(session)
    expect(state.user).toEqual(session.user)
  })

  it('setInitialized toggles flag', () => {
    let state = authReducer(undefined, setInitialized(true))
    expect(state.initialized).toBe(true)
    state = authReducer(state, setInitialized(false))
    expect(state.initialized).toBe(false)
  })

  it('clearSignInError clears signInError', () => {
    const withError = {
      session: null,
      user: null,
      initialized: true,
      signInError: 'x',
      signInSubmitting: false,
      signOutError: null,
      ...baseExtras
    }
    const state = authReducer(withError, clearSignInError())
    expect(state.signInError).toBeNull()
  })

  it('fetchEnrichedSession fulfilled ok stores profile and email', () => {
    const prior = {
      session: { access_token: 't', user: { id: 'u1' } },
      user: { id: 'u1' },
      initialized: true,
      ...baseExtras,
      enrichmentStatus: 'loading'
    }
    const state = authReducer(
      prior,
      fetchEnrichedSessionThunk.fulfilled(
        {
          kind: 'ok',
          profile: { code: 'P1', label: 'Perfil uno' },
          email: 'a@b.cl',
          name: null,
          company: null,
          mustChangePassword: false,
          isActive: null,
          navigation: {
            tree: [],
            routes: [{ code: 'R1', routePath: '/app/dashboard', label: 'D', moduleTitle: 'D', sortOrder: 1 }]
          }
        },
        'req-id',
        undefined
      )
    )
    expect(state.enrichmentStatus).toBe('succeeded')
    expect(state.enrichedProfile).toEqual({ code: 'P1', label: 'Perfil uno' })
    expect(state.enrichedEmail).toBe('a@b.cl')
    expect(state.enrichedName).toBeNull()
    expect(state.enrichedNavigation?.routes?.length).toBe(1)
  })

  it('fetchEnrichedSession fulfilled ok stores enrichedName when name is present', () => {
    const prior = {
      session: { access_token: 't', user: { id: 'u1' } },
      user: { id: 'u1' },
      initialized: true,
      ...baseExtras,
      enrichmentStatus: 'loading'
    }
    const state = authReducer(
      prior,
      fetchEnrichedSessionThunk.fulfilled(
        {
          kind: 'ok',
          profile: { code: 'P1', label: 'Perfil uno' },
          email: 'a@b.cl',
          name: 'Juan Pérez',
          company: null,
          mustChangePassword: false,
          isActive: null,
          navigation: {
            tree: [],
            routes: [{ code: 'R1', routePath: '/app/dashboard', label: 'D', moduleTitle: 'D', sortOrder: 1 }]
          }
        },
        'req-id',
        undefined
      )
    )
    expect(state.enrichedName).toBe('Juan Pérez')
  })

  it('fetchEnrichedSession fulfilled ok with empty routes sets empty_navigation', () => {
    const prior = {
      session: { access_token: 't', user: { id: 'u1' } },
      user: { id: 'u1' },
      initialized: true,
      ...baseExtras,
      enrichmentStatus: 'loading'
    }
    const state = authReducer(
      prior,
      fetchEnrichedSessionThunk.fulfilled(
        {
          kind: 'ok',
          profile: { code: 'P1', label: 'Perfil uno' },
          email: 'a@b.cl',
          name: null,
          company: null,
          mustChangePassword: false,
          isActive: null,
          navigation: { tree: [], routes: [] }
        },
        'req-id',
        undefined
      )
    )
    expect(state.enrichmentStatus).toBe('empty_navigation')
  })

  it('fetchEnrichedSession fulfilled ok with empty routes but mustChangePassword stays succeeded', () => {
    const prior = {
      session: { access_token: 't', user: { id: 'u1' } },
      user: { id: 'u1' },
      initialized: true,
      ...baseExtras,
      enrichmentStatus: 'loading'
    }
    const state = authReducer(
      prior,
      fetchEnrichedSessionThunk.fulfilled(
        {
          kind: 'ok',
          profile: { code: 'CONTADOR', label: 'Contador' },
          email: 'a@b.cl',
          name: null,
          company: null,
          mustChangePassword: true,
          isActive: true,
          navigation: { tree: [], routes: [] }
        },
        'req-id',
        undefined
      )
    )
    expect(state.enrichmentStatus).toBe('succeeded')
    expect(state.mustChangePassword).toBe(true)
  })

  it('fetchEnrichedSession fulfilled no_profile sets missing_profile', () => {
    const prior = {
      session: { access_token: 't', user: { id: 'u1' } },
      user: { id: 'u1' },
      initialized: true,
      ...baseExtras,
      enrichmentStatus: 'loading'
    }
    const state = authReducer(
      prior,
      fetchEnrichedSessionThunk.fulfilled({ kind: 'no_profile', email: 'a@b.cl' }, 'req-id', undefined)
    )
    expect(state.enrichmentStatus).toBe('missing_profile')
    expect(state.enrichedProfile).toBeNull()
    expect(state.enrichedEmail).toBe('a@b.cl')
  })

  it('fetchEnrichedSession fulfilled accountant_inactive sets status', () => {
    const prior = {
      session: { access_token: 't', user: { id: 'u1' } },
      user: { id: 'u1' },
      initialized: true,
      ...baseExtras,
      enrichmentStatus: 'loading'
    }
    const state = authReducer(
      prior,
      fetchEnrichedSessionThunk.fulfilled({ kind: 'accountant_inactive', email: 'x@y.cl' }, 'req-id', undefined)
    )
    expect(state.enrichmentStatus).toBe('accountant_inactive')
    expect(state.enrichedIsActive).toBe(false)
  })
})
