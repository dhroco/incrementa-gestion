const config = require('./config')

function shouldUseSsl() {
  const mode = String(process.env.PGSSLMODE || '').toLowerCase()
  return mode === 'require' || mode === 'verify-ca' || mode === 'verify-full'
}

module.exports = {
  client: 'pg',
  // Pasamos SIEMPRE un objeto { connectionString } (no el string crudo) porque el parser
  // interno de knex no entiende la sintaxis de socket unix "?host=/cloudsql/INSTANCE"
  // (la trata como filename de sqlite y pierde el host -> pg cae a localhost:5432).
  // pg SÍ parsea esa forma correctamente cuando recibe { connectionString }.
  connection: shouldUseSsl()
    ? {
        connectionString: config.DATABASE_URL,
        ssl: {
          // Supabase/Postgres managed cert chains can fail strict verification in some environments (notably Windows).
          // For local tooling (migrations/seeds), we accept the server cert when SSL is required.
          rejectUnauthorized: false,
        },
      }
    : { connectionString: config.DATABASE_URL },
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  }
}

