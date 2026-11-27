/**
 * Alertas de vencimiento de firma: guarda cuándo se avisó a la empresa que el enlace de firma de un
 * contrato pendiente vence en ≤48 h y en ≤24 h (un aviso de cada tipo por intento). Columnas nulas:
 * compatible con el código anterior. El código nuevo las lee y escribe en el barrido, así que la
 * migración se aplica ANTES del deploy. Reversible.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('firme_signing', (table) => {
    table.timestamp('expiry_alert_48_sent_at', { useTz: true }).nullable()
    table.timestamp('expiry_alert_24_sent_at', { useTz: true }).nullable()
  })
}

exports.down = async function down(knex) {
  await knex.schema.alterTable('firme_signing', (table) => {
    table.dropColumn('expiry_alert_48_sent_at')
    table.dropColumn('expiry_alert_24_sent_at')
  })
}
