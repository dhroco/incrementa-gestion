import { describe, expect, it } from 'vitest'
import {
  buildPrivateModuleRouteDefinitions,
  buildAllowedPathSet,
  buildEffectivePrivateAllowedPathSet,
  buildGrantedCodeSetFromSession,
  getDefaultPrivatePathFromRoutes,
  getDefaultPrivateRelativePathFromRoutes,
  getModuleTitleFromAuthorizationRoutes,
  isPathAllowed,
  mapApiNavTreeToSidebarItems,
  resolveNavRouteMatchForPathname
} from './authorizationSelectors'

describe('buildGrantedCodeSetFromSession', () => {
  it('merges tree codes and flat grantedCodes (action nodes may only appear in list)', () => {
    const set = buildGrantedCodeSetFromSession({
      tree: [{ code: 'NAV_A', children: [] }],
      grantedCodes: ['NAV_ACTION_X']
    })
    expect([...set].sort()).toEqual(['NAV_ACTION_X', 'NAV_A'].sort())
  })
})

describe('buildEffectivePrivateAllowedPathSet', () => {
  it('matches buildAllowedPathSet', () => {
    const routes = [{ routePath: '/app/a' }, { routePath: '/app/b' }]
    expect([...buildEffectivePrivateAllowedPathSet(routes)]).toEqual([...buildAllowedPathSet(routes)])
  })
})

describe('buildAllowedPathSet', () => {
  it('collects routePath values', () => {
    const set = buildAllowedPathSet([
      { routePath: '/app/a' },
      { routePath: '/app/b/' },
      { routePath: '/public/x' },
      { routePath: '/app' },
      { routePath: null }
    ])
    expect(set.has('/app/a')).toBe(true)
    expect(set.has('/app/b')).toBe(true)
    expect(set.has('/public/x')).toBe(false)
    expect(set.has('/app')).toBe(false)
  })
})

describe('buildPrivateModuleRouteDefinitions', () => {
  it('normalizes, filters to /app/*, and deduplicates deterministically', () => {
    const defs = buildPrivateModuleRouteDefinitions([
      { code: 'B', routePath: '/app/a/', label: 'A', sortOrder: 200 },
      { code: 'A', routePath: '/app/a', label: 'A', sortOrder: 100 }, // duplicate after normalization
      { code: 'X', routePath: '/app', label: 'Root' }, // ignored
      { code: 'Y', routePath: '/public/y', label: 'Public' }, // ignored
      { code: 'C', routePath: '/app/c', moduleTitle: 'C title', sortOrder: 300 }
    ])

    expect(defs.map((d) => d.absolutePath)).toEqual(['/app/a', '/app/c'])
    expect(defs.map((d) => d.relativePath)).toEqual(['a', 'c'])
    expect(defs[1].title).toBe('C title')
  })

  it('supports excluding known hardcoded private routes', () => {
    const defs = buildPrivateModuleRouteDefinitions(
      [
        { code: 'D', routePath: '/app/dashboard', label: 'Dashboard' },
        { code: 'U', routePath: '/app/usuarios', label: 'Usuarios' }
      ],
      { excludeRelativePaths: new Set(['dashboard']) }
    )
    expect(defs.map((d) => d.relativePath)).toEqual(['usuarios'])
  })
})

describe('getDefaultPrivatePathFromRoutes', () => {
  it('prefers main menu route', () => {
    const p = getDefaultPrivatePathFromRoutes([
      { code: 'x', routePath: '/app/mi-perfil', showInMainMenu: false, sortOrder: 900 },
      { code: 'd', routePath: '/app/dashboard', showInMainMenu: true, sortOrder: 100 }
    ])
    expect(p).toBe('/app/dashboard')
  })
})

describe('getDefaultPrivateRelativePathFromRoutes', () => {
  it('returns segment after /app/', () => {
    expect(
      getDefaultPrivateRelativePathFromRoutes([
        { code: 'd', routePath: '/app/dashboard', showInMainMenu: true, sortOrder: 100 }
      ])
    ).toBe('dashboard')
  })

  it('returns null when no valid paths', () => {
    expect(getDefaultPrivateRelativePathFromRoutes([{ code: 'x', routePath: null }])).toBe(null)
  })
})

