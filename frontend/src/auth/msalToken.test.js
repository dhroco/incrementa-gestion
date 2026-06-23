import { describe, expect, it, vi, beforeEach } from 'vitest'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { acquireApiAccessToken } from '../auth/msalToken'
import { msalInstance } from '../auth/msalInstance'

vi.mock('../auth/msalInstance', () => ({
  msalInstance: {
    getActiveAccount: vi.fn(),
    getAllAccounts: vi.fn(() => []),
    acquireTokenSilent: vi.fn(),
    acquireTokenRedirect: vi.fn()
  }
}))

describe('acquireApiAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns token on silent acquisition success', async () => {
    const account = { username: 'user@test.com', localAccountId: 'acc-1' }
    msalInstance.getActiveAccount.mockReturnValue(account)
    msalInstance.acquireTokenSilent.mockResolvedValue({ accessToken: 'token-123' })

    await expect(acquireApiAccessToken()).resolves.toBe('token-123')
    expect(msalInstance.acquireTokenSilent).toHaveBeenCalledWith({
      scopes: expect.arrayContaining([expect.stringMatching(/^api:\/\//)]),
      account
    })
  })

  it('returns null when no account exists', async () => {
    msalInstance.getActiveAccount.mockReturnValue(null)
    msalInstance.getAllAccounts.mockReturnValue([])

    await expect(acquireApiAccessToken()).resolves.toBeNull()
  })

  it('redirects when interaction is required', async () => {
    const account = { username: 'user@test.com', localAccountId: 'acc-1' }
    msalInstance.getActiveAccount.mockReturnValue(account)
    msalInstance.acquireTokenSilent.mockRejectedValue(new InteractionRequiredAuthError('interaction'))
    msalInstance.acquireTokenRedirect.mockResolvedValue(undefined)

    await expect(acquireApiAccessToken()).resolves.toBeNull()
    expect(msalInstance.acquireTokenRedirect).toHaveBeenCalled()
  })
})
