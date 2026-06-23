const CODES_TO_DELETE = [
  'NAV_ITEM_INICIO_BANDEJA_TAREAS',
  'NAV_ITEM_INICIO_ALERTAS_VENCIMIENTOS',
  'NAV_ITEM_INICIO_INSTRUCTIVO',
  'NAV_ITEM_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_READ',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE',
  'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT',
  'NAV_ITEM_CONTRATOS_CAUSALES_LEGALES',
  'NAV_ITEM_CONTRATOS_CONTRATOS_ESTANDAR',
  'NAV_ITEM_CONTRATOS_CONTRATOS_POR_EMPRESA',
  'NAV_ITEM_CONTRATOS_REPOSITORIO_DOCUMENTOS',
  'NAV_ITEM_CONTRATOS_CONTRATOS_ANTIGUOS',
  'NAV_ITEM_CONTRATOS_REPORTES',
  'NAV_ITEM_CONTRATOS_EXPORTACION',
  'NAV_ITEM_CONTRATOS_IMPORTACION',
  'NAV_ITEM_SISTEMA_PARAMETROS',
  'NAV_ITEM_SISTEMA_AUDITORIA',
  'NAV_ITEM_SISTEMA_ELIMINACION_CONTROLADA',
  'NAV_ITEM_SISTEMA_CONFIGURACION_ALERTAS'
]

exports.up = async function up(knex) {
  await knex.transaction(async (trx) => {
    const nodes = await trx('navigation_node').whereIn('code', CODES_TO_DELETE).select('id')
    const nodeIds = nodes.map((r) => r.id)
    if (nodeIds.length > 0) {
      await trx('profile_navigation_grant').whereIn('navigation_node_id', nodeIds).del()
      await trx('navigation_node').whereIn('id', nodeIds).del()
    }

    const constructorNode = await trx('navigation_node')
      .where({ code: 'NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO' })
      .first()
    const adminProfile = await trx('profile').where({ code: 'ADMINISTRADOR_PLATAFORMA' }).first()

    if (constructorNode && adminProfile) {
      const existing = await trx('profile_navigation_grant')
        .where({
          profile_id: adminProfile.id,
          navigation_node_id: constructorNode.id
        })
        .first()
      if (!existing) {
        await trx('profile_navigation_grant').insert({
          profile_id: adminProfile.id,
          navigation_node_id: constructorNode.id
        })
      }
    }
  })
}

exports.down = async function down(_knex) {}
