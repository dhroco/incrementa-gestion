import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { API_SCOPE } from '../config/msalConfig'
import { msalInstance } from './msalInstance'

export function getActiveMsalAccount() {
  return msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0] ?? null
}

export function msalUserFromAccount(account) {
  if (!account) return null
  const email =
    typeof account.username === 'string' && account.username.trim().length > 0
      ? account.username.trim()
      : null
  const id =
    (typeof account.localAccountId === 'string' && account.localAccountId) ||
    (typeof account.homeAccountId === 'string' && account.homeAccountId) ||
    email
  if (!id) return null
  return { id, email }
}

/**
 * Obtains an API access token for the backend. Returns null when no account
 * exists or when a redirect for interaction has been initiated.
 */
export async function acquireApiAccessToken() {
  const account = getActiveMsalAccount()
  if (!account) return null

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: [API_SCOPE],
      account
    })
    return result.accessToken ?? null
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect({
        scopes: [API_SCOPE],
        account
      })
      return null
    }
    throw err
  }
}
