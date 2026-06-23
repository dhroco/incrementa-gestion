import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { msalInstance } from './msalInstance'
import { msalUserFromAccount } from './msalToken'
import { fetchEnrichedSessionThunk, setInitialized, setMsalUser } from '../store/authSlice'
import { AuthLoadingScreen } from '../routes/AuthLoadingScreen'

/**
 * Handles MSAL redirect return, active account selection, and enriched session bootstrap.
 */
export function AuthInitializer({ children }) {
  const dispatch = useDispatch()
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      await msalInstance.initialize()
      const response = await msalInstance.handleRedirectPromise()
      const account = response?.account ?? msalInstance.getAllAccounts()[0] ?? null
      if (account) {
        msalInstance.setActiveAccount(account)
        dispatch(setMsalUser(msalUserFromAccount(account)))
        await dispatch(fetchEnrichedSessionThunk())
      }
      dispatch(setInitialized(true))
      if (!cancelled) {
        setBootstrapped(true)
      }
    }

    bootstrap().catch(() => {
      dispatch(setInitialized(true))
      if (!cancelled) {
        setBootstrapped(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [dispatch])

  if (!bootstrapped) {
    return <AuthLoadingScreen />
  }

  return children
}
