/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import VariableCatalog from './VariableCatalog'

const CUENTAS_INSTRUCCION =
  'Escribe la cuenta del influencer en cada red social nombrada en los entregables.'

describe('VariableCatalog dynamic text', () => {
  it('Catalog modal labels the type', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    act(() => {
      flushSync(() => {
        root.render(
          <VariableCatalog isOpen onClose={() => {}} onVariableSelect={() => {}} />
        )
      })
    })

    const label = [...el.querySelectorAll('span')].find(
      (node) => node.textContent === 'Cuentas de publicación (cláusula 2.5)'
    )
    expect(label).toBeTruthy()
    const row = label.closest('div').parentElement
    expect(row.textContent).toContain('Texto dinámico')
    expect(row.textContent).toContain(CUENTAS_INSTRUCCION)

    act(() => {
      root.unmount()
    })
    el.remove()
  })
})