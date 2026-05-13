const express = require('express')
const cors = require('cors')
const config = require('./config')
const { requireSupabaseAuth } = require('./middleware/requireSupabaseAuth')
const { requireNavigationGrant, createRequireNavigationGrant } = require('./middleware/requireNavigationGrant')
const { createRequireClauseUniversalGrant } = require('./middleware/requireClauseUniversalGrant')
const { createRequireClauseByIdGrant } = require('./middleware/requireClauseByIdGrant')
const { createRequireCompanyClauseScope } = require('./middleware/requireCompanyClauseScope')
const { resolveCompanyScopeByUserId } = require('./services/companyScopeService')
const { getCurrentUserProfile } = require('./services/profileService')
const { getUserProfileIdByUserId } = require('./services/profileService')
const { createClauseService } = require('./services/clauseService')
const { createClauseController } = require('./controllers/clauseController')
const { createCompanyController } = require('./controllers/companyController')
const { sendOk } = require('./http/responses')
const { db } = require('./db/knex')
const {
  buildEnrichedSessionSuccessBody,
  buildNoProfileAssignedBody,
  buildAccountantInactiveBody,
  buildUserInactiveBody
} = require('./sessionResponses')
const { loadSessionMetaForUser } = require('./services/userSessionMetaService')
const { createAccountantPlatformController } = require('./controllers/accountantPlatformController')
const { createPlatformUsersController } = require('./controllers/platformUsersController')
const { createInternalCompanyUsersController } = require('./controllers/internalCompanyUsersController')
const { createEmployeeController } = require('./controllers/employeeController')
const { createStandardTemplatesService } = require('./services/standardTemplatesService')
const { createStandardTemplatesController } = require('./controllers/standardTemplatesController')
const { createCompanyTemplatesService } = require('./services/companyTemplatesService')
const { createCompanyTemplatesController } = require('./controllers/companyTemplatesController')
const { createDocumentBuilderService } = require('./services/documentBuilderService')
const { createDocumentBuilderController } = require('./controllers/documentBuilderController')
const {
  getEffectiveNavigationForUser,
  buildNavigationTree,
  buildGrantedRouteList,
  buildGrantedCodesList
} = require('./services/authorizationService')
const { createMeNavigationHandler } = require('./controllers/meNavigationController')
const { listAssignedCompaniesForAccountant } = require('./services/accountantAssignedCompaniesService')

