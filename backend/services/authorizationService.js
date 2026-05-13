/**
 * Navegación efectiva por perfil: filas desde PostgreSQL → DTOs con camelCase
 * (`routePath`, `moduleTitle`, `showInMainMenu`, …) consumidos por el frontend en sesión enriquecida.
 */
const { db } = require('../db/knex')

/**
 * @typedef {object} NavigationRow
 * @property {string} id
 * @property {string|null} parent_id
 * @property {string} code
 * @property {string} label
 * @property {string|null} route_path
 * @property {string|null} module_title
 * @property {number} sort_order
 * @property {boolean} show_in_main_menu
 */

/**
 * Collect navigation_node rows: every granted active node plus ancestors (active), for a profile id.
 * @param {string} profileId
 * @returns {Promise<NavigationRow[]>}
 */
async function loadNavigationRowsForProfile(profileId) {
  const result = await db.raw(
    `
    WITH RECURSIVE reachable AS (
      SELECT n.*
      FROM profile_navigation_grant g
      INNER JOIN navigation_node n ON n.id = g.navigation_node_id
      WHERE g.profile_id = ?
        AND n.is_active = true
      UNION ALL
      SELECT p.*
      FROM navigation_node p
      INNER JOIN reachable r ON p.id = r.parent_id
      WHERE p.is_active = true
    )
    SELECT DISTINCT r.id, r.parent_id, r.code, r.label, r.route_path, r.module_title,
           r.sort_order, r.show_in_main_menu
    FROM reachable r
    ORDER BY r.sort_order ASC, r.label ASC
    `,
    [profileId]
  )
  return result.rows
}

/**
 * Build ordered tree DTOs from flat rows (same table, parent_id links).
 * @param {NavigationRow[]} rows
 * @returns {object[]}
 */
function buildNavigationTree(rows) {
  const byParent = new Map()
  for (const r of rows) {
    const key = r.parent_id ?? '__root__'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(r)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
  }

  function toDto(node) {
    const children = byParent.get(node.id) || []
    const dto = {
      code: node.code,
      label: node.label,
      routePath: node.route_path,
      moduleTitle: node.module_title ?? node.label,
      showInMainMenu: node.show_in_main_menu,
      sortOrder: node.sort_order
    }
    if (children.length > 0) {
      dto.children = children.map(toDto)
    }
    return dto
  }

  const roots = byParent.get('__root__') || []
  return roots.map(toDto)
}

/**
 * Flat list of navigable link nodes (route_path set) granted to profile — for clients that prefer a list.
 * @param {NavigationRow[]} rows
 * @returns {object[]}
 */
function buildGrantedRouteList(rows) {
  return rows
    .filter((r) => r.route_path)
    .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
    .map((r) => ({
      code: r.code,
      label: r.label,
      routePath: r.route_path,
      moduleTitle: r.module_title ?? r.label,
      showInMainMenu: r.show_in_main_menu,
      sortOrder: r.sort_order
    }))
}

/**
 * All distinct `navigation_node.code` values the profile can reach (grants + ancestors as returned by
 * `loadNavigationRowsForProfile`). Includes action-only nodes that may be pruned from the UI tree
 * (e.g. `NAV_ACTION_…` without a route), so clients can authorize buttons without relying on tree
 * structure alone.
 * @param {NavigationRow[]} rows
 * @returns {string[]}
 */
function buildGrantedCodesList(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const set = new Set()
  for (const r of rows) {
    if (r && typeof r.code === 'string' && r.code) set.add(r.code)
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

/**
 * @param {string} userId - Supabase auth user id
 * @returns {Promise<{ profile: { id: string, code: string, label: string }, rows: NavigationRow[] } | null>}
 */
async function getEffectiveNavigationForUser(userId) {
  const profileRow = await db('user_profile as up')
    .join('profile as p', 'p.id', 'up.profile_id')
    .select('p.id as id', 'p.code as code', 'p.label as label')
    .where('up.user_id', userId)
    .first()

  if (!profileRow) return null

  const rows = await loadNavigationRowsForProfile(profileRow.id)
  return { profile: profileRow, rows }
}

module.exports = {
  loadNavigationRowsForProfile,
  buildNavigationTree,
  buildGrantedRouteList,
  buildGrantedCodesList,
  getEffectiveNavigationForUser
}
