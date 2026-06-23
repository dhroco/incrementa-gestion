/* global process */
// Environment configuration for frontend
const ENVIRONMENT = process.env.ENVIRONMENT || 'local';

// Validate environment
const validEnvironments = ['local', 'dev', 'prod'];
if (!validEnvironments.includes(ENVIRONMENT)) {
  throw new Error(`Invalid ENVIRONMENT value: ${ENVIRONMENT}. Must be one of: ${validEnvironments.join(', ')}`);
}

const config = {
  local: {
    API_BASE_URL: 'http://localhost:3000',
    APP_NAME: 'Sistema de Gestión de Contratos',
    DEBUG: true,
    LOG_LEVEL: 'debug'
  },
  dev: {
    API_BASE_URL: 'https://dev.gaf.lat',
    APP_NAME: 'Sistema de Gestión de Contratos',
    DEBUG: true,
    LOG_LEVEL: 'info'
  },
  prod: {
    API_BASE_URL: 'https://api.gestion-contratos.com',
    APP_NAME: 'Sistema de Gestión de Contratos',
    DEBUG: false,
    LOG_LEVEL: 'error'
  }
};

export default {
  ...config[ENVIRONMENT],
  ENVIRONMENT
};
