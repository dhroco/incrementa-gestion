/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { ClauseCompanyCreatePage } from './ClauseCompanyCreatePage'
import { ShellProvider } from '../layout/ShellProvider'
import { SubheaderActionsDump } from './__testonly__/SubheaderActionsDump'
import { store } from '../store/store'

describe('ClauseCompanyCreatePage', () => {
  it('does not ask for company id', async () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    await act(async () => {
      flushSync(() => {
        root.render(
          <Provider store={store}>
            <MemoryRouter initialEntries={['/app/gestion-contratos/clausulas-por-empresa/nueva']}>
              <ShellProvider>
                <SubheaderActionsDump />
                <ClauseCompanyCreatePage />
              </ShellProvider>
            </MemoryRouter>
          </Provider>
        )
      })
    })
    const html = el.innerHTML.toLowerCase()
    expect(html).toContain('guardar')
    expect(html).not.toContain('empresa (id)')
    expect(html).not.toContain('uuid de la empresa')
    root.unmount()
    document.body.removeChild(el)
  })
})
