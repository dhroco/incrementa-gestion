import { describe, expect, it } from 'vitest'
import {
  getModuleTitleFromMenuConfig,
  resolveMenuMatchForPathname,
  buildVisibleMenuFromConfig
} from './menuConfig'

describe('menuConfig helpers', () => {
  it('returns module title for known path', () => {
    expect(getModuleTitleFromMenuConfig('/app/admin-global/empresas')).toBe('Empresas')
    expect(getModuleTitleFromMenuConfig('/app/admin-global/empresas/123')).toBe('Empresas')
  })

  it('resolveMenuMatchForPathname returns nav code and path', () => {
    const m = resolveMenuMatchForPathname('/app/proveedores/abc')
    expect(m?.routePath).toBe('/app/proveedores')
    expect(m?.moduleTitle).toBe('Proveedores')
  })

  it('buildVisibleMenuFromConfig filters by ability', () => {
    const can = (action, subject) => action === 'read' && subject === 'Company'
    const visible = buildVisibleMenuFromConfig(can)
    const admin = visible.find((g) => g.id === 'admin_global')
    expect(admin?.children.some((c) => c.id === 'empresas')).toBe(true)
    expect(admin?.children.some((c) => c.id === 'proveedores')).toBe(false)
  })

  it('buildVisibleMenuFromConfig always includes Mi perfil under Configuración', () => {
    const visible = buildVisibleMenuFromConfig(() => false)
    const config = visible.find((g) => g.id === 'configuracion')
    expect(config?.label).toBe('Configuración')
    expect(config?.children.some((c) => c.id === 'mi_perfil' && c.path === '/app/mi-perfil')).toBe(true)
  })

  it('getModuleTitleFromMenuConfig resolves Mi perfil', () => {
    expect(getModuleTitleFromMenuConfig('/app/mi-perfil')).toBe('Mi perfil')
  })
})

describe('normalizeRoutePath', () => {
  it('normalizes trailing slash', async () => {
    const { normalizeRoutePath } = await import('./authorizationSelectors')
    expect(normalizeRoutePath('/app/foo/')).toBe('/app/foo')
    expect(normalizeRoutePath('/')).toBe('/')
  })
})
