import './AppShellLayout.css'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from './AppSidebar'
import { AppSubHeader } from './AppSubHeader'
import { MainHeader } from './MainHeader'
import { useShell } from './useShell'

export function AppShellLayout() {
  const { sidebarCollapsed } = useShell()

  return (
    <div className={`app-shell${sidebarCollapsed ? ' app-shell--sidebar-collapsed' : ''}`}>
      <MainHeader />
      <div className="app-shell__body">
        <AppSidebar />
        <div className="app-shell__main">
          <AppSubHeader />
          <main className="app-shell__content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
