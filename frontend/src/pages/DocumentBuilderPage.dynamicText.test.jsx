/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { useState } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { MissingFieldInput } from './DocumentBuilderPage'

const FIELD = {
  key: 'servicios_entregables',
  label: 'Entregables (cláusula 2.3)',
  type: 'dynamic_text',
  instruccion:
    'Escribe qué publicará el influencer: cantidad en palabras y en cifra, formato y red social de cada entregable.',
  ejemplos: [
    'un (1) reel en Instagram',
    'cinco (5) reels en TikTok y cuatro (4) reels en Facebook',
    'dos (2) stories y un (1) reel en Instagram'
  ],
  contexto:
    'En concreto, los Servicios comprenden la generación y publicación de ⟨…⟩ en el perfil oficial {{client_product_campaign}}.'
}

function Harness({ initial = '' }) {
  const [value, setValue] = useState(initial)
  return <MissingFieldInput field={FIELD} value={value} overrides={{}} onChange={setValue} />
}

function renderHarness(initial = '') {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => {
    flushSync(() => {
      root.render(<Harness initial={initial} />)
    })
  })
  return {
    el,
    cleanup() {
      act(() => {
        root.unmount()
      })
      el.remove()
    }
  }
}

describe('MissingFieldInput dynamic text', () => {
  it('Empty dynamic text shows instruction, examples, and the hole', () => {
    const { el, cleanup } = renderHarness('')
    const textarea = el.querySelector('textarea')
    expect(textarea).toBeTruthy()
    expect(textarea.getAttribute('rows')).toBe('3')
    expect(textarea.maxLength).toBe(500)
    expect(textarea.className).toContain('clause-input')
    expect(el.textContent).toContain(FIELD.instruccion)
    for (const ejemplo of FIELD.ejemplos) {
      expect(el.textContent).toContain(ejemplo)
    }
    expect(el.textContent).toContain('Ejemplos:')
    expect(el.textContent).toContain('0 / 500')
    const highlight = el.querySelector('.db-dynamic-text__highlight')
    expect(highlight).toBeTruthy()
    expect(highlight.textContent).toBe('…')
    expect(el.textContent).not.toContain('⟨…⟩')
    cleanup()
  })

  it('Typing updates the preview and the counter', () => {
    const { el, cleanup } = renderHarness('')
    const textarea = el.querySelector('textarea')
    const typed = 'cinco (5) reels'
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(textarea, typed)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(textarea.value).toBe(typed)
    expect(el.querySelector('.db-dynamic-text__highlight').textContent).toBe(typed)
    expect(el.textContent).toContain(`${typed.length} / 500`)
    cleanup()
  })

  it('An example is not inserted on click', () => {
    const { el, cleanup } = renderHarness('')
    const textarea = el.querySelector('textarea')
    const example = [...el.querySelectorAll('li')].find(
      (item) => item.textContent === 'un (1) reel en Instagram'
    )
    expect(example).toBeTruthy()
    act(() => {
      example.click()
    })
    expect(textarea.value).toBe('')
    expect(el.querySelector('.db-dynamic-text__highlight').textContent).toBe('…')
    cleanup()
  })
})
