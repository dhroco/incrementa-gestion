import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { refreshSessionThunk, selectSession } from '../store/authSlice'

const REFRESH_BEFORE_EXPIRY_MS = 60_000

export function SessionKeepAlive() {
  const dispatch = useDispatch()
  const session = useSelector(selectSession)
  const expiresAt = session?.expiresAt ?? null

  useEffect(() => {
    if (!expiresAt) return

    const delay = expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS

    if (delay <= 0) {
      dispatch(refreshSessionThunk())
      return
    }

    const timerId = setTimeout(() => {
      dispatch(refreshSessionThunk())
    }, delay)

    return () => clearTimeout(timerId)
  }, [expiresAt, dispatch])

  return null
}
