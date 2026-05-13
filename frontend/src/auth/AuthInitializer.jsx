import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { fetchEnrichedSessionThunk, sessionUpdated, setInitialized } from '../store/authSlice'
import { supabase } from './supabaseClient'

/**
 * Loads initial session and subscribes to Supabase auth state changes.
 */
export function AuthInitializer() {
  const dispatch = useDispatch()

  useEffect(() => {
    let cancelled = false
    let subscription = null

    ;(async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (cancelled) return
      dispatch(sessionUpdated(session))
      dispatch(setInitialized(true))
      if (session?.access_token) {
        dispatch(fetchEnrichedSessionThunk())
      }

      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (!cancelled) {
          dispatch(sessionUpdated(nextSession))
          if (nextSession?.access_token) {
            dispatch(fetchEnrichedSessionThunk())
          }
        }
      })
      subscription = data.subscription
    })()

    return () => {
      cancelled = true
      subscription?.unsubscribe()
    }
  }, [dispatch])

  return null
}
