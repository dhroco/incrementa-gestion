import { useEffect } from 'react'
import { useShell } from './useShell'

/**
 * Registers sub-header actions for the current page.
 * Actions are cleared on unmount.
 */
export function useSubHeaderActions(node) {
  const { setSubHeaderActions } = useShell()

  useEffect(() => {
    setSubHeaderActions(node ?? null)
    return () => setSubHeaderActions(null)
  }, [node, setSubHeaderActions])
}

