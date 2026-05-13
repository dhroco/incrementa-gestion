import { useContext } from 'react'
import { ShellContext } from './shell-context'

export function useShell() {
  const ctx = useContext(ShellContext)
  if (!ctx) {
    throw new Error('useShell must be used within ShellProvider')
  }
  return ctx
}
