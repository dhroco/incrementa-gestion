import { useMemo, useState } from 'react'
import { ShellContext } from './shell-context'

export function ShellProvider({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [subHeaderActions, setSubHeaderActions] = useState(null)
  const [subHeaderTitle, setSubHeaderTitle] = useState(null)
  const [subHeaderBreadcrumb, setSubHeaderBreadcrumb] = useState(null)

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      collapseSidebar: () => setSidebarCollapsed(true),
      expandSidebar: () => setSidebarCollapsed(false),
      subHeaderActions,
      setSubHeaderActions,
      subHeaderTitle,
      setSubHeaderTitle,
      subHeaderBreadcrumb,
      setSubHeaderBreadcrumb,
    }),
    [sidebarCollapsed, subHeaderActions, subHeaderTitle, subHeaderBreadcrumb],
  )

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}
