import { useEffect } from 'react'
import { useShell } from './useShell'

/**
 * Registers a sub-header title override for the current page.
 * Cleared on unmount.
 */
export function useSubHeaderTitle(title) {
  const { setSubHeaderTitle } = useShell()

  useEffect(() => {
    setSubHeaderTitle(typeof title === 'string' && title.trim().length ? title : null)
    return () => setSubHeaderTitle(null)
  }, [title, setSubHeaderTitle])
}

