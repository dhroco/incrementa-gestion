const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

function build(year, mesIdx, dia) {
  return `${dia} de ${MESES_ES[mesIdx]} de ${year}`
}

/**
 * Fecha al formato legal chileno "15 de marzo de 2024".
 *
 * Acepta dos formas, porque el valor llega por dos caminos distintos:
 * - `Date`: lo que `pg` devuelve para columnas `date` (dato del proveedor en BD).
 *   Se leen los componentes **locales**, no los UTC: pg construye la fecha a
 *   medianoche local, así que `toISOString()` correría el día un día atrás en
 *   zonas al oeste de Greenwich (Chile incluido).
 * - `string` ISO (`YYYY-MM-DD`, con hora opcional): lo que envía el formulario
 *   o el MCP como override. Se parsea por partes para evitar el mismo corrimiento.
 *
 * Cualquier otro valor se devuelve tal cual (ya viene formateado o no es fecha).
 * @param {unknown} value
 * @returns {string}
 */
function formatFechaEs(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return build(value.getFullYear(), value.getMonth(), value.getDate())
  }

  const raw = String(value ?? '').trim()
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return raw
  const dia = parseInt(m[3], 10)
  const mesIdx = parseInt(m[2], 10) - 1
  if (mesIdx < 0 || mesIdx > 11 || dia < 1 || dia > 31) return raw
  return build(m[1], mesIdx, dia)
}

module.exports = { formatFechaEs, MESES_ES }
