const { db } = require('../db/knex')
const { parseRut } = require('../utils/rut')
const { resolveEmployeeCompanyScope } = require('../lib/resolveEmployeeCompanyScope')

const SEX = new Set(['M', 'F', 'X'])

function isValidEmail(s) {
  const t = String(s || '').trim()
  if (!t) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

function formatRutDisplay(rutBody, rutDv) {
  if (!rutBody) return ''
  return `${rutBody}-${rutDv ?? ''}`
}

function toMoney(n) {
  if (n == null || n === '') return 0
  const x = Number(n)
  return Number.isFinite(x) ? x : 0
}

function parseISODate(s) {
  if (s == null || s === '') return null
  const t = String(s).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return { ok: false, message: 'Use el formato AAAA-MM-DD.' }
  const d = new Date(`${t}T12:00:00`)
  if (Number.isNaN(d.getTime())) return { ok: false, message: 'La fecha no es válida.' }
  return { ok: true, value: t }
}

function validatePayload(body, { partial = false } = {}) {
  const errors = []
  const out = {}

  if (!partial || body?.full_name !== undefined) {
    const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
    if (!fullName) errors.push('El nombre completo es obligatorio.')
    else out.full_name = fullName
  }

  if (!partial || body?.email !== undefined) {
    const em = typeof body?.email === 'string' ? body.email.trim() : ''
    if (!em) {
      if (!partial) errors.push('El correo electrónico es obligatorio.')
    } else if (!isValidEmail(em)) {
      errors.push('Ingrese un correo electrónico válido.')
    } else {
      out.email = em
    }
  }

  if (!partial || body?.rut !== undefined) {
    if (body?.rut == null || String(body.rut).trim() === '') {
      errors.push('El RUT es obligatorio.')
    } else {
      const r = parseRut(body.rut)
      if (!r.ok) errors.push(r.message)
      else {
        out.rut_body = r.rut_body
        out.rut_dv = r.rut_dv
      }
    }
  }

  if (!partial || body?.nationality !== undefined) {
    out.nationality =
      body?.nationality == null || String(body.nationality).trim() === ''
        ? null
        : String(body.nationality).trim()
  }

  if (!partial || body?.sex !== undefined) {
    const sx = body?.sex == null ? '' : String(body.sex).trim().toUpperCase()
    if (!partial && !sx) errors.push('Debe indicar el sexo.')
    else if (sx && !SEX.has(sx)) errors.push('El sexo debe ser M, F o X.')
    else out.sex = sx || null
  }

  if (!partial || body?.marital_status !== undefined) {
    out.marital_status =
      body?.marital_status == null || String(body.marital_status).trim() === ''
        ? null
        : String(body.marital_status).trim()
  }

  for (const key of ['address', 'commune', 'city', 'prevision_salud', 'fondo_pension']) {
    if (partial && body?.[key] === undefined) continue
    out[key] =
      body?.[key] == null || String(body[key]).trim() === '' ? null : String(body[key]).trim()
  }

  if (!partial || body?.date_of_birth !== undefined) {
    if (body?.date_of_birth == null || String(body.date_of_birth).trim() === '') {
      if (!partial) errors.push('La fecha de nacimiento es obligatoria.')
      else out.date_of_birth = null
    } else {
      const d = parseISODate(body.date_of_birth)
      if (!d.ok) errors.push(d.message)
      else out.date_of_birth = d.value
    }
  }

  if (!partial || body?.hire_date !== undefined) {
    if (body?.hire_date == null || String(body.hire_date).trim() === '') {
      if (!partial) errors.push('La fecha de ingreso es obligatoria.')
      else out.hire_date = null
    } else {
      const d = parseISODate(body.hire_date)
      if (!d.ok) errors.push(d.message)
      else out.hire_date = d.value
    }
  }

  if (!partial || body?.position_id !== undefined) {
    const pid = body?.position_id
    if (pid == null || String(pid).trim() === '') {
      if (!partial) errors.push('Debe seleccionar un cargo.')
    } else {
      out.position_id = String(pid).trim()
    }
  }

  if (!partial || body?.work_schedule_id !== undefined) {
    const wid = body?.work_schedule_id
    if (wid == null || String(wid).trim() === '') {
      if (!partial) errors.push('Debe seleccionar una jornada.')
    } else {
      out.work_schedule_id = String(wid).trim()
    }
  }

  const moneyKeys = [
    'base_salary',
    'gratification',
    'transport_allowance',
    'meal_allowance',
    'bonuses',
    'commissions'
  ]
  for (const k of moneyKeys) {
    if (partial && body?.[k] === undefined) continue
    const v = toMoney(body?.[k])
    if (v < 0) {
      errors.push(`El monto de ${k} no puede ser negativo.`)
    } else {
      out[k] = v
    }
  }

  if (!partial || body?.is_active !== undefined) {
    if (body?.is_active === undefined) {
      if (!partial) out.is_active = true
    } else {
      out.is_active = body.is_active === true || body.is_active === 'true' || body.isActive === true
    }
  }

  return { ok: errors.length === 0, errors, data: out }
}

async function assertPositionInCompany(companyId, positionId) {
  const row = await db('position')
    .select('id')
    .where({ id: positionId, company_id: companyId })
    .first()
  return Boolean(row)
}

async function assertScheduleInCompany(companyId, scheduleId) {
  const row = await db('work_schedule')
    .select('id')
    .where({ id: scheduleId, company_id: companyId })
    .first()
  return Boolean(row)
}

function mapRow(r) {
  if (!r) return null
  return {
    id: r.id,
    company_id: r.company_id,
    full_name: r.full_name,
    email: r.email != null && String(r.email).trim() !== '' ? String(r.email).trim() : null,
    rut_body: r.rut_body,
    rut_dv: r.rut_dv,
    rut: formatRutDisplay(r.rut_body, r.rut_dv),
    nationality: r.nationality,
    sex: r.sex,
    marital_status: r.marital_status,
    address: r.address != null && String(r.address).trim() !== '' ? String(r.address).trim() : null,
    commune: r.commune != null && String(r.commune).trim() !== '' ? String(r.commune).trim() : null,
    city: r.city != null && String(r.city).trim() !== '' ? String(r.city).trim() : null,
    prevision_salud:
      r.prevision_salud != null && String(r.prevision_salud).trim() !== '' ? String(r.prevision_salud).trim() : null,
    fondo_pension:
      r.fondo_pension != null && String(r.fondo_pension).trim() !== '' ? String(r.fondo_pension).trim() : null,
    date_of_birth: r.date_of_birth,
    hire_date: r.hire_date,
    position_id: r.position_id,
    work_schedule_id: r.work_schedule_id,
    position_name: r.position_name ?? null,
    position_description: r.position_description != null && String(r.position_description).trim() !== ''
      ? String(r.position_description).trim()
      : null,
    work_schedule_name: r.work_schedule_name ?? null,
    base_salary: r.base_salary != null ? String(r.base_salary) : '0',
    gratification: r.gratification != null ? String(r.gratification) : '0',
    transport_allowance: r.transport_allowance != null ? String(r.transport_allowance) : '0',
    meal_allowance: r.meal_allowance != null ? String(r.meal_allowance) : '0',
    bonuses: r.bonuses != null ? String(r.bonuses) : '0',
    commissions: r.commissions != null ? String(r.commissions) : '0',
    is_active: r.is_active !== false,
    created_at: r.created_at,
    updated_at: r.updated_at
  }
}

async function listEmployees({ userId, companyId: requestedCompanyId, q = '' }) {
  const gate = await resolveEmployeeCompanyScope(userId, requestedCompanyId)
  if (!gate.ok) return gate
  const companyId = gate.companyId

  const qb = db('employee as e')
    .leftJoin('position as p', 'p.id', 'e.position_id')
    .leftJoin('work_schedule as w', 'w.id', 'e.work_schedule_id')
    .where('e.company_id', companyId)
    .select(
      'e.id',
      'e.full_name',
      'e.email',
      'e.rut_body',
      'e.rut_dv',
      'e.is_active',
      'p.name as position_name',
      'w.name as work_schedule_name'
    )

  const term = String(q || '').trim()
  if (term.length > 0) {
    const t = `%${term}%`
    const digits = term.replace(/\D/g, '')
    qb.andWhere((w) => {
      w.whereILike('e.full_name', t)
        .orWhereILike('e.email', t)
        .orWhereILike('e.address', t)
        .orWhereILike('e.commune', t)
        .orWhereILike('e.city', t)
        .orWhereILike('e.prevision_salud', t)
        .orWhereILike('e.fondo_pension', t)
        .orWhereILike('p.name', t)
        .orWhereILike('p.description', t)
        .orWhereILike('w.name', t)
        .orWhereILike('e.rut_body', t)
      if (digits.length) {
        w.orWhereILike('e.rut_body', `%${digits}%`)
      }
    })
  }

  const rows = await qb.orderBy('e.full_name', 'asc')
  const items = rows.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email != null && String(r.email).trim() !== '' ? String(r.email).trim() : null,
    rut: formatRutDisplay(r.rut_body, r.rut_dv),
    position_name: r.position_name,
    work_schedule_name: r.work_schedule_name,
    is_active: r.is_active !== false
  }))

  return { ok: true, data: { items } }
}

