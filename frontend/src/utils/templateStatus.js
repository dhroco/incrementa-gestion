/** Maps template status codes to Spanish labels (es-CL). */
export function mapTemplateStatusToSpanish(status) {
  if (status === 'active') return 'Activo'
  if (status === 'inactive') return 'Inactivo'
  return 'Inactivo'
}
