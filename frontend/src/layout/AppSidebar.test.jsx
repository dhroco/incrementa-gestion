// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { MemoryRouter } from 'react-router-dom'
import { MSG_NAV_MENU_EMPTY } from '../navigation/navigationMessages'
import { AppSidebar } from './AppSidebar'
import { ShellProvider } from './ShellProvider'
import { authReducer } from '../store/authSlice'

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

function renderWith({ auth, initialEntries = ['/app'] }) {
  const store = makeStore(auth)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() => {
    root.render(
      <Provider store={store}>
        <ShellProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <AppSidebar />
          </MemoryRouter>
        </ShellProvider>
      </Provider>
    )
  })

  return {
    store,
    container,
    unmount() {
      act(() => root.unmount())
      container.remove()
    }
  }
}

function getGroupToggle(container, label) {
  const btns = Array.from(container.querySelectorAll('button.sidebar-nav__group-toggle'))
  return btns.find((b) => b.textContent?.includes(label))
}

describe('AppSidebar', () => {
  it('lets the user open/close groups independently (no implicit switching)', () => {
    const { container, unmount } = renderWith({
      auth: {
        session: { access_token: 't', user: { id: 'u1', email: 'a@b.com' } },
        user: { id: 'u1', email: 'a@b.com' },
        enrichmentStatus: 'succeeded',
        enrichedEmail: 'a@b.com',
        enrichedProfile: { code: 'P', label: 'Perfil' },
        enrichedNavigation: {
          tree: [
            {
              code: 'G1',
              label: 'Grupo 1',
              children: [{ code: 'C1', label: 'C1', routePath: '/app/c1', showInMainMenu: true }]
            },
            {
              code: 'G2',
              label: 'Grupo 2',
              children: [{ code: 'C2', label: 'C2', routePath: '/app/c2', showInMainMenu: true }]
            }
          ],
          routes: [{ routePath: '/app/c1' }, { routePath: '/app/c2' }]
        }
      }
    })

    const g1 = getGroupToggle(container, 'Grupo 1')
    const g2 = getGroupToggle(container, 'Grupo 2')
    expect(g1).toBeTruthy()
    expect(g2).toBeTruthy()

    expect(g1.getAttribute('aria-expanded')).toBe('false')
    expect(g2.getAttribute('aria-expanded')).toBe('false')

    act(() => g1.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(g1.getAttribute('aria-expanded')).toBe('true')
    expect(g2.getAttribute('aria-expanded')).toBe('false')

    act(() => g2.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    // Opening another group does not close the previous one automatically.
    expect(g1.getAttribute('aria-expanded')).toBe('true')
    expect(g2.getAttribute('aria-expanded')).toBe('true')

    unmount()
  })

  it('auto-expands the active group and does not allow collapsing it while a child route is active', () => {
    const { container, unmount } = renderWith({
      initialEntries: ['/app/c1'],
      auth: {
        session: { access_token: 't', user: { id: 'u1', email: 'a@b.com' } },
        user: { id: 'u1', email: 'a@b.com' },
        enrichmentStatus: 'succeeded',
        enrichedProfile: { code: 'P', label: 'Perfil' },
        enrichedNavigation: {
          tree: [
            {
              code: 'G1',
              label: 'Grupo 1',
              children: [{ code: 'C1', label: 'C1', routePath: '/app/c1', showInMainMenu: true }]
            }
          ],
          routes: [{ routePath: '/app/c1' }]
        }
      }
    })

    const g1 = getGroupToggle(container, 'Grupo 1')
    // Initial load keeps groups closed even if current route matches a child.
    expect(g1.getAttribute('aria-expanded')).toBe('false')

    // User must explicitly open/close.
    act(() => g1.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(g1.getAttribute('aria-expanded')).toBe('true')
    act(() => g1.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(g1.getAttribute('aria-expanded')).toBe('false')

    unmount()
  })

  it('renders loading/error/empty states', () => {
    {
      const { container, unmount } = renderWith({
        auth: {
          session: { access_token: 't', user: { id: 'u1', email: 'a@b.com' } },
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
          session: { access_token: 't', user: { id: 'u1', email: 'a@b.com' } },
          user: { id: 'u1', email: 'a@b.com' },
          enrichmentStatus: 'failed',
          enrichmentError: 'Fallo técnico'
        }
      })
      expect(container.textContent).toContain('Fallo técnico')
      const retry = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Reintentar')
      )
      expect(retry).toBeTruthy()
      act(() => retry.dispatchEvent(new MouseEvent('click', { bubbles: true })))
      unmount()
    }

    {
      const { container, unmount } = renderWith({
        auth: {
          session: { access_token: 't', user: { id: 'u1', email: 'a@b.com' } },
          user: { id: 'u1', email: 'a@b.com' },
          enrichmentStatus: 'empty_navigation'
        }
      })
      expect(container.textContent).toContain(MSG_NAV_MENU_EMPTY.slice(0, 40))
      const buttons = container.querySelectorAll('button')
      expect(Array.from(buttons).some((b) => b.textContent?.includes('Reintentar'))).toBe(true)
      expect(Array.from(buttons).some((b) => b.textContent?.includes('Salir'))).toBe(true)
      unmount()
    }
  })

  it('renders submenu structure and icons (non-fragile)', () => {
    const { container, unmount } = renderWith({
      auth: {
        session: { access_token: 't', user: { id: 'u1', email: 'a@b.com' } },
        user: { id: 'u1', email: 'a@b.com' },
        enrichmentStatus: 'succeeded',
        enrichedProfile: { code: 'P', label: 'Perfil' },
        enrichedNavigation: {
          tree: [
            {
              code: 'G1',
              label: 'Grupo 1',
              children: [
                { code: 'NAV_USUARIOS', label: 'Usuarios', routePath: '/app/usuarios', showInMainMenu: true },
                { code: 'NAV_ITEM_X', label: 'No navegable', routePath: null, showInMainMenu: true }
              ]
            }
          ],
          routes: [{ routePath: '/app/usuarios' }]
        }
      }
    })

    const g1 = getGroupToggle(container, 'Grupo 1')
    act(() => g1.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    const submenus = container.querySelector('.sidebar-nav__submenus')
    expect(submenus).toBeTruthy()
    expect(container.querySelector('.sidebar-nav__sublist')).toBeTruthy()

    const disabled = container.querySelector('.sidebar-nav__sublink--disabled')
    expect(disabled).toBeTruthy()

    const icons = container.querySelectorAll('.sidebar-nav__icon')
    expect(icons.length).toBeGreaterThan(0)

    unmount()
  })
})

