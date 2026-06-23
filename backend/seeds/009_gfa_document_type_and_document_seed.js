const { randomUUID } = require('node:crypto')
const { _gfaDocumentTypeIds, _gfaTemplateIds } = require('./006_gfa_template_seed')

exports._gfaDocumentIds = {
  d1: randomUUID(),
  d2: randomUUID(),
}

exports.seed = async function seed(_knex) {
  // Legacy document rows referenced employees; module removed — document types remain in 006.
  void exports._gfaDocumentIds
  void _gfaDocumentTypeIds
  void _gfaTemplateIds
}
