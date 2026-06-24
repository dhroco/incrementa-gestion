const express = require('express')
const cors = require('cors')
const config = require('./config')
const { requireOidcAuth } = require('./middleware/requireOidcAuth')
const { resolveInternalIdentity } = require('./middleware/resolveInternalIdentity')
const { attachAbility } = require('./middleware/attachAbility')
const { authorize, authorizeAny } = require('./middleware/authorize')
const { getCurrentUserProfile } = require('./services/profileService')
const { getUserProfileIdByUserId } = require('./services/profileService')
const { createCompanyController } = require('./controllers/companyController')
const { sendOk } = require('./http/responses')
const { db } = require('./db/knex')
const {
  buildEnrichedSessionSuccessBody,
  buildNoProfileAssignedBody,
  buildUserInactiveBody
} = require('./sessionResponses')
const { loadSessionMetaForUser } = require('./services/userSessionMetaService')
const { createPlatformUsersController } = require('./controllers/platformUsersController')
const platformUsersAdminService = require('./services/platformUsersAdminService')
const { createSupplierController } = require('./controllers/supplierController')
const supplierServiceDefault = require('./services/supplierService')
const { createClientsController } = require('./controllers/clientsController')
const clientServiceDefault = require('./services/clientService')
const { createStandardTemplatesService } = require('./services/standardTemplatesService')
const { createStandardTemplatesController } = require('./controllers/standardTemplatesController')
const { createDocumentBuilderService } = require('./services/documentBuilderService')
const { gcsService } = require('./services/gcsService')
const { createDocumentBuilderController } = require('./controllers/documentBuilderController')
const { buildPackedRulesForUser } = require('./services/abilityService')
const { createMeController, createAvatarUploadRouteHandler } = require('./controllers/meController')
const { createRolesController } = require('./controllers/rolesController')
const rolesServiceDefault = require('./services/rolesService')
const { createDashboardService } = require('./services/dashboardService')
const { createDashboardController } = require('./controllers/dashboardController')
const { createContractsQueryService } = require('./services/contractsQueryService')
const { createContractsController } = require('./controllers/contractsController')
const { createContractSigningService } = require('./services/contractSigningService')
const { createContractSigningController } = require('./controllers/contractSigningController')
const emailService = require('./services/emailService')

