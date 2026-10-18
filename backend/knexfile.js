const config = require('./config')

/**
 * Azure Database for PostgreSQL exige TLS. El certificado del servidor se valida contra
 * las raíces de confianza que trae Node (Azure usa DigiCert Global Root G2 y Microsoft RSA
 * Root CA 2017, que vienen incluidas), y el nombre del servidor tiene que calzar con el
 * del certificado. Por eso DATABASE_URL usa siempre el nombre del servidor
 * (`<servidor>.postgres.database.azure.com`), nunca una IP: por el endpoint privado ese
 * nombre resuelve a la IP privada y el certificado sigue calzando.
 *
 * PGSSLMODE=disable apaga TLS, solo para una base local que no lo tenga.
 */
function sslConfig() {
  const mode = String(process.env.PGSSLMODE || '').toLowerCase()
  if (mode === 'disable') return false
  return { rejectUnauthorized: true }
}

/**
 * Se quita `sslmode` de la URL: pg le da prioridad a los parámetros de la cadena por sobre
 * el objeto `ssl`, y así la validación no depende de cómo venga escrita la URL.
 * @param {string | undefined} raw
 */
function connectionStringWithoutSslMode(raw) {
  if (!raw) return raw
  try {
    const url = new URL(raw)
    url.searchParams.delete('sslmode')
    return url.toString()
  } catch {
    return raw
  }
}

module.exports = {
  client: 'pg',
  // Siempre un objeto { connectionString, ssl }: el parser interno de knex no se usa.
  connection: {
    connectionString: connectionStringWithoutSslMode(config.DATABASE_URL),
    ssl: sslConfig()
  },
  migrations: {
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  }
}
