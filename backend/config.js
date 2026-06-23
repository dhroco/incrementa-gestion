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
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:Incrementa2026!@35.199.66.217:5432/incrementa',
    OIDC_ISSUER_URL:
      process.env.OIDC_ISSUER_URL ||
      'https://login.microsoftonline.com/60322b4a-13bf-4f19-89ae-efe4a54ffed6/v2.0',
    OIDC_AUDIENCE: process.env.OIDC_AUDIENCE || 'dc734f4a-5f25-4e88-b728-aab4715f2122',
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID || 'dc734f4a-5f25-4e88-b728-aab4715f2122',
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET || '',
    KEYCLOAK_ADMIN_URL: process.env.KEYCLOAK_ADMIN_URL || 'http://localhost:8080',
    KEYCLOAK_ADMIN_USER: process.env.KEYCLOAK_ADMIN_USER || 'admin',
    KEYCLOAK_ADMIN_PASSWORD: process.env.KEYCLOAK_ADMIN_PASSWORD || '',
    KEYCLOAK_REALM: process.env.KEYCLOAK_REALM || 'incrementa',
    GCS_BUCKET: process.env.GCS_BUCKET || 'incrementa-contratos-dev',
    GCS_KEY_FILE: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    LOG_LEVEL: 'debug',
    CORS_ORIGIN: 'http://localhost:5173'
  },
  dev: {
    PORT: 3000,
    HOST: '0.0.0.0',
    DATABASE_URL: process.env.DATABASE_URL,
    OIDC_ISSUER_URL: process.env.OIDC_ISSUER_URL || '',
    OIDC_AUDIENCE: process.env.OIDC_AUDIENCE || 'incrementa-backend',
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID || 'incrementa-backend',
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET || '',
    KEYCLOAK_ADMIN_URL: process.env.KEYCLOAK_ADMIN_URL || '',
    KEYCLOAK_ADMIN_USER: process.env.KEYCLOAK_ADMIN_USER || 'admin',
    KEYCLOAK_ADMIN_PASSWORD: process.env.KEYCLOAK_ADMIN_PASSWORD || '',
    KEYCLOAK_REALM: process.env.KEYCLOAK_REALM || 'incrementa',
    GCS_BUCKET: process.env.GCS_BUCKET || 'incrementa-contratos-dev',
    GCS_KEY_FILE: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'https://dev.dlrt4e5spibmy.amplifyapp.com'
  },
  prod: {
    PORT: process.env.PORT || 3000,
    HOST: '0.0.0.0',
    DATABASE_URL: process.env.DATABASE_URL,
    OIDC_ISSUER_URL: process.env.OIDC_ISSUER_URL || '',
    OIDC_AUDIENCE: process.env.OIDC_AUDIENCE || 'incrementa-backend',
    OIDC_CLIENT_ID: process.env.OIDC_CLIENT_ID || 'incrementa-backend',
    OIDC_CLIENT_SECRET: process.env.OIDC_CLIENT_SECRET || '',
    KEYCLOAK_ADMIN_URL: process.env.KEYCLOAK_ADMIN_URL || '',
    KEYCLOAK_ADMIN_USER: process.env.KEYCLOAK_ADMIN_USER || 'admin',
    KEYCLOAK_ADMIN_PASSWORD: process.env.KEYCLOAK_ADMIN_PASSWORD || '',
    KEYCLOAK_REALM: process.env.KEYCLOAK_REALM || 'incrementa',
    GCS_BUCKET: process.env.GCS_BUCKET || 'incrementa-contratos-dev',
    GCS_KEY_FILE: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'contratos@incrementa.la',
    LOG_LEVEL: 'error',
    CORS_ORIGIN: 'https://gestion-contratos.com'
  }
};

module.exports = {
  ...config[ENVIRONMENT],
  ENVIRONMENT
};