function createApp({
  corsOrigin = config.CORS_ORIGIN,
  requireAuth = requireOidcAuth,
  resolveInternalIdentityMiddleware,
  attachAbilityMiddleware = attachAbility(),
  buildPackedRulesForUser: buildPackedRules = buildPackedRulesForUser,
  sessionMetaResolver = loadSessionMetaForUser,
  companyService = null,
  userProfileIdResolver = getUserProfileIdByUserId,
  standardTemplatesService: standardTemplatesServiceInjected = null,
  supplierService: supplierServiceInjected = null,
  clientService: clientServiceInjected = null,
  documentBuilderService: documentBuilderServiceInjected = null,
  rolesService: rolesServiceInjected = null,
  platformUsersService: platformUsersServiceInjected = null,
  dashboardService: dashboardServiceInjected = null,
  contractsQueryService: contractsQueryServiceInjected = null,
  contractSigningService: contractSigningServiceInjected = null,
  emailService: emailServiceInjected = emailService,
  gcsService: gcsServiceInjected = gcsService,
  meController: meControllerInjected = null
} = {}) {
  const app = express()

  app.use(express.json())
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true
    })
  )

  app.get('/health', (req, res) => {
    return res.status(200).json({
      status: 'ok',
      environment: config.ENVIRONMENT
    })
  })

  app.get('/', (req, res) => {
    return res.status(200).json({
      status: 'OK',
      message: 'Backend is running',
      environment: config.ENVIRONMENT,
      timestamp: new Date().toISOString()
    })
  })

  const effectiveResolveInternalIdentity =
    resolveInternalIdentityMiddleware ??
    (requireAuth === requireOidcAuth
      ? resolveInternalIdentity({ db })
      : (_req, _res, next) => next())

  app.use(requireAuth)
  app.use(effectiveResolveInternalIdentity)
  app.use(attachAbilityMiddleware)

  async function enrichedSessionPayload(userId, email, packedResult, sessionMeta) {
    const { packedRules, profile } = packedResult
    let avatarUrl = null
    if (sessionMeta.avatarGcsPath) {
      avatarUrl = await gcsServiceInjected.getSignedUrl({
        gcsPath: sessionMeta.avatarGcsPath,
        expiresInMinutes: 1440
      })
    }
    const sessionMetaBody = {
      isActive:
        sessionMeta.userIsActive === true || sessionMeta.userIsActive === false
          ? sessionMeta.userIsActive
          : undefined,
      contactEmail: sessionMeta.contactEmail ?? undefined,
      widgetPreferences: sessionMeta.widgetPreferences ?? undefined,
      avatarUrl: avatarUrl ?? undefined
    }
    return buildEnrichedSessionSuccessBody(
      userId,
      email,
      { code: profile.code, label: profile.label },
      packedRules,
      sessionMetaBody,
      sessionMeta.displayName
    )
  }

  async function respondEnrichedSession(req, res) {
    const { userId, email } = req.auth
    const packedResult = await buildPackedRules(userId)
    if (!packedResult?.profile) {
      return res.status(404).json(buildNoProfileAssignedBody(userId, email))
    }
    const sessionMeta = await sessionMetaResolver(userId)
    if (sessionMeta.userIsActive === false) {
      return res.status(403).json(buildUserInactiveBody(userId, email))
    }
    return res.status(200).json(await enrichedSessionPayload(userId, email, packedResult, sessionMeta))
  }

  app.get('/api/me/session', respondEnrichedSession)
  app.get('/api/me/authorization/current', respondEnrichedSession)

  const platformUsersController = createPlatformUsersController({
    platformUsersService: platformUsersServiceInjected ?? platformUsersAdminService
  })
  const rolesController = createRolesController({
    rolesService: rolesServiceInjected ?? rolesServiceDefault
  })
  const supplierController = createSupplierController({
    service: supplierServiceInjected ?? supplierServiceDefault,
    getUserProfileIdByUserId: userProfileIdResolver
  })
  const clientsController = createClientsController({
    service: clientServiceInjected ?? clientServiceDefault,
    getUserProfileIdByUserId: userProfileIdResolver
  })

  const standardTemplatesService = standardTemplatesServiceInjected ?? createStandardTemplatesService({ db })
  const standardTemplatesController = createStandardTemplatesController({
    standardTemplatesService,
    getUserProfileIdByUserId: userProfileIdResolver
  })

  const documentBuilderService =
    documentBuilderServiceInjected ??
    createDocumentBuilderService({
      db,
      gcsService,
      getUserProfileIdByUserId: userProfileIdResolver
    })
  const documentBuilderController = createDocumentBuilderController({ documentBuilderService })

  const dashboardService = dashboardServiceInjected ?? createDashboardService({ db })
  const dashboardController = createDashboardController({ dashboardService })

  const contractsQueryService =
    contractsQueryServiceInjected ??
    createContractsQueryService({
      db,
      gcsService
    })
  const contractsController = createContractsController({ service: contractsQueryService })

  const contractSigningService =
    contractSigningServiceInjected ??
    createContractSigningService({
      db,
      gcsService: gcsServiceInjected,
      emailService: emailServiceInjected
    })
  const contractSigningController = createContractSigningController({
    service: contractSigningService,
    userProfileIdResolver: userProfileIdResolver
  })

  const meController =
    meControllerInjected ??
    createMeController({
      db,
      gcsService: gcsServiceInjected
    })
  const avatarUpload = createAvatarUploadRouteHandler()
  app.put('/api/me/profile', meController.putProfile)
  app.post('/api/me/avatar', avatarUpload, meController.postAvatar)

  app.get('/api/me/profile', async (req, res) => {
    const { userId, email } = req.auth
    const profile = await getCurrentUserProfile(userId)
    if (!profile) {
      return res.status(404).json(buildNoProfileAssignedBody(userId, email))
    }
    return res.status(200).json({
      user: { id: userId, email: email ?? null },
      profile: { code: profile.code, label: profile.label }
    })
  })

  app.get('/api/modules/dashboard', authorize('read', 'Dashboard'), (req, res) =>
    res.status(200).json({ ok: true, module: 'dashboard' })
  )

  app.get('/api/modules/contratos', authorize('read', 'All'), (req, res) =>
    res.status(200).json({ ok: true, module: 'contratos' })
  )

  app.get('/api/modules/proveedores', authorize('read', 'Supplier'), (req, res) =>
    res.status(200).json({ ok: true, module: 'proveedores' })
  )

  app.get('/api/modules/configuracion', authorize('read', 'All'), (req, res) =>
    res.status(200).json({ ok: true, module: 'configuracion' })
  )

  app.get('/api/modules/usuarios', authorize('read', 'PlatformUser'), (req, res) =>
    res.status(200).json({ ok: true, module: 'usuarios' })
  )

  app.get('/api/modules/reportes', authorize('read', 'All'), (req, res) =>
    res.status(200).json({ ok: true, module: 'reportes' })
  )

  app.get('/api/placeholder/dashboard', authorize('read', 'Dashboard'), (req, res) => {
    return sendOk(res, {
      cards: [
        { key: 'contratosActivos', label: 'Contratos activos', value: 24 },
        { key: 'proveedores', label: 'Proveedores', value: 12 },
        { key: 'pendientes', label: 'Pendientes', value: 7 }
      ],
      highlights: {
        title: 'Actividad reciente',
        items: [
          { id: 'a1', label: 'Contrato GC-2026-014', status: 'En revisión', date: '2026-04-14' },
          { id: 'a2', label: 'Proveedor ACME Ltda.', status: 'Actualizado', date: '2026-04-13' }
        ]
      }
    })
  })

  app.get('/api/dashboard/stats', authorize('read', 'Dashboard'), dashboardController.getStats)

  app.get('/api/placeholder/contratos/list', authorize('read', 'All'), (req, res) => {
    return sendOk(
      res,
      {
        items: [
          {
            id: 'c-001',
            code: 'GC-2026-001',
            title: 'Servicio de soporte TI',
            provider: 'ACME Ltda.',
            status: 'Vigente',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            amountCLP: 12500000
          },
          {
            id: 'c-002',
            code: 'GC-2026-002',
            title: 'Suministro de insumos',
            provider: 'Proveedores Chile SpA',
            status: 'En revisión',
            startDate: '2026-03-01',
            endDate: '2027-02-28',
            amountCLP: 6400000
          }
        ]
      },
      { meta: { total: 2, module: 'contratos' } }
    )
  })

  const companySvc = companyService ?? require('./services/companyService')
  const companyController = createCompanyController({ companyService: companySvc })

  app.get('/api/companies', authorize('read', 'Company'), companyController.getList)
  app.get('/api/companies/:id', authorize('read', 'Company'), companyController.getDetail)
  app.post('/api/companies', authorize('create', 'Company'), companyController.postCreate)
  app.put('/api/companies/:id', authorize('update', 'Company'), companyController.putUpdate)

  app.get('/api/platform/users', authorize('read', 'PlatformUser'), platformUsersController.getList)
  app.get('/api/platform/users/roles', authorize('read', 'PlatformUser'), platformUsersController.getRoleOptions)
  app.get('/api/platform/users/:id', authorize('read', 'PlatformUser'), platformUsersController.getDetail)
  app.post('/api/platform/users', authorize('create', 'PlatformUser'), platformUsersController.postCreate)
  app.put('/api/platform/users/:id', authorize('update', 'PlatformUser'), platformUsersController.putUpdate)

  app.get('/api/roles', authorize('read', 'RolePermission'), rolesController.getList)
  app.post('/api/roles', authorize('create', 'RolePermission'), rolesController.postCreate)
  app.get('/api/roles/:id', authorize('read', 'RolePermission'), rolesController.getById)
  app.put('/api/roles/:id/label', authorize('update', 'RolePermission'), rolesController.putUpdateLabel)
  app.delete('/api/roles/:id', authorize('update', 'RolePermission'), rolesController.deleteRole)
  app.put('/api/roles/:id/permissions', authorize('update', 'RolePermission'), rolesController.putPermissions)

  app.get('/api/social-networks/catalog', authorize('read', 'Supplier'), supplierController.getSocialNetworkCatalog)
  app.get('/api/suppliers', authorize('read', 'Supplier'), supplierController.getList)
  app.get('/api/suppliers/:id/documents', authorize('read', 'Supplier'), supplierController.getDocuments)
  app.get(
    '/api/suppliers/:id/documents/:documentId/view',
    authorize('read', 'Supplier'),
    supplierController.getDocumentView
  )
  app.get('/api/suppliers/:id', authorize('read', 'Supplier'), supplierController.getDetail)
  app.post('/api/suppliers', authorize('create', 'Supplier'), supplierController.postCreate)
  app.put(
    '/api/suppliers/:id',
    authorizeAny(['update', 'create'], 'Supplier'),
    supplierController.putUpdate
  )

  app.get('/api/clients', authorize('read', 'Client'), clientsController.getList)
  app.get('/api/clients/:id', authorize('read', 'Client'), clientsController.getDetail)
  app.post('/api/clients', authorize('create', 'Client'), clientsController.postCreate)
  app.put('/api/clients/:id', authorize('update', 'Client'), clientsController.putUpdate)

  app.get('/api/contracts', authorize('read', 'Contract'), contractsController.getList)
  app.get(
    '/api/contracts/pending-signature',
    authorize('sign', 'Contract'),
    contractSigningController.getList
  )
  app.post('/api/contracts/:id/sign', authorize('sign', 'Contract'), contractSigningController.postSign)
  app.get('/api/contracts/:id/pdf', authorize('read', 'Contract'), contractsController.getPdf)

  app.get(
    '/api/document-builder/templates',
    authorize('use', 'DocumentBuilder'),
    documentBuilderController.getTemplates
  )
  app.get(
    '/api/document-builder/templates/:kind/:id',
    authorize('use', 'DocumentBuilder'),
    documentBuilderController.getTemplateDetail
  )
  app.post(
    '/api/document-builder/generate',
    authorize('use', 'DocumentBuilder'),
    documentBuilderController.postGenerate
  )
  app.get(
    '/api/document-builder/downloads/:id',
    authorize('use', 'DocumentBuilder'),
    documentBuilderController.getDownload
  )

  app.get('/api/standard-templates', authorize('read', 'Template'), standardTemplatesController.getList)
  app.post('/api/standard-templates', authorize('create', 'Template'), standardTemplatesController.postCreate)
  app.get('/api/standard-templates/:id', authorize('read', 'Template'), standardTemplatesController.getById)
  app.put('/api/standard-templates/:id', authorize('update', 'Template'), standardTemplatesController.putUpdate)

  return app
}

const app = createApp()

module.exports = { app, createApp }