async function getEmployeeById({ userId, companyId: requestedCompanyId, employeeId }) {
  const gate = await resolveEmployeeCompanyScope(userId, requestedCompanyId)
  if (!gate.ok) return gate
  const companyId = gate.companyId

  const row = await db('employee as e')
    .leftJoin('position as p', 'p.id', 'e.position_id')
    .leftJoin('work_schedule as w', 'w.id', 'e.work_schedule_id')
    .where('e.id', employeeId)
    .where('e.company_id', companyId)
    .select(
      'e.*',
      'p.name as position_name',
      'w.name as work_schedule_name'
    )
    .first()

  if (!row) return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Trabajador no encontrado.' }

  return { ok: true, data: { employee: mapRow(row) } }
}

async function createEmployee({ userId, companyId: requestedCompanyId, payload }) {
  const gate = await resolveEmployeeCompanyScope(userId, requestedCompanyId)
  if (!gate.ok) return gate
  const companyId = gate.companyId

  const v = validatePayload(payload, { partial: false })
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors[0] || 'Datos inválidos.' }
  }
  const d = v.data

  const inPos = await assertPositionInCompany(companyId, d.position_id)
  if (!inPos) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'El cargo no pertenece a la empresa.' }
  }
  const inWs = await assertScheduleInCompany(companyId, d.work_schedule_id)
  if (!inWs) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'La jornada no pertenece a la empresa.' }
  }

  const dup = await db('employee')
    .select('id')
    .where({ company_id: companyId, rut_body: d.rut_body })
    .first()
  if (dup) {
    return { ok: false, status: 400, code: 'DUPLICATE_RUT', message: 'Ya existe un trabajador con el mismo RUT en esta empresa.' }
  }

  const [ins] = await db('employee')
    .insert({
      company_id: companyId,
      full_name: d.full_name,
      email: d.email,
      rut_body: d.rut_body,
      rut_dv: d.rut_dv,
      nationality: d.nationality,
      sex: d.sex,
      marital_status: d.marital_status,
      address: d.address,
      commune: d.commune,
      city: d.city,
      prevision_salud: d.prevision_salud,
      fondo_pension: d.fondo_pension,
      date_of_birth: d.date_of_birth,
      hire_date: d.hire_date,
      position_id: d.position_id,
      work_schedule_id: d.work_schedule_id,
      base_salary: d.base_salary,
      gratification: d.gratification,
      transport_allowance: d.transport_allowance,
      meal_allowance: d.meal_allowance,
      bonuses: d.bonuses,
      commissions: d.commissions,
      is_active: d.is_active
    })
    .returning('id')

  const newId = ins && typeof ins === 'object' ? ins.id : ins
  return getEmployeeById({ userId, companyId: requestedCompanyId, employeeId: newId })
}

