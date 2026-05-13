import { describe, expect, it } from 'vitest'
import { getSidebarIconForNavItem } from './sidebarIconography.jsx'

describe('getSidebarIconForNavItem', () => {
  it('returns known icon by legacy code', () => {
    const { name } = getSidebarIconForNavItem({ code: 'NAV_USUARIOS', routePath: '/app/whatever' })
    expect(name).toBe('manage_accounts')
  })

  it('returns icon by NAV_ITEM code', () => {
    expect(getSidebarIconForNavItem({ code: 'NAV_ITEM_INICIO_BANDEJA_TAREAS' }).name).toBe('inbox')
    expect(getSidebarIconForNavItem({ code: 'NAV_ITEM_CONTRATOS_PLANTILLAS' }).name).toBe('library_books')
  })

  it('falls back to routePath mapping when code is unknown', () => {
    const { name } = getSidebarIconForNavItem({ code: 'UNKNOWN', routePath: '/app/dashboard/' })
    expect(name).toBe('dashboard')
  })

  it('returns fallback when unknown', () => {
    const { name } = getSidebarIconForNavItem({ code: 'UNKNOWN', routePath: '/app/ruta-sin-mapear' })
    expect(name).toBe('fallback')
  })
})
