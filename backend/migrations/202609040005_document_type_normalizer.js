/**
 * La normalización pasa a ser propiedad del TIPO de documento.
 *
 * `validatePattern` aplicaba la normalización del RFC (comprimir espacios,
 * puntos y guiones) a TODO tipo validado por patrón. Eso obligaba a cualquier
 * país nuevo a perder su puntuación —un CUIT `20-12345678-9` quedaba guardado
 * como `20123456789`— y a escribir el patrón del catálogo contra el valor ya
 * comprimido, regla que nada documentaba.
 *
 * Ahora `pattern` preserva la puntuación y `pattern_compact` la comprime. El
 * RFC pasa al segundo, que es el que necesita; los países que se agreguen a
 * futuro usan `pattern` y conservan su formato real.
 */

exports.up = async function up(knex) {
  const has = await knex.schema.hasTable('identity_document_type')
  if (!has) return
  await knex('identity_document_type').where({ code: 'RFC' }).update({ validator_key: 'pattern_compact' })
}

exports.down = async function down(knex) {
  const has = await knex.schema.hasTable('identity_document_type')
  if (!has) return
  await knex('identity_document_type').where({ code: 'RFC' }).update({ validator_key: 'pattern' })
}