async function updateEmployee({ userId, companyId: requestedCompanyId, employeeId, payload }) {
  const gate = await resolveEmployeeCompanyScope(userId, requestedCompanyId)
  if (!gate.ok) return gate
  const companyId = gate.companyId

  const existing = await db('employee')
    .select('id', 'rut_body')
    .where({ id: employeeId, company_id: companyId })
    .first()
  if (!existing) {
    return { ok: false, status: 404, code: 'NOT_FOUND', message: 'Trabajador no encontrado.' }
  }

  const v = validatePayload(payload, { partial: true })
  if (!v.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: v.errors[0] || 'Datos inválidos.' }
  }
  const d = v.data
  if (Object.keys(d).length === 0) {
    return getEmployeeById({ userId, companyId: requestedCompanyId, employeeId })
  }
  if (d.rut_body && d.rut_body !== existing.rut_body) {
    const dup = await db('employee')
      .select('id')
      .where({ company_id: companyId, rut_body: d.rut_body })
      .whereNot('id', employeeId)
      .first()
    if (dup) {
      return { ok: false, status: 400, code: 'DUPLICATE_RUT', message: 'Ya existe un trabajador con el mismo RUT en esta empresa.' }
    }
  }

  if (d.position_id) {
    const inPos = await assertPositionInCompany(companyId, d.position_id)
    if (!inPos) {
      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'El cargo no pertenece a la empresa.' }
    }
  }
  if (d.work_schedule_id) {
    const inWs = await assertScheduleInCompany(companyId, d.work_schedule_id)
    if (!inWs) {
      return { ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'La jornada no pertenece a la empresa.' }
    }
  }

  await db('employee')
    .where({ id: employeeId, company_id: companyId })
    .update({ ...d, updated_at: db.fn.now() })

  return getEmployeeById({ userId, companyId: requestedCompanyId, employeeId })
}

async function listLookups({ userId, companyId: requestedCompanyId }) {
  const gate = await resolveEmployeeCompanyScope(userId, requestedCompanyId)
  if (!gate.ok) return gate
  const companyId = gate.companyId

  const [positions, workSchedules] = await Promise.all([
    db('position')
      .select('id', 'name', 'description', 'company_id')
      .where('company_id', companyId)
      .orderBy('name', 'asc'),
    db('work_schedule')
      .select('id', 'name', 'company_id')
      .where('company_id', companyId)
      .orderBy('name', 'asc')
  ])

  return { ok: true, data: { positions, work_schedules: workSchedules } }
}

module.exports = {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  listLookups,
  _formatRutDisplay: formatRutDisplay
}
