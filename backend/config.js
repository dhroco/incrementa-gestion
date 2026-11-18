// Environment configuration for backend

const ENVIRONMENT = process.env.ENVIRONMENT || 'local';

// Validate environment
const validEnvironments = ['local', 'dev', 'prod'];
if (!validEnvironments.includes(ENVIRONMENT)) {
  throw new Error(`Invalid ENVIRONMENT value: ${ENVIRONMENT}. Must be one of: ${validEnvironments.join(', ')}`);
}

const config = {
  local: {
    PORT: 3000,
    HOST: 'localhost',
    // En local se carga con set-env-local.sh y apunta a la base de pre-prod en Azure.
    DATABASE_URL: process.env.DATABASE_URL,
    OIDC_ISSUER_URL:
      process.env.OIDC_ISSUER_URL ||
      'https://login.microsoftonline.com/60322b4a-13bf-4f19-89ae-efe4a54ffed6/v2.0',
    OIDC_AUDIENCE: process.env.OIDC_AUDIENCE || 'dc734f4a-5f25-4e88-b728-aab4715f2122',
    GRAPH_ENABLED: process.env.GRAPH_ENABLED !== 'false',
    AZURE_STORAGE_ACCOUNT: process.env.AZURE_STORAGE_ACCOUNT || 'stincrementapreprod',
    AZURE_STORAGE_CONTAINER_DOCUMENTOS: process.env.AZURE_STORAGE_CONTAINER_DOCUMENTOS || 'documentos',
    AZURE_STORAGE_CONTAINER_FIRMADOS: process.env.AZURE_STORAGE_CONTAINER_FIRMADOS || 'firmados',
    ACS_EMAIL_ENDPOINT: process.env.ACS_EMAIL_ENDPOINT || '',
    ACS_EMAIL_FROM: process.env.ACS_EMAIL_FROM || '',
    FIRME_API_URL: process.env.FIRME_API_URL || 'https://staging.api.documentos.firme.cl',
    FIRME_API_TOKEN: process.env.FIRME_API_TOKEN || '',
    FIRME_LEGAL_ENTITY_ID: process.env.FIRME_LEGAL_ENTITY_ID || '',
    LOG_LEVEL: 'debug',
    CORS_ORIGIN: 'http://localhost:5173'
  },
  dev: {
    PORT: process.env.PORT || 3000,
    HOST: '0.0.0.0',
    DATABASE_URL: process.env.DATABASE_URL,
    OIDC_ISSUER_URL: process.env.OIDC_ISSUER_URL || '',
    OIDC_AUDIENCE: process.env.OIDC_AUDIENCE || 'incrementa-backend',
    GRAPH_ENABLED: process.env.GRAPH_ENABLED !== 'false',
    AZURE_STORAGE_ACCOUNT: process.env.AZURE_STORAGE_ACCOUNT || 'stincrementapreprod',
    AZURE_STORAGE_CONTAINER_DOCUMENTOS: process.env.AZURE_STORAGE_CONTAINER_DOCUMENTOS || 'documentos',
    AZURE_STORAGE_CONTAINER_FIRMADOS: process.env.AZURE_STORAGE_CONTAINER_FIRMADOS || 'firmados',
    ACS_EMAIL_ENDPOINT: process.env.ACS_EMAIL_ENDPOINT || '',
    ACS_EMAIL_FROM: process.env.ACS_EMAIL_FROM || '',
    FIRME_API_URL: process.env.FIRME_API_URL || '',
    FIRME_API_TOKEN: process.env.FIRME_API_TOKEN || '',
    FIRME_LEGAL_ENTITY_ID: process.env.FIRME_LEGAL_ENTITY_ID || '',
    LOG_LEVEL: 'info',
    // En Azure la inyecta la Container App: la URL de Static Web Apps del entorno.
    CORS_ORIGIN: process.env.CORS_ORIGIN || ''
  },
  prod: {
    PORT: process.env.PORT || 3000,
    HOST: '0.0.0.0',
    DATABASE_URL: process.env.DATABASE_URL,
    OIDC_ISSUER_URL: process.env.OIDC_ISSUER_URL || '',
    OIDC_AUDIENCE: process.env.OIDC_AUDIENCE || 'incrementa-backend',
    GRAPH_ENABLED: process.env.GRAPH_ENABLED !== 'false',
    AZURE_STORAGE_ACCOUNT: process.env.AZURE_STORAGE_ACCOUNT || '',
    AZURE_STORAGE_CONTAINER_DOCUMENTOS: process.env.AZURE_STORAGE_CONTAINER_DOCUMENTOS || 'documentos',
    AZURE_STORAGE_CONTAINER_FIRMADOS: process.env.AZURE_STORAGE_CONTAINER_FIRMADOS || 'firmados',
    ACS_EMAIL_ENDPOINT: process.env.ACS_EMAIL_ENDPOINT || '',
    ACS_EMAIL_FROM: process.env.ACS_EMAIL_FROM || '',
    FIRME_API_URL: process.env.FIRME_API_URL || '',
    FIRME_API_TOKEN: process.env.FIRME_API_TOKEN || '',
    FIRME_LEGAL_ENTITY_ID: process.env.FIRME_LEGAL_ENTITY_ID || '',
    LOG_LEVEL: 'error',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'https://gestion-contratos.com'
  }
};

module.exports = {
  ...config[ENVIRONMENT],
  ENVIRONMENT
};
