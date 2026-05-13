import { describe, expect, it, vi } from 'vitest'

vi.mock('../auth/supabaseClient', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(async () => ({ error: null }))
    }
  }
}))

import { invalidateSessionThunk } from './authSlice'

describe('invalidateSessionThunk', () => {
  it('dispatches sessionUpdated(null) and sets global message', async () => {
    const dispatch = vi.fn()
    const getState = () => ({ auth: { session: { access_token: 't' } } })

    // @ts-ignore - minimal thunkAPI
    await invalidateSessionThunk({ reason: 'unauthorized' })(dispatch, getState, undefined)

    const dispatchedTypes = dispatch.mock.calls.map((c) => c?.[0]?.type).filter(Boolean)
    expect(dispatchedTypes).toContain('auth/sessionUpdated')
    expect(dispatchedTypes).toContain('auth/setAuthGlobalMessage')
  })
})

