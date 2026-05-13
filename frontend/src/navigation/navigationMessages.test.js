import { describe, expect, it } from 'vitest'
import { MSG_NAV_MENU_EMPTY } from './navigationMessages'

describe('navigationMessages', () => {
  it('exposes non-empty menu-empty copy for es-CL UX', () => {
    expect(MSG_NAV_MENU_EMPTY.length).toBeGreaterThan(10)
    expect(MSG_NAV_MENU_EMPTY).toMatch(/administrador/i)
  })
})
