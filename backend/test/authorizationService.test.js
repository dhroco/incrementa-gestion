const test = require('node:test')
const assert = require('node:assert/strict')
const {
  buildNavigationTree,
  buildGrantedRouteList,
  buildGrantedCodesList
} = require('../services/authorizationService')

test('buildNavigationTree orders roots and nests children', () => {
  const g1 = '00000000-0000-4000-8000-000000000001'
  const c1 = '00000000-0000-4000-8000-000000000002'
  const c2 = '00000000-0000-4000-8000-000000000003'
  const rows = [
    {
      id: g1,
      parent_id: null,
      code: 'NAV_GROUP',
      label: 'Grupo',
      route_path: null,
      module_title: null,
      sort_order: 500,
      show_in_main_menu: true
    },
    {
      id: c2,
      parent_id: g1,
      code: 'NAV_B',
      label: 'B',
      route_path: '/app/b',
      module_title: 'B',
      sort_order: 520,
      show_in_main_menu: true
    },
    {
      id: c1,
      parent_id: g1,
      code: 'NAV_A',
      label: 'A',
      route_path: '/app/a',
      module_title: 'A',
      sort_order: 510,
      show_in_main_menu: true
    }
  ]
  const tree = buildNavigationTree(rows)
  assert.equal(tree.length, 1)
  assert.equal(tree[0].code, 'NAV_GROUP')
  assert.equal(tree[0].children.length, 2)
  assert.equal(tree[0].children[0].code, 'NAV_A')
  assert.equal(tree[0].children[1].code, 'NAV_B')
})

test('buildGrantedRouteList returns only rows with route_path', () => {
  const rows = [
    {
      id: 'a',
      parent_id: null,
      code: 'G',
      label: 'G',
      route_path: null,
      module_title: null,
      sort_order: 1,
      show_in_main_menu: true
    },
    {
      id: 'b',
      parent_id: null,
      code: 'L',
      label: 'L',
      route_path: '/x',
      module_title: 'M',
      sort_order: 2,
      show_in_main_menu: false
    }
  ]
  const list = buildGrantedRouteList(rows)
  assert.equal(list.length, 1)
  assert.equal(list[0].routePath, '/x')
  assert.equal(list[0].showInMainMenu, false)
})

test('buildGrantedCodesList dedupes and returns sorted codes (includes nodes without route)', () => {
  const rows = [
    {
      id: 'a',
      parent_id: null,
      code: 'NAV_X',
      label: 'X',
      route_path: null,
      module_title: null,
      sort_order: 1,
      show_in_main_menu: true
    },
    {
      id: 'b',
      parent_id: null,
      code: 'NAV_ACTION',
      label: 'Act',
      route_path: null,
      module_title: null,
      sort_order: 2,
      show_in_main_menu: true
    }
  ]
  const list = buildGrantedCodesList([...rows, { ...rows[0] }])
  assert.deepEqual(list, ['NAV_ACTION', 'NAV_X'])
})
