/**
 * Tras cambiar herramientas o parámetros MCP, reinicie Claude Desktop para recargar el servidor.
 */
import { z } from 'zod'

export const MCP_USER_ID = '00000000-0000-0000-0000-000000000001'

export function jsonToolResult(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
  }
}

export function mapServiceResult(result) {
  if (result?.ok === true) {
    if (result.data !== undefined) {
      return { ok: true, data: result.data }
    }
    if (Array.isArray(result.items)) {
      return { ok: true, data: { items: result.items } }
    }
    return { ok: true, data: {} }
  }

  return {
    ok: false,
    code: result?.code ?? 'ERROR',
    message: result?.message ?? 'Error desconocido.',
    ...(result?.data ? { data: result.data } : {})
  }
}

async function resolveActorProfileId(getUserProfileIdByUserId) {
  const profileId = await getUserProfileIdByUserId(MCP_USER_ID)
  if (!profileId) {
    return {
      ok: false,
      code: 'PROFILE_NOT_ASSIGNED',
      message: 'Perfil MCP no encontrado. Verifique que la migración 019 esté aplicada.'
    }
  }
  return { ok: true, profileId }
}

function formatCompanyRut(row) {
  if (!row?.rut_body) return null
  const dv = row.rut_dv != null ? String(row.rut_dv).toUpperCase() : ''
  const body = String(row.rut_body)
  if (body.length <= 1) return `${body}-${dv}`
  return `${body.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}.${body.slice(-1)}-${dv}`
}

/**
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {{
 *   db: import('knex').Knex,
 *   supplierService: object,
 *   clientService: object,
 *   standardTemplatesService: object,
 *   documentBuilderService: object,
 *   contractsQueryService: object,
 *   contractSigningService: object,
 *   gcsService: object,
 *   getUserProfileIdByUserId: (userId: string) => Promise<string | null>
 * }} deps
 */
