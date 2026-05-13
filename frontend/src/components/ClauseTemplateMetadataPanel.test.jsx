/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { ClauseTemplateMetadataPanel } from './ClauseTemplateMetadataPanel'

describe('ClauseTemplateMetadataPanel', () => {
  it('inicia contraído con botón expandir (solo icono, aria-expanded false)', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    act(() => {
      root.render(
        <ClauseTemplateMetadataPanel defaultExpanded={false} code="C1" primaryLabel="Mi título" entityKind="clause">
          <div className="inner-meta">Metadatos</div>
        </ClauseTemplateMetadataPanel>
      )
    })
    const expandBtn = el.querySelector('button[aria-expanded="false"]')
    expect(expandBtn).toBeTruthy()
    expect(expandBtn?.getAttribute('aria-label') ?? '').toMatch(/Expandir metadatos/)
    const hiddenRegion = el.querySelector('.clause-metadata-panel__body-wrap[hidden]')
    expect(hiddenRegion).toBeTruthy()
    root.unmount()
    el.remove()
  })

  it('al expandir muestra aria-expanded true en el botón contraer', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const root = createRoot(el)
    act(() => {
      root.render(
        <ClauseTemplateMetadataPanel defaultExpanded={false} code="X" primaryLabel="Y" entityKind="template">
          <div>Body</div>
        </ClauseTemplateMetadataPanel>
      )
    })
    const expandBtn = el.querySelector('button[aria-expanded="false"]')
    expect(expandBtn).toBeTruthy()
    act(() => {
      expandBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const collapseBtn = el.querySelector('button[aria-expanded="true"]')
    expect(collapseBtn).toBeTruthy()
    expect(collapseBtn?.getAttribute('aria-label') ?? '').toMatch(/Contraer metadatos/)
    expect(el.querySelector('.clause-metadata-panel__body-wrap[hidden]')).toBeNull()
    root.unmount()
    el.remove()
  })
})
