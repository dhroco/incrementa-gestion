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
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/gestion_contratos_local',
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
    /** Service role: solo servidor (p. ej. aprovisionar usuarios). Vacío en local si no se usa esa función. */
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    LOG_LEVEL: 'debug',
    CORS_ORIGIN: 'http://localhost:5173'
  },
  dev: {
    PORT: 3000,
    HOST: '0.0.0.0',
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres.ulqtcnnivgkqxphmzlrh:Elizardo.123!@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    SUPABASE_URL: process.env.SUPABASE_URL || 'https://ulqtcnnivgkqxphmzlrh.supabase.co',
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '/wm+vX9phucE9vqzQP8wDB3KQn7NafKgJAPdsdBo38pHYjWyjQE5K40i2x9zDymqFmAD0i0STT4TB1l156yYWA==',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscXRjbm5pdmdrcXhwaG16bHJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTUxMTk0NiwiZXhwIjoyMDkxMDg3OTQ2fQ.SD75rdu_eM8L_wp3jFNhOyY3E0k3vwsJs4oDxULUPD4',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'https://dev.dlrt4e5spibmy.amplifyapp.com'
  },
  prod: {
    PORT: process.env.PORT || 3000,
    HOST: '0.0.0.0',
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    LOG_LEVEL: 'error',
    CORS_ORIGIN: 'https://gestion-contratos.com'
  }
};

module.exports = {
  ...config[ENVIRONMENT],
  ENVIRONMENT
};