export function registerMcpTools(server, deps) {
  const {
    db,
    supplierService,
    clientService,
    standardTemplatesService,
    documentBuilderService,
    contractsQueryService,
    contractSigningService,
    gcsService,
    getUserProfileIdByUserId
  } = deps

  server.tool(
    'listar_plantillas',
    'Lista las plantillas estándar activas disponibles para generar documentos. Solo retorna plantillas con status activo; no incluye plantillas inactivas. Úsala para obtener el id y nombre de la plantilla antes de validar o generar un contrato. Una vez conocido el tipo del proveedor (persona_natural o empresa), pasa supplier_type para ver solo plantillas compatibles. Retorna id, name, code, description, status y supplier_type.',
    {
      search: z
        .string()
        .optional()
        .describe('Texto opcional para filtrar por nombre, código o descripción de la plantilla'),
      supplier_type: z
        .enum(['persona_natural', 'empresa'])
        .optional()
        .describe(
          'Filtrar por tipo de proveedor; usar una vez conocido el supplier_type del proveedor (listar_proveedores u obtener_proveedor)'
        )
    },
    async ({ search, supplier_type }) => {
      const result = await standardTemplatesService.listStandardTemplates({
        search,
        supplier_type,
        status: 'active',
      })
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'listar_clientes',
    'Lista los clientes registrados en el sistema de back office de Incrementa. Retorna id, name, brand, brand_account y sus product_campaigns. Úsala para obtener el clientId antes de generar un contrato cuando la campaña es para una marca específica.',
    {
      search: z
        .string()
        .optional()
        .describe('Texto opcional para buscar por nombre o marca del cliente')
    },
    async ({ search }) => {
      const result = await clientService.listClients({ search })
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'crear_cliente',
    'Crea un nuevo cliente (marca anunciante) en el sistema. Usa listar_clientes primero para verificar que no exista uno con el mismo nombre o marca. Retorna el cliente creado con su id.',
    {
      payload: z
        .object({})
        .passthrough()
        .describe(
          'Datos del cliente: name (obligatorio), brand (obligatorio), brand_account (opcional), product_campaigns opcional: [{ name: "nombre del producto o campaña" }]'
        )
    },
    async ({ payload }) => {
      const actor = await resolveActorProfileId(getUserProfileIdByUserId)
      if (!actor.ok) return jsonToolResult(actor)
      const result = await clientService.createClient({
        payload,
        userId: actor.profileId
      })
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'actualizar_cliente',
    'Actualiza un cliente existente por id. Acepta campos parciales; product_campaigns reemplaza la lista completa si se envía. Úsala para agregar o modificar productos/campañas de un cliente existente.',
    {
      id: z.string().uuid().describe('UUID del cliente a actualizar'),
      payload: z
        .object({})
        .passthrough()
        .describe(
          'Campos a actualizar: name, brand, brand_account (todos opcionales). product_campaigns opcional: [{ name: "nombre del producto o campaña" }] — reemplaza la lista completa.'
        )
    },
    async ({ id, payload }) => {
      const actor = await resolveActorProfileId(getUserProfileIdByUserId)
      if (!actor.ok) return jsonToolResult(actor)
      const result = await clientService.updateClient(id, {
        payload,
        userId: actor.profileId
      })
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'listar_proveedores',
    'Lista los proveedores registrados en el sistema de back office de Incrementa. Llama esta herramienta ANTES de crear un proveedor nuevo para verificar si ya existe uno con el mismo RUT o nombre y evitar duplicados. Retorna la lista con id, tipo, nombre/razón social y RUT.',
    {
      search: z
        .string()
        .optional()
        .describe('Texto opcional para buscar por nombre, razón social o RUT')
    },
    async ({ search }) => {
      const result = await supplierService.listSuppliers({ search })
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'obtener_proveedor',
    'Obtiene el detalle completo de un proveedor por su id (UUID), incluyendo redes sociales y campos según tipo Persona Natural o Empresa.',
    {
      id: z.string().uuid().describe('UUID del proveedor')
    },
    async ({ id }) => {
      const result = await supplierService.getSupplierById(id)
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'listar_catalogo_redes',
    'Lista el catálogo de redes sociales disponibles en el sistema de back office de Incrementa. Llama ANTES de crear o actualizar redes sociales de un proveedor para obtener los catalog_id (UUID) correctos. Retorna id, code y name de cada red.',
    {},
    async () => {
      const result = await supplierService.listSocialNetworkCatalog()
      if (result?.ok !== true) {
        return jsonToolResult({
          ok: false,
          code: result?.code ?? 'SOCIAL_NETWORK_CATALOG_FAILED',
          message: result?.message ?? 'No se pudo obtener el catálogo de redes sociales.'
        })
      }
      const items = (result.data?.items ?? []).map(({ id, code, name }) => ({ id, code, name }))
      return jsonToolResult({ ok: true, data: { items } })
    }
  )

  server.tool(
    'crear_proveedor',
    'Crea un nuevo proveedor global. Requiere supplier_type (persona_natural o empresa) y los campos obligatorios del tipo. Usa listar_proveedores primero para evitar duplicados. Si incluye social_networks, llama listar_catalogo_redes antes para obtener catalog_id válidos. Retorna el proveedor creado con su id.',
    {
      payload: z
        .object({})
        .passthrough()
        .describe(
          'Datos del proveedor: supplier_type, full_name/rut (persona natural) o razon_social/rut_empresa (empresa). social_networks opcional: [{ catalog_id: UUID del catálogo (ver listar_catalogo_redes), account_name: handle ej. @miempresa }]'
        )
    },
    async ({ payload }) => {
      const actor = await resolveActorProfileId(getUserProfileIdByUserId)
      if (!actor.ok) return jsonToolResult(actor)
      const result = await supplierService.createSupplier({
        payload,
        userId: actor.profileId
      })
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'actualizar_proveedor',
    'Actualiza un proveedor existente por id. Acepta campos parciales; social_networks reemplaza la lista completa si se envía (llama listar_catalogo_redes antes para obtener catalog_id válidos). No permite cambiar supplier_type.',
    {
      id: z.string().uuid().describe('UUID del proveedor a actualizar'),
      payload: z
        .object({})
        .passthrough()
        .describe(
          'Campos parciales a actualizar. social_networks opcional: [{ catalog_id: UUID del catálogo (ver listar_catalogo_redes), account_name: handle ej. @miempresa }]'
        )
    },
    async ({ id, payload }) => {
      const actor = await resolveActorProfileId(getUserProfileIdByUserId)
      if (!actor.ok) return jsonToolResult(actor)
      const result = await supplierService.updateSupplier(id, {
        payload,
        userId: actor.profileId
      })
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'listar_contratos',
    'Busca y lista contratos existentes (borradores y firmados). Úsala cuando el usuario quiera encontrar un contrato específico, revisar el historial de contratos de un proveedor o cliente, o verificar si ya existe un contrato generado. Retorna proveedor, cliente, plantilla, red social, fecha contrato, mes ejecución, precio y estado. Soporta filtros combinables.',
    {
      page: z.number().int().positive().optional().describe('Página a consultar (default: 1)'),
      supplierSearch: z.string().optional().describe('Buscar por nombre o razón social del proveedor'),
      clientId: z.string().uuid().optional().describe('UUID del cliente para filtrar (ver listar_clientes)'),
      templateId: z.string().uuid().optional().describe('UUID de la plantilla para filtrar (ver listar_plantillas)'),
      redSocialSearch: z.string().optional().describe('Buscar por nombre de red social del proveedor en el contrato (ej: Instagram)'),
      status: z.enum(['all', 'draft', 'signed']).optional().describe('Filtrar por estado: all (todos), draft (en proceso de firma), signed (firmados). Default: all')
    },
    async ({ page, supplierSearch, clientId, templateId, redSocialSearch, status }) => {
      const result = await contractsQueryService.listContracts({
        page: page ?? 1,
        pageSize: 18,
        filters: { supplierSearch, clientId, templateId, redSocialSearch, status: status ?? 'all' }
      })
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'listar_documentos_pendientes_firma',
    'Lista los contratos que están pendientes de firma electrónica (borradores activos no firmados ni rechazados). Úsala para que el usuario pueda ver qué contratos necesitan ser firmados. Retorna id, proveedor, cliente, plantilla, empresa y fecha del contrato.',
    {},
    async () => {
      const result = await contractSigningService.listPendingSignature()
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'firmar_contrato_electronico',
    'Firma electrónicamente un contrato pendiente. Agrega la página de firma al PDF, lo sube a GCS, crea el registro de documento firmado y envía el PDF firmado por email al correo de la Empresa. Requiere confirmación explícita del usuario antes de llamar esta herramienta. Retorna confirmación de éxito e información del email enviado.',
    {
      draftDocumentId: z.string().uuid().describe('UUID del borrador (draft_document) pendiente de firma')
    },
    async ({ draftDocumentId }) => {
      const actor = await resolveActorProfileId(getUserProfileIdByUserId)
      if (!actor.ok) {
        return jsonToolResult(actor)
      }

      const result = await contractSigningService.signContract({
        draftDocumentId,
        signerUserProfileId: actor.profileId
      })
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'listar_empresas',
    'Lista las empresas (parte Incrementa/contraparte contractual) disponibles para generar contratos. Retorna id, business_name, short_name (nombre comercial) y RUT formateado. Usa el id como companyId al validar o generar contratos.',
    {},
    async () => {
      try {
        const rows = await db('company')
          .select('id', 'business_name', 'short_name', 'rut_body', 'rut_dv')
          .orderBy('business_name', 'asc')
        return jsonToolResult({
          ok: true,
          data: {
            items: rows.map((row) => ({
              id: row.id,
              business_name: row.business_name,
              short_name: row.short_name,
              rut: formatCompanyRut(row)
            }))
          }
        })
      } catch (err) {
        return jsonToolResult({
          ok: false,
          code: 'COMPANY_LIST_FAILED',
          message: 'No se pudo obtener el listado de empresas.'
        })
      }
    }
  )

  const contractParams = {
    companyId: z.string().uuid().describe('UUID de la empresa (parte Incrementa)'),
    supplierId: z.string().uuid().describe('UUID del proveedor contraparte'),
    templateId: z.string().uuid().describe('UUID de la plantilla estándar (ver listar_plantillas)'),
    missingFieldOverrides: z
      .record(z.string())
      .optional()
      .describe('Valores manuales para variables de plantilla que falten en proveedor/empresa'),
    overwrite: z
      .boolean()
      .optional()
      .describe('Si true, reemplaza un borrador duplicado del mismo mes (solo generar_contrato)'),
    clientId: z
      .string()
      .uuid()
      .optional()
      .describe('UUID opcional del cliente (marca); ver listar_clientes')
  }

  server.tool(
    'validar_contrato',
    'Verifica si un contrato puede generarse con los datos actuales. NO genera PDF. Si ok es false y code es MISSING_PLACEHOLDERS, el campo data.missingFields contiene los campos faltantes. Cada campo tiene: key, label, type (text/date/select/number), options (si select), pairField (si aplica) y source (supplier/client/company/contract). REGLA CRÍTICA según source: si source=\'supplier\' → pide el dato al usuario y llama actualizar_proveedor ANTES de generar (el dato debe quedar en la BD); si source=\'client\' → pide el dato y llama actualizar_cliente ANTES de generar; si source=\'company\' → informa al usuario que debe completar los datos de la empresa en el sistema; si source=\'contract\' → pide el dato y pásalo en missingFieldOverrides. Para type=\'select\' con options string muestra las opciones numeradas y espera elección. Si una opción tiene propiedad values (objeto), agrega TODOS sus entries a missingFieldOverrides en lugar de solo el key del campo. El campo pairField indica qué variable secundaria se llena junto con la primaria (nunca aparece como campo faltante). Para type=\'number\' pide un entero no negativo; el backend formatea miles y puede auto-generar el par (ej. precio_texto desde precio_numero). Solo llama generar_contrato cuando todos los campos estén resueltos.',
    contractParams,
    async ({ companyId, supplierId, templateId, missingFieldOverrides, clientId }) => {
      const result = await documentBuilderService.generateAndPersist({
        userId: MCP_USER_ID,
        requestedCompanyId: companyId,
        body: {
          supplierId,
          template: { kind: 'standard', id: templateId },
          missingFieldOverrides,
          clientId,
          dryRun: true
        }
      })
      return jsonToolResult(mapServiceResult(result))
    }
  )

  server.tool(
    'generar_contrato',
    'Genera el PDF del contrato y lo persiste como borrador en GCS y base de datos. Requiere companyId, supplierId y templateId. Usa validar_contrato antes si no estás seguro de que los datos están completos.',
    contractParams,
    async ({ companyId, supplierId, templateId, missingFieldOverrides, overwrite, clientId }) => {
      const result = await documentBuilderService.generateAndPersist({
        userId: MCP_USER_ID,
        requestedCompanyId: companyId,
        body: {
          supplierId,
          template: { kind: 'standard', id: templateId },
          missingFieldOverrides,
          overwrite,
          clientId
        }
      })
      return jsonToolResult(mapServiceResult(result))
    }
  )

  const SIGNED_URL_EXPIRES_MINUTES = 60

  server.tool(
    'obtener_url_contrato',
    'Genera una URL temporal firmada para abrir el PDF de un borrador de contrato en el navegador. Úsala inmediatamente después de generar_contrato si el usuario quiere ver el PDF, o cuando el usuario pregunte por un contrato ya generado. Requiere documentId (UUID del borrador retornado por generar_contrato en data.documents[0].id). La URL es válida por 60 minutos.',
    {
      documentId: z
        .string()
        .uuid()
        .describe('UUID del borrador (draft_document) retornado por generar_contrato')
    },
    async ({ documentId }) => {
      try {
        const row = await db('draft_document')
          .select('id', 'file_name', 'gcs_path')
          .where({ id: documentId })
          .first()

        if (!row) {
          return jsonToolResult({
            ok: false,
            code: 'NOT_FOUND',
            message: 'Borrador no encontrado.'
          })
        }

        if (!row.gcs_path || String(row.gcs_path).trim() === '') {
          return jsonToolResult({
            ok: false,
            code: 'GCS_PATH_MISSING',
            message: 'El borrador no tiene archivo asociado en almacenamiento.'
          })
        }

        const expiresInMinutes = SIGNED_URL_EXPIRES_MINUTES
        const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()

        let signedUrl
        try {
          signedUrl = await gcsService.getSignedUrl({
            gcsPath: row.gcs_path,
            expiresInMinutes
          })
        } catch {
          return jsonToolResult({
            ok: false,
            code: 'SIGNED_URL_FAILED',
            message: 'No se pudo generar la URL de acceso al PDF.'
          })
        }

        return jsonToolResult({
          ok: true,
          data: {
            documentId: row.id,
            file_name: row.file_name,
            signedUrl,
            expiresInMinutes,
            expiresAt
          }
        })
      } catch {
        return jsonToolResult({
          ok: false,
          code: 'SIGNED_URL_FAILED',
          message: 'No se pudo generar la URL de acceso al PDF.'
        })
      }
    }
  )
}
