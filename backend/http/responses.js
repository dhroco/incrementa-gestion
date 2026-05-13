function nowIso() {
  return new Date().toISOString()
}

function withMeta(meta) {
  return { timestamp: nowIso(), ...(meta ?? {}) }
}

function sendOk(res, data, { status = 200, meta } = {}) {
  return res.status(status).json({ data, meta: withMeta(meta) })
}

function sendError(res, { status = 500, code, message, meta } = {}) {
  return res.status(status).json({
    error: {
      code: code ?? 'UNEXPECTED_ERROR',
      message: message ?? 'Ocurrió un error inesperado.'
    },
    meta: withMeta(meta)
  })
}

module.exports = {
  sendOk,
  sendError
}

