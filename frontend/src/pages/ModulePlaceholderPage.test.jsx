import { describe, expect, it } from 'vitest'
import ReactDOMServer from 'react-dom/server'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { ModulePlaceholderPage } from './ModulePlaceholderPage'
import { ShellProvider } from '../layout/ShellProvider'
import { store } from '../store/store'

describe('ModulePlaceholderPage', () => {
  it('renders title and default "en construcción" subtitle', () => {
    const html = ReactDOMServer.renderToString(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/app/usuarios']}>
          <ShellProvider>
            <ModulePlaceholderPage title="Usuarios" />
          </ShellProvider>
        </MemoryRouter>
      </Provider>
    )
    expect(html).toContain('Usuarios')
    expect(html).toContain('Pantalla en construcción.')
    expect(html.toLowerCase()).toContain('construcción')
  })
})

