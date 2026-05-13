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
    LOG_LEVEL: 'debug',
    supabaseUrl: 'https://ulqtcnnivgkqxphmzlrh.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscXRjbm5pdmdrcXhwaG16bHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MTE5NDYsImV4cCI6MjA5MTA4Nzk0Nn0.tyG_qk4sQn5P2aThcs4OPkkBKKfdfAbkonMU-dwU50g'
  },
  dev: {
    API_BASE_URL: 'https://dev.gaf.lat',
    APP_NAME: 'Sistema de Gestión de Contratos',
    DEBUG: true,
    LOG_LEVEL: 'info',
    supabaseUrl: 'https://ulqtcnnivgkqxphmzlrh.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscXRjbm5pdmdrcXhwaG16bHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MTE5NDYsImV4cCI6MjA5MTA4Nzk0Nn0.tyG_qk4sQn5P2aThcs4OPkkBKKfdfAbkonMU-dwU50g'
  },
  prod: {
    API_BASE_URL: 'https://api.gestion-contratos.com',
    APP_NAME: 'Sistema de Gestión de Contratos',
    DEBUG: false,
    LOG_LEVEL: 'error',
    supabaseUrl: '',
    supabaseAnonKey: ''
  }
};

export default {
  ...config[ENVIRONMENT],
  ENVIRONMENT
};
