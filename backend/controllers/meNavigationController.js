const { buildNoProfileAssignedBody } = require('../sessionResponses')
const { buildGrantedCodesList } = require('../services/authorizationService')

function pruneEmptyParents(nodes) {
  if (!Array.isArray(nodes)) return []

  function visit(node) {
    const children = Array.isArray(node.children) ? node.children.map(visit).filter(Boolean) : []
    const next = { ...node }
    if (children.length > 0) next.children = children
    else delete next.children

    const isNavigable = Boolean(next.routePath)
    const hasChildren = Array.isArray(next.children) && next.children.length > 0
    if (!isNavigable && !hasChildren) return null
    return next
  }

  return nodes.map(visit).filter(Boolean)
}

function createMeNavigationHandler({
  getEffectiveNavigationForUser,
  buildNavigationTree,
  buildGrantedRouteList
}) {
  if (typeof getEffectiveNavigationForUser !== 'function') {
    throw new Error('getEffectiveNavigationForUser must be a function')
  }
  if (typeof buildNavigationTree !== 'function') {
    throw new Error('buildNavigationTree must be a function')
  }
  if (typeof buildGrantedRouteList !== 'function') {
    throw new Error('buildGrantedRouteList must be a function')
  }

  return async function meNavigationHandler(req, res) {
    const { userId, email } = req.auth
    const result = await getEffectiveNavigationForUser(userId)
    if (!result) {
      return res.status(404).json(buildNoProfileAssignedBody(userId, email))
    }

    const { profile, rows } = result
    const tree = pruneEmptyParents(buildNavigationTree(rows))
    const routes = buildGrantedRouteList(rows)
    const grantedCodes = buildGrantedCodesList(rows)

    return res.status(200).json({
      profile: { code: profile.code, label: profile.label },
      navigation: { tree, routes, grantedCodes }
    })
  }
}

module.exports = { createMeNavigationHandler, pruneEmptyParents }

