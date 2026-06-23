const { ForbiddenError } = require('@casl/ability')

function authorize(action, subjectName) {
  return (req, res, next) => {
    try {
      ForbiddenError.from(req.ability).throwUnlessCan(action, subjectName)
      next()
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return res.status(403).json({
          status: 'forbidden',
          message: 'No tienes permiso para realizar esta acción.'
        })
      }
      next(err)
    }
  }
}

function authorizeAny(actions, subjectName) {
  const list = Array.isArray(actions) ? actions : []
  return (req, res, next) => {
    try {
      const allowed = list.some((action) => req.ability?.can(action, subjectName))
      if (!allowed) {
        ForbiddenError.from(req.ability).throwUnlessCan(list[0] || 'read', subjectName)
      }
      next()
    } catch (err) {
      if (err instanceof ForbiddenError) {
        return res.status(403).json({
          status: 'forbidden',
          message: 'No tienes permiso para realizar esta acción.'
        })
      }
      next(err)
    }
  }
}

module.exports = { authorize, authorizeAny }