function createApp({
  corsOrigin = config.CORS_ORIGIN,
  requireAuth = requireSupabaseAuth,
  requireGrant = requireNavigationGrant,
  effectiveNavigationResolver = getEffectiveNavigationForUser,
  sessionMetaResolver = loadSessionMetaForUser,
  clauseService = null,
  companyService = null,
  userProfileIdResolver = getUserProfileIdByUserId,
  companyScopeResolver = null,
  companyContextResolver = null,
  accountantAssignedCompaniesLoader = listAssignedCompaniesForAccountant,
  standardTemplatesService: standardTemplatesServiceInjected = null,
  companyTemplatesService: companyTemplatesServiceInjected = null
} = {}) {
  const app = express()

  const grantMiddleware =
    requireGrant !== requireNavigationGrant
      ? requireGrant
      : effectiveNavigationResolver !== getEffectiveNavigationForUser
        ? createRequireNavigationGrant({ effectiveNavigationResolver })
        : requireNavigationGrant

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

  async function defaultCompanyContextResolver(userId, profileCode) {
    if (profileCode !== 'USUARIO_EMPRESA_ADMINISTRADOR') return null
    const scope = await (companyScopeResolver ?? resolveCompanyScopeByUserId)(userId)
    if (!scope || scope.mode !== 'single' || !scope.companyId) return null
    const row = await db('company').select('id', 'business_name').where({ id: scope.companyId }).first()
    if (!row) return { id: scope.companyId, business_name: null }
    return { id: row.id, business_name: row.business_name ?? null }
  }

  async function enrichedSessionPayload(userId, email, result, sessionMeta) {
    const { profile, rows } = result
    const sessionMetaBody = {
      mustChangePassword: sessionMeta.mustChangePassword,
      isActive:
        profile.code === 'CONTADOR'
          ? sessionMeta.accountantIsActive === true || sessionMeta.accountantIsActive === false
            ? sessionMeta.accountantIsActive
            : undefined
          : sessionMeta.userIsActive === true || sessionMeta.userIsActive === false
            ? sessionMeta.userIsActive
            : undefined
    }
    const body = buildEnrichedSessionSuccessBody(
      userId,
      email,
      { code: profile.code, label: profile.label },
      {
        tree: buildNavigationTree(rows),
        routes: buildGrantedRouteList(rows),
        grantedCodes: buildGrantedCodesList(rows)
      },
      sessionMetaBody,
      sessionMeta.displayName
    )
    const resolveCompany = typeof companyContextResolver === 'function' ? companyContextResolver : defaultCompanyContextResolver
    if (resolveCompany) {
      const company = await resolveCompany(userId, profile.code)
      if (company) body.company = company
    }
    if (profile.code === 'CONTADOR' && typeof accountantAssignedCompaniesLoader === 'function') {
      body.assignedCompanies = await accountantAssignedCompaniesLoader(userId)
    }
    return body
  }

  async function respondEnrichedSession(req, res) {
    const { userId, email } = req.auth
    const result = await effectiveNavigationResolver(userId)
    if (!result) {
      return res.status(404).json(buildNoProfileAssignedBody(userId, email))
    }
    const sessionMeta = await sessionMetaResolver(userId, result.profile.code)
    if (result.profile.code === 'CONTADOR' && sessionMeta.accountantIsActive === false) {
      return res.status(403).json(buildAccountantInactiveBody(userId, email))
    }
    if (result.profile.code !== 'CONTADOR' && sessionMeta.userIsActive === false) {
      return res.status(403).json(buildUserInactiveBody(userId, email))
    }
    return res.status(200).json(await enrichedSessionPayload(userId, email, result, sessionMeta))
  }

  // Enriched current session (primary contract: identity + profile + DB navigation)
  app.get('/api/me/session', requireAuth, respondEnrichedSession)

  // Legacy alias: same payload as /api/me/session (single source of truth for authorization read model)
  app.get('/api/me/authorization/current', requireAuth, respondEnrichedSession)

  const accountantPlatformController = createAccountantPlatformController()
  const platformUsersController = createPlatformUsersController()
  const internalCompanyUsersController = createInternalCompanyUsersController()
  const employeeController = createEmployeeController()

  const standardTemplatesService = standardTemplatesServiceInjected ?? createStandardTemplatesService({ db })
  const standardTemplatesController = createStandardTemplatesController({
    standardTemplatesService,
    getUserProfileIdByUserId: userProfileIdResolver,
  })

  const companyTemplatesService = companyTemplatesServiceInjected ?? createCompanyTemplatesService({ db })
  const companyTemplatesController = createCompanyTemplatesController({
    companyTemplatesService,
    getUserProfileIdByUserId: userProfileIdResolver,
  })

  const documentBuilderService = createDocumentBuilderService({ db })
  const documentBuilderController = createDocumentBuilderController({ documentBuilderService })

  app.post('/api/me/password-rotation-complete', requireAuth, accountantPlatformController.postPasswordRotationComplete)

  // Dedicated navigation endpoint (hierarchical, filtered by assigned profile)
  app.get(
    '/api/me/navigation',
    requireAuth,
    createMeNavigationHandler({
      getEffectiveNavigationForUser: effectiveNavigationResolver,
      buildNavigationTree,
      buildGrantedRouteList
    })
  )

  // Technical endpoint: current profile (protected; legacy shape — prefer /api/me/session)
  app.get('/api/me/profile', requireAuth, async (req, res) => {
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

  // Module placeholder APIs (protected by effective DB authorization)
  app.get(
    '/api/modules/dashboard',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_DASHBOARD' }),
    (req, res) => res.status(200).json({ ok: true, module: 'dashboard' })
  )

  app.get(
    '/api/modules/contratos',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_CONTRATOS' }),
    (req, res) => res.status(200).json({ ok: true, module: 'contratos' })
  )

  app.get(
    '/api/modules/proveedores',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_PROVEEDORES' }),
    (req, res) => res.status(200).json({ ok: true, module: 'proveedores' })
  )

  app.get(
    '/api/modules/configuracion',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_CONFIGURACION' }),
    (req, res) => res.status(200).json({ ok: true, module: 'configuracion' })
  )

  app.get(
    '/api/modules/usuarios',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_USUARIOS' }),
    (req, res) => res.status(200).json({ ok: true, module: 'usuarios' })
  )

  app.get(
    '/api/modules/reportes',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_REPORTES' }),
    (req, res) => res.status(200).json({ ok: true, module: 'reportes' })
  )

  // Placeholder API (enveloped) — used by connected placeholder screens
  app.get(
    '/api/placeholder/dashboard',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_DASHBOARD' }),
    (req, res) => {
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
    }
  )

  app.get(
    '/api/placeholder/contratos/list',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_CONTRATOS' }),
    (req, res) => {
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
    }
  )

  // Clause persistence APIs (protected; minimal CRUD for editor)
  const clauseSvc = clauseService ?? createClauseService({ db: require('./db/knex').db })
  const clauseController = createClauseController({
    clauseService: clauseSvc,
    getUserProfileIdByUserId: userProfileIdResolver,
    companyScopeResolver: companyScopeResolver ?? resolveCompanyScopeByUserId,
    effectiveNavigationResolver
  })

  const requireClauseUniversalGrant = createRequireClauseUniversalGrant({
    effectiveNavigationResolver
  })
  const requireClauseByIdGrant =
    clauseSvc && typeof clauseSvc.getClauseDetail === 'function'
      ? createRequireClauseByIdGrant({
          effectiveNavigationResolver,
          clauseService: clauseSvc,
          companyScopeResolver: companyScopeResolver ?? resolveCompanyScopeByUserId
        })
      : () => (_req, _res, next) => next()

  const requireCompanyClauseScope = createRequireCompanyClauseScope({
    companyScopeResolver: companyScopeResolver ?? resolveCompanyScopeByUserId
  })

  app.post(
    '/api/clauses/universal',
    requireAuth,
    requireClauseUniversalGrant({ navigationCode: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_CREATE' }),
    clauseController.postUniversal
  )
  app.post(
    '/api/clauses/company',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_CREATE' }),
    clauseController.postCompany
  )
  app.get(
    '/api/clauses/company',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_READ' }),
    clauseController.getCompanyList
  )
  app.get(
    '/api/clauses/universal',
    requireAuth,
    requireClauseUniversalGrant({ navigationCode: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ' }),
    clauseController.getUniversalList
  )
  app.post('/api/clauses/resolve-read', requireAuth, clauseController.postResolveRead)
  app.get(
    '/api/clauses/:id',
    requireAuth,
    requireClauseByIdGrant({
      universalNavigationCode: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_READ',
      companyNavigationCode: 'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_READ'
    }),
    clauseController.getDetail
  )
  app.put(
    '/api/clauses/:id',
    requireAuth,
    requireClauseByIdGrant({
      universalNavigationCode: 'NAV_ACTION_CONTRATOS_CLAUSULAS_UNIVERSALES_EDIT',
      companyNavigationCode: 'NAV_ACTION_CONTRATOS_CLAUSULAS_POR_EMPRESA_EDIT'
    }),
    clauseController.putUpdate
  )

  // Companies CRUD + accountants association (protected by navigation grants + scope)
  const companySvc = companyService ?? require('./services/companyService')
  const companyController = createCompanyController({ companyService: companySvc })

  app.get(
    '/api/companies',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_READ' }),
    companyController.getList
  )
  app.get(
    '/api/companies/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_READ' }),
    companyController.getDetail
  )
  app.post(
    '/api/companies',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_CREATE' }),
    companyController.postCreate
  )
  app.put(
    '/api/companies/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_EDIT' }),
    companyController.putUpdate
  )
  app.get(
    '/api/accountants',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS' }),
    companyController.getAccountantsCatalog
  )
  app.get(
    '/api/companies/:id/accountants',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_READ' }),
    companyController.getCompanyAccountants
  )
  app.put(
    '/api/companies/:id/accountants',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_EMPRESAS_ASSIGN_ACCOUNTANTS' }),
    companyController.putCompanyAccountants
  )

  app.get(
    '/api/platform/accountants',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_READ' }),
    accountantPlatformController.getList
  )
  app.get(
    '/api/platform/accountants/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_READ' }),
    accountantPlatformController.getDetail
  )
  app.post(
    '/api/platform/accountants',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_CREATE' }),
    accountantPlatformController.postCreate
  )
  app.put(
    '/api/platform/accountants/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_CONTADORES_EDIT' }),
    accountantPlatformController.putUpdate
  )

  app.get(
    '/api/platform/users',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_READ' }),
    platformUsersController.getList
  )
  app.get(
    '/api/platform/users/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_READ' }),
    platformUsersController.getDetail
  )
  app.post(
    '/api/platform/users',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_CREATE' }),
    platformUsersController.postCreate
  )
  app.put(
    '/api/platform/users/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_PLATAFORMA_EDIT' }),
    platformUsersController.putUpdate
  )

  app.get(
    '/api/company-internal-users',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_READ' }),
    internalCompanyUsersController.getList
  )
  app.get(
    '/api/company-internal-users/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_READ' }),
    internalCompanyUsersController.getDetail
  )
  app.post(
    '/api/company-internal-users',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_CREATE' }),
    internalCompanyUsersController.postCreate
  )
  app.put(
    '/api/company-internal-users/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_ADMIN_GLOBAL_USUARIOS_INTERNOS_EMPRESA_EDIT' }),
    internalCompanyUsersController.putUpdate
  )

  app.get(
    '/api/employees/lookup',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_TRABAJADORES_TRABAJADORES_READ' }),
    employeeController.getLookup
  )
  app.get(
    '/api/employees',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_TRABAJADORES_TRABAJADORES_READ' }),
    employeeController.getList
  )
  app.get(
    '/api/employees/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_TRABAJADORES_TRABAJADORES_READ' }),
    employeeController.getDetail
  )
  app.post(
    '/api/employees',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE' }),
    employeeController.postCreate
  )
  app.put(
    '/api/employees/:id',
    requireAuth,
    grantMiddleware({
      anyOfNavigationCodes: [
        'NAV_ACTION_TRABAJADORES_TRABAJADORES_EDIT',
        'NAV_ACTION_TRABAJADORES_TRABAJADORES_CREATE'
      ]
    }),
    employeeController.putUpdate
  )

  app.get(
    '/api/document-builder/templates',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO' }),
    documentBuilderController.getTemplates
  )
  app.get(
    '/api/document-builder/templates/:kind/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO' }),
    documentBuilderController.getTemplateDetail
  )
  app.post(
    '/api/document-builder/generate',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO' }),
    documentBuilderController.postGenerate
  )
  app.get(
    '/api/document-builder/downloads/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ITEM_CONTRATOS_CONSTRUCTOR_DOCUMENTO' }),
    documentBuilderController.getDownload
  )

  app.get(
    '/api/standard-templates',
    requireAuth,
    requireClauseUniversalGrant({ navigationCode: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ' }),
    standardTemplatesController.getList
  )
  app.post(
    '/api/standard-templates',
    requireAuth,
    requireClauseUniversalGrant({ navigationCode: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_CREATE' }),
    standardTemplatesController.postCreate
  )
  app.get(
    '/api/standard-templates/:id',
    requireAuth,
    requireClauseUniversalGrant({ navigationCode: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_READ' }),
    standardTemplatesController.getById
  )
  app.put(
    '/api/standard-templates/:id',
    requireAuth,
    requireClauseUniversalGrant({ navigationCode: 'NAV_ACTION_CONTRATOS_TEMPLATES_ESTANDAR_EDIT' }),
    standardTemplatesController.putUpdate
  )

  app.get(
    '/api/company-templates',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_READ' }),
    companyTemplatesController.getList
  )
  app.post(
    '/api/company-templates',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_CREATE' }),
    companyTemplatesController.postCreate
  )
  app.get(
    '/api/company-templates/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_READ' }),
    companyTemplatesController.getById
  )
  app.put(
    '/api/company-templates/:id',
    requireAuth,
    grantMiddleware({ navigationCode: 'NAV_ACTION_CONTRATOS_TEMPLATES_POR_EMPRESA_EDIT' }),
    companyTemplatesController.putUpdate
  )

  return app
}

const app = createApp()

module.exports = { app, createApp }