describe('getModuleTitleFromAuthorizationRoutes', () => {
  it('returns moduleTitle for matching path', () => {
    const t = getModuleTitleFromAuthorizationRoutes('/app/contratos', [
      { routePath: '/app/contratos', moduleTitle: 'Contratos', label: 'C' }
    ])
    expect(t).toBe('Contratos')
  })
})

describe('resolveNavRouteMatchForPathname', () => {
  const routes = [
    { code: 'NAV_EMP', routePath: '/app/admin-global/empresas', moduleTitle: 'Empresas', label: 'E' },
    { code: 'NAV_CL', routePath: '/app/gestion-contratos/clausulas-universales', moduleTitle: 'Universales', label: 'U' }
  ]

  it('returns longest-prefix match for nested paths', () => {
    const m = resolveNavRouteMatchForPathname('/app/admin-global/empresas/abc/edit', routes)
    expect(m?.routePath).toBe('/app/admin-global/empresas')
    expect(m?.code).toBe('NAV_EMP')
    expect(m?.moduleTitle).toBe('Empresas')
  })

  it('returns exact match when pathname equals routePath', () => {
    const m = resolveNavRouteMatchForPathname('/app/gestion-contratos/clausulas-universales', routes)
    expect(m?.routePath).toBe('/app/gestion-contratos/clausulas-universales')
    expect(m?.code).toBe('NAV_CL')
  })
})

describe('isPathAllowed', () => {
  it('matches normalized paths', () => {
    const allowed = new Set(['/app/dashboard'])
    expect(isPathAllowed('/app/dashboard/', allowed)).toBe(true)
  })

  it('allows child paths under a granted prefix', () => {
    const allowed = new Set(['/app/gestion-contratos/clausulas-universales'])
    expect(
      isPathAllowed('/app/gestion-contratos/clausulas-universales/13783ec2-dc3c-49a9-8029-63e29315d952/edit', allowed)
    ).toBe(true)
    expect(isPathAllowed('/app/gestion-contratos/clausulas-universales/nueva', allowed)).toBe(true)
  })

  it('does not allow unrelated paths that only share a prefix by accident', () => {
    const allowed = new Set(['/app/foo'])
    expect(isPathAllowed('/app/foobar', allowed)).toBe(false)
  })
})

describe('mapApiNavTreeToSidebarItems', () => {
  it('builds group and links from API tree', () => {
    const items = mapApiNavTreeToSidebarItems([
      {
        code: 'NAV_DASHBOARD',
        label: 'Dashboard',
        routePath: '/app/dashboard',
        showInMainMenu: true
      },
      {
        code: 'G',
        label: 'Admin',
        children: [
          {
            code: 'U',
            label: 'Usuarios',
            routePath: '/app/usuarios',
            showInMainMenu: true
          }
        ]
      }
    ])
    expect(items[0].type).toBe('link')
    expect(items[1].type).toBe('group')
    expect(items[1].children.length).toBe(1)
  })

  it('omits parent groups that end up with no visible children', () => {
    const items = mapApiNavTreeToSidebarItems([
      {
        code: 'G',
        label: 'Grupo',
        children: [
          { code: 'X', label: 'Oculto', routePath: '/app/x', showInMainMenu: false },
          { code: 'Y', label: 'Oculto 2', routePath: null, showInMainMenu: false }
        ]
      }
    ])
    expect(items).toEqual([])
  })

  it('preserves backend order without re-sorting', () => {
    const items = mapApiNavTreeToSidebarItems([
      { code: 'B', label: 'B', routePath: '/app/b', showInMainMenu: true },
      { code: 'A', label: 'A', routePath: '/app/a', showInMainMenu: true }
    ])
    expect(items.map((i) => (i.type === 'link' ? i.path : i.id))).toEqual(['/app/b', '/app/a'])
  })

  it('keeps submenu items even when routePath is null (non-navigable)', () => {
    const items = mapApiNavTreeToSidebarItems([
      {
        code: 'NAV_MENU_INICIO',
        label: 'Inicio',
        children: [{ code: 'NAV_ITEM_INICIO_BANDEJA_TAREAS', label: 'Bandeja', routePath: null, showInMainMenu: true }]
      }
    ])
    expect(items[0].type).toBe('group')
    expect(items[0].children[0]).toEqual({ id: 'NAV_ITEM_INICIO_BANDEJA_TAREAS', path: null, label: 'Bandeja' })
  })
})
