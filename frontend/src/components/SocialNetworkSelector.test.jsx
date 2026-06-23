/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { SocialNetworkSelector } from '../components/SocialNetworkSelector'
import {
  socialNetworksForSubmit,
  validateSocialNetworksForForm
} from '../pages/SupplierFormSections'

const CATALOG_ID = '11111111-1111-1111-1111-111111111111'

vi.mock('../api/suppliersApi', () => ({
  fetchSocialNetworkCatalog: vi.fn(async () => ({
    ok: true,
    data: {
      items: [
        { id: CATALOG_ID, code: 'instagram', name: 'Instagram', sort_order: 1 },
        { id: '22222222-2222-2222-2222-222222222222', code: 'facebook', name: 'Facebook', sort_order: 2 }
      ]
    }
  }))
}))

describe('SocialNetworkSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads catalog once and toggles network with handle input', async () => {
    const onChange = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      flushSync(() => {
        root.render(
          <SocialNetworkSelector value={[]} onChange={onChange} accessToken="token" />
        )
      })
    })

    await act(async () => {
      await Promise.resolve()
    })

    const toggle = container.querySelector('.social-network-selector-card-toggle')
    expect(toggle).toBeTruthy()

    await act(async () => {
      toggle.click()
    })

    expect(onChange).toHaveBeenCalledWith([
      { catalog_id: CATALOG_ID, account_name: '', code: 'instagram', name: 'Instagram' }
    ])

    root.unmount()
    container.remove()
  })

  it('shows assigned networks in read-only mode', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      flushSync(() => {
        root.render(
          <SocialNetworkSelector
            readOnly
            accessToken="token"
            value={[
              {
                catalog_id: CATALOG_ID,
                account_name: '@miempresa',
                code: 'instagram',
                name: 'Instagram'
              }
            ]}
          />
        )
      })
    })

    expect(container.textContent).toContain('Instagram')
    expect(container.textContent).toContain('@miempresa')

    root.unmount()
    container.remove()
  })
})

describe('supplier social network form helpers', () => {
  it('validates and builds submit payload with catalog_id', () => {
    const list = [{ catalog_id: CATALOG_ID, account_name: '@acme' }]
    expect(validateSocialNetworksForForm(list)).toBeNull()
    expect(socialNetworksForSubmit(list)).toEqual([
      { catalog_id: CATALOG_ID, account_name: '@acme' }
    ])
  })

  it('rejects incomplete network rows', () => {
    expect(
      validateSocialNetworksForForm([{ catalog_id: CATALOG_ID, account_name: '' }])
    ).toBe('Cada red social debe tener red seleccionada y cuenta.')
  })
})
