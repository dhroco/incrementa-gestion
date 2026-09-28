/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { configureStore } from '@reduxjs/toolkit'
import { AppSubHeader } from './AppSubHeader'
import { ShellProvider } from './ShellProvider'
import { authReducer } from '../store/authSlice'

function makeStore() {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        user: null,
        initialized: true,
        globalMessage: null,
        signOutError: null,
        enrichmentStatus: 'succeeded',
        enrichmentError: null,
        enrichedEmail: null,
        enrichedProfile: null,
        enrichedCompany: null,
        enrichedIsActive: null,
        avatarUrl: null,
        contactEmail: null,
        widgetPreferences: null,
      },
    },
  })
}

describe('AppSubHeader', () => {
  it('renders the nav icon for a resolved menu match', async () => {
    const store = makeStore()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)

    await act(async () => {
      flushSync(() => {
        root.render(
          <Provider store={store}>
            <MemoryRouter initialEntries={['/app/dashboard']}>
              <ShellProvider>
                <AppSubHeader />
              </ShellProvider>
            </MemoryRouter>
          </Provider>
        )
      })
    })

    const iconSlot = el.querySelector('.app-subheader__nav-icon')
    expect(iconSlot?.querySelector('svg')).toBeTruthy()

    root.unmount()
    document.body.removeChild(el)
  })
})
