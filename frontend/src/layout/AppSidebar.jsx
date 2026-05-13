import { useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink } from 'react-router-dom'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { mapApiNavTreeToSidebarItems } from '../navigation/authorizationSelectors'
import { getSidebarIconForNavItem } from '../navigation/sidebarIconography.jsx'
import { fixSpanishMojibake } from '../utils/fixMojibake'
import {
  selectEnrichedEmail,
  selectEnrichedName,
  selectEnrichedNavigation,
  selectEnrichedProfile,
  selectEnrichmentError,
  selectEnrichmentStatus,
  selectUser
} from '../store/authSlice'
import { MSG_NAV_MENU_EMPTY } from '../navigation/navigationMessages'
import { fetchEnrichedSessionThunk, signOutThunk } from '../store/authSlice'
import { useShell } from './useShell'

function Chevron({ expanded }) {
  return (
    <span
      className={`sidebar-nav__chevron${expanded ? ' sidebar-nav__chevron--open' : ''}`}
      aria-hidden="true"
    >
      <ChevronRightIcon sx={{ fontSize: 18 }} />
    </span>
  )
}

function SidebarEmptyMenuActions({ onRetry }) {
  const dispatch = useDispatch()
  return (
    <div className="sidebar-nav__state-actions">
      <button type="button" className="sidebar-nav__retry" onClick={onRetry}>
        Reintentar
      </button>
      <button type="button" className="sidebar-nav__retry" onClick={() => dispatch(signOutThunk())}>
        Salir
      </button>
    </div>
  )
}

export function AppSidebar() {
  const { collapseSidebar } = useShell()
  const dispatch = useDispatch()
  const user = useSelector(selectUser)
  const enrichedEmail = useSelector(selectEnrichedEmail)
  const enrichedName = useSelector(selectEnrichedName)
  const enrichedProfile = useSelector(selectEnrichedProfile)
  const enrichmentStatus = useSelector(selectEnrichmentStatus)
  const enrichmentError = useSelector(selectEnrichmentError)
  const navigation = useSelector(selectEnrichedNavigation)

  const navStructure = useMemo(() => {
    if (enrichmentStatus !== 'succeeded' || !navigation?.tree) return []
    return mapApiNavTreeToSidebarItems(navigation.tree)
  }, [enrichmentStatus, navigation])

  const [openGroups, setOpenGroups] = useState(() => ({}))

  const displayIdentity = useMemo(() => {
    const n = typeof enrichedName === 'string' ? enrichedName.trim() : ''
    if (n) return n
    return enrichedEmail ?? user?.email ?? '—'
  }, [enrichedName, enrichedEmail, user?.email])
  const profileLine =
    enrichmentStatus === 'idle' || enrichmentStatus === 'loading'
      ? 'Cargando sesión…'
      : fixSpanishMojibake(enrichedProfile?.label ?? '—')

  function toggleGroup(id) {
    setOpenGroups((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  function retryEnrichment() {
    dispatch(fetchEnrichedSessionThunk())
  }

  return (
    <aside className="app-sidebar" aria-label="Navegación principal">
      <div className="app-sidebar__inner">
        <div className="app-sidebar__header">
          <button
            id="closeSidebarBtn"
            type="button"
            className="app-sidebar__toggle"
            onClick={collapseSidebar}
            aria-label="Ocultar menú"
          >
            ×
          </button>
        </div>

        <div className="sidebar-identity" aria-label="Usuario conectado">
          <div className="sidebar-identity__name">{displayIdentity}</div>
          <div className="sidebar-identity__profile">{profileLine}</div>
        </div>

        <div className="app-sidebar__identity-sep" role="separator" aria-hidden="true" />

        <nav className="sidebar-nav menu" id="sidebarMenu" aria-label="Menú">
          {enrichmentStatus === 'idle' || enrichmentStatus === 'loading' ? (
            <div className="sidebar-nav__state">Cargando menú…</div>
          ) : enrichmentStatus === 'failed' ? (
            <div className="sidebar-nav__state">
              <div>
                {enrichmentError || 'No se pudo cargar el menú. Intente nuevamente.'}
              </div>
              <div className="sidebar-nav__state-actions">
                <button type="button" className="sidebar-nav__retry" onClick={retryEnrichment}>
                  Reintentar
                </button>
              </div>
            </div>
          ) : enrichmentStatus === 'empty_navigation' ? (
            <div className="sidebar-nav__state">
              <div>{MSG_NAV_MENU_EMPTY}</div>
              <SidebarEmptyMenuActions onRetry={retryEnrichment} />
            </div>
          ) : navStructure.length === 0 ? (
            <div className="sidebar-nav__state">
              <div>{MSG_NAV_MENU_EMPTY}</div>
              <SidebarEmptyMenuActions onRetry={retryEnrichment} />
            </div>
          ) : (
            <ul className="sidebar-nav__list">
              {navStructure.map((item) => {
                if (item.type === 'link') {
                  const { Component: Icon } = getSidebarIconForNavItem({ code: null, routePath: item.path })
                  return (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          `sidebar-nav__link${isActive ? ' sidebar-nav__link--active' : ''}`
                        }
                      >
                        <span className="sidebar-nav__icon" aria-hidden="true">
                          <Icon />
                        </span>
                        <span>{fixSpanishMojibake(item.label)}</span>
                      </NavLink>
                    </li>
                  )
                }
                if (item.type === 'group') {
                  const expanded = Boolean(openGroups[item.id])
                  return (
                    <li key={item.id} className="sidebar-nav__group">
                      <button
                        type="button"
                        className="sidebar-nav__group-toggle"
                        onClick={() => toggleGroup(item.id)}
                        aria-expanded={expanded}
                      >
                        <span>{fixSpanishMojibake(item.label)}</span>
                        <Chevron expanded={expanded} />
                      </button>
                      {expanded ? (
                        <div className="sidebar-nav__submenus menu__submenus">
                          <ul className="sidebar-nav__sublist">
                            {item.children.map((child) => (
                              <li key={child.id}>
                                {child.path ? (
                                  <NavLink
                                    to={child.path}
                                    className={({ isActive }) =>
                                      `sidebar-nav__sublink${isActive ? ' sidebar-nav__sublink--active' : ''}`
                                    }
                                  >
                                    <span className="sidebar-nav__icon" aria-hidden="true">
                                      {(() => {
                                        const { Component: Icon } = getSidebarIconForNavItem({
                                          code: child.id,
                                          routePath: child.path
                                        })
                                        return <Icon />
                                      })()}
                                    </span>
                                    <span>{fixSpanishMojibake(child.label)}</span>
                                  </NavLink>
                                ) : (
                                  <span className="sidebar-nav__sublink sidebar-nav__sublink--disabled">
                                    <span className="sidebar-nav__icon" aria-hidden="true">
                                      {(() => {
                                        const { Component: Icon } = getSidebarIconForNavItem({
                                          code: child.id,
                                          routePath: null
                                        })
                                        return <Icon />
                                      })()}
                                    </span>
                                    <span>{fixSpanishMojibake(child.label)}</span>
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </li>
                  )
                }
                return null
              })}
            </ul>
          )}
        </nav>
      </div>
    </aside>
  )
}
