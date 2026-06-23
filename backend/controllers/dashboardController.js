const { sendOk, sendError } = require('../http/responses')

function createDashboardController({ dashboardService }) {
  return {
    getStats: async (_req, res) => {
      try {
        const result = await dashboardService.getDashboardStats()
        if (!result.ok) {
          return sendError(res, {
            status: result.status ?? 500,
            code: result.code ?? 'DASHBOARD_STATS_FAILED',
            message: result.message ?? 'No se pudieron obtener las estadísticas del dashboard.'
          })
        }
        return sendOk(res, result.data)
      } catch (_err) {
        return sendError(res, {
          status: 500,
          code: 'DASHBOARD_STATS_FAILED',
          message: 'No se pudieron obtener las estadísticas del dashboard.'
        })
      }
    }
  }
}

module.exports = { createDashboardController }
