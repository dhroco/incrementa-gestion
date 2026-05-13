const config = require('./config')

function shouldUseSsl() {
  const mode = String(process.env.PGSSLMODE || '').toLowerCase()
  return mode === 'require' || mode === 'verify-ca' || mode === 'verify-full'
}

module.exports = {
  client: 'pg',
  connection: shouldUseSsl()
    ? {
        connectionString: config.DATABASE_URL,
        ssl: {
          // Supabase/Postgres managed cert chains can fail strict verification in some environments (notably Windows).
          // For local tooling (migrations/seeds), we accept the server cert when SSL is required.
          rejectUnauthorized: false,
        },
      }
    : config.DATABASE_URL,
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  }
}

