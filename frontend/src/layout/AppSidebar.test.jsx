// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import { MSG_NAV_MENU_EMPTY } from '../navigation/navigationMessages'
import { AppSidebar } from './AppSidebar'
import { ShellProvider } from './ShellProvider'
import { authReducer } from '../store/authSlice'
import { AbilityContext, ability } from '../lib/ability'

vi.mock('../api/enrichedSessionApi', () => ({
  fetchEnrichedSession: vi.fn(async () => ({
    ok: false,
    status: 500,
    body: { message: 'boom' }
  }))
}))

function makeStore(authOverrides) {
  const baseAuth = authReducer(undefined, { type: '@@init' })
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { ...baseAuth, ...authOverrides } }
  })
  return store
}

function renderWith({ auth, initialEntries = ['/app'], rules = [{ action: 'manage', subject: 'all' }] }) {
  ability.update(rules)
  const store = makeStore(auth)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(
      <Provider store={store}>
        <AbilityContext.Provider value={ability}>
          <ShellProvider>
            <MemoryRouter initialEntries={initialEntries}>
              <AppSidebar />
            </MemoryRouter>
          </ShellProvider>
        </AbilityContext.Provider>
      </Provider>
    )
  })

  return {
    store,
    container,
    unmount() {
      act(() => root.unmount())
      container.remove()
      ability.update([])
    }
  }
}

function getGroupToggle(container, label) {
  const btns = Array.from(container.querySelectorAll('button.sidebar-nav__group-toggle'))
  return btns.find((b) => b.textContent?.includes(label))
}

describe('AppSidebar', () => {
  beforeEach(() => {
    ability.update([])
  })

  it('lets the user open/close groups independently', () => {
    const { container, unmount } = renderWith({
      auth: {
        user: { id: 'u1', email: 'a@b.com' },
        enrichmentStatus: 'succeeded',
        enrichedEmail: 'a@b.com',
        enrichedProfile: { code: 'P', label: 'Perfil' }
      }
    })

    const admin = getGroupToggle(container, 'Administración Global')
    const contratos = getGroupToggle(container, 'Gestión de Contratos')
    expect(admin).toBeTruthy()
    expect(contratos).toBeTruthy()

    act(() => admin.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(admin.getAttribute('aria-expanded')).toBe('true')
    expect(contratos.getAttribute('aria-expanded')).toBe('false')

    act(() => contratos.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(admin.getAttribute('aria-expanded')).toBe('true')
    expect(contratos.getAttribute('aria-expanded')).toBe('true')

    unmount()
  })

  it('renders loading/error/empty states', () => {
    {
      const { container, unmount } = renderWith({
        auth: {
          session: { accessToken: 't', user: { id: 'u1', email: 'a@b.com' } },
          user: { id: 'u1', email: 'a@b.com' },
          enrichmentStatus: 'loading'
        }
      })
      expect(container.textContent).toContain('Cargando menú…')
      unmount()
    }

    {
      const { container, unmount } = renderWith({
        auth: {
          session: { accessToken: 't', user: { id: 'u1', email: 'a@b.com' } },
          user: { id: 'u1', email: 'a@b.com' },
          enrichmentStatus: 'failed',
          enrichmentError: 'Fallo técnico'
        }
      })
      expect(container.textContent).toContain('Fallo técnico')
      unmount()
    }

    {
      const { container, unmount } = renderWith({
        auth: {
          session: { accessToken: 't', user: { id: 'u1', email: 'a@b.com' } },
          user: { id: 'u1', email: 'a@b.com' },
          enrichmentStatus: 'empty_navigation'
        }
      })
      expect(container.textContent).toContain('Configuración')
      expect(container.textContent).toContain('Inicio')
      unmount()
    }
  })

  it('renders submenu links from static menu config', () => {
    const { container, unmount } = renderWith({
      initialEntries: ['/app/admin-global/empresas'],
      auth: {
        user: { id: 'u1', email: 'a@b.com' },
        enrichmentStatus: 'succeeded',
        enrichedProfile: { code: 'P', label: 'Perfil' }
      }
    })

    const admin = getGroupToggle(container, 'Administración Global')
    act(() => admin.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(container.textContent).toContain('Empresas')
    expect(container.querySelector('a[href="/app/admin-global/empresas"]')).toBeTruthy()

    unmount()
  })

  it('renders Configuración > Mi perfil without module permissions', () => {
    const { container, unmount } = renderWith({
      initialEntries: ['/app/mi-perfil'],
      rules: [],
      auth: {
        user: { id: 'u1', email: 'a@b.com' },
        enrichmentStatus: 'empty_navigation',
        enrichedProfile: { code: 'P', label: 'Perfil' }
      }
    })

    const config = getGroupToggle(container, 'Configuración')
    expect(config).toBeTruthy()
    act(() => config.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.textContent).toContain('Mi perfil')
    expect(container.querySelector('a[href="/app/mi-perfil"]')).toBeTruthy()

    unmount()
  })
})
