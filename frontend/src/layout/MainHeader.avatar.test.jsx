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
import { MainHeader } from './MainHeader'
import { authReducer } from '../store/authSlice'
import defaultAvatarUrl from '../assets/images/user-avatar-default.svg'

function makeStore(avatarUrl) {
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
        avatarUrl,
        contactEmail: null,
        widgetPreferences: null
      }
    }
  })
}

async function render(avatarUrl) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  const draw = async (url) => {
    await act(async () => {
      flushSync(() => {
        root.render(
          <Provider store={makeStore(url)}>
            <MemoryRouter initialEntries={['/app/dashboard']}>
              <MainHeader />
            </MemoryRouter>
          </Provider>
        )
      })
    })
  }
  await draw(avatarUrl)
  return {
    img: () => el.querySelector('.user-avatar__img'),
    draw,
    unmount() {
      root.unmount()
      el.remove()
    }
  }
}

async function failToLoad(img) {
  await act(async () => {
    img.dispatchEvent(new Event('error'))
  })
}

describe('MainHeader avatar', () => {
  it('sin foto muestra el avatar por defecto', async () => {
    const view = await render(null)
    expect(view.img().getAttribute('src')).toBe(defaultAvatarUrl)
    expect(view.img().className).not.toContain('user-avatar__img--photo')
    view.unmount()
  })

  it('con foto muestra la foto', async () => {
    const view = await render('https://almacen.test/avatars/ana.jpg?sig=1')
    expect(view.img().getAttribute('src')).toBe('https://almacen.test/avatars/ana.jpg?sig=1')
    expect(view.img().className).toContain('user-avatar__img--photo')
    view.unmount()
  })

  it('si la foto no carga (el archivo no existe en este ambiente), vuelve al avatar por defecto', async () => {
    const view = await render('https://almacen.test/avatars/no-existe.jpg?sig=1')
    await failToLoad(view.img())
    expect(view.img().getAttribute('src')).toBe(defaultAvatarUrl)
    expect(view.img().className).not.toContain('user-avatar__img--photo')
    view.unmount()
  })

  it('un error del avatar por defecto no provoca un bucle', async () => {
    const view = await render(null)
    await failToLoad(view.img())
    expect(view.img().getAttribute('src')).toBe(defaultAvatarUrl)
    view.unmount()
  })

  it('si luego llega otra foto distinta, se intenta cargar esa', async () => {
    const view = await render('https://almacen.test/avatars/vieja.jpg')
    await failToLoad(view.img())
    expect(view.img().getAttribute('src')).toBe(defaultAvatarUrl)
    await view.draw('https://almacen.test/avatars/nueva.jpg')
    expect(view.img().getAttribute('src')).toBe('https://almacen.test/avatars/nueva.jpg')
    view.unmount()
  })
})
