/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { ClauseCompanyListPage } from './ClauseCompanyListPage'
import { ShellProvider } from '../layout/ShellProvider'
import { SubheaderActionsDump } from './__testonly__/SubheaderActionsDump'
import { store } from '../store/store'

describe('ClauseCompanyListPage', () => {
  it('renders page title and CTA', async () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    await act(async () => {
      flushSync(() => {
        root.render(
          <Provider store={store}>
            <MemoryRouter initialEntries={['/app/gestion-contratos/clausulas-por-empresa']}>
              <ShellProvider>
                <SubheaderActionsDump />
                <ClauseCompanyListPage />
              </ShellProvider>
            </MemoryRouter>
          </Provider>
        )
      })
    })
    expect(el.textContent).toMatch(/catálogo de cláusulas aplicables/i)
    expect(el.textContent).toMatch(/nueva cláusula/i)
    root.unmount()
    document.body.removeChild(el)
  })
})
