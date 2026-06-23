import { describe, expect, it, vi, beforeEach } from 'vitest'

import { invalidateSessionThunk } from './authSlice'

vi.mock('../auth/msalInstance', () => ({
  msalInstance: {
    logoutRedirect: vi.fn(async () => undefined)
  }
}))

describe('invalidateSessionThunk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches sign out flow and sets global message', async () => {
    const dispatch = vi.fn((action) => {
      if (typeof action === 'function') {
        return action(dispatch, getState, undefined)
      }
      return action
    })
    const getState = () => ({
      auth: {
        user: { id: 'u1', email: 'a@b.cl' },
        initialized: true
      }
    })

    await invalidateSessionThunk({ reason: 'unauthorized' })(dispatch, getState, undefined)

    const dispatchedTypes = dispatch.mock.calls.map((c) => c?.[0]?.type).filter(Boolean)
    expect(dispatchedTypes).toContain('auth/setAuthGlobalMessage')
    expect(dispatchedTypes).toContain('auth/signOut/pending')
  })
})
