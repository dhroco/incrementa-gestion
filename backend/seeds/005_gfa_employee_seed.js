const { randomUUID } = require('node:crypto')
const { _gfaCompanyIds } = require('./003_gfa_company_seed')
const { _gfaPositionIds, _gfaWorkScheduleIds } = require('./004_gfa_position_and_schedule_seed')

exports._gfaEmployeeIds = {
  e1: randomUUID(),
  e2: randomUUID(),
}

exports.seed = async function seed(knex) {
  const { c1, c2 } = _gfaCompanyIds
  const { p1, p2 } = _gfaPositionIds
  const { w1, w2 } = _gfaWorkScheduleIds
  const { e1, e2 } = exports._gfaEmployeeIds

  await knex('employee')
    .insert([
      {
        id: e1,
        company_id: c1,
        position_id: p1,
        work_schedule_id: w1,
        full_name: 'Juan Pérez Muñoz',
        email: 'juan.perez@empresa.ejemplo.cl',
        rut_body: '12345678',
        rut_dv: '5',
        nationality: 'Chilena',
        sex: 'M',
        marital_status: 'Soltero',
        address: 'Av. Libertador 1234, Depto. 12',
        commune: 'Providencia',
        city: 'Santiago',
        date_of_birth: '1990-03-15',
        hire_date: '2018-01-10',
        base_salary: 1500000,
        gratification: 0,
        transport_allowance: 50000,
        meal_allowance: 40000,
        bonuses: 0,
        commissions: 0,
        prevision_salud: 'Fonasa',
        fondo_pension: 'AFP Modelo',
        is_active: true
      },
      {
        id: e2,
        company_id: c2,
        position_id: p2,
        work_schedule_id: w2,
        full_name: 'María González Rivas',
        email: 'maria.gonzalez@empresa.ejemplo.cl',
        rut_body: '98765432',
        rut_dv: '5',
        nationality: 'Chilena',
        sex: 'F',
        marital_status: 'Casada',
        address: 'Calle Falsa 123',
        commune: 'La Serena',
        city: 'Coquimbo',
        date_of_birth: '1985-11-20',
        hire_date: '2020-07-01',
        base_salary: 950000,
        gratification: 100000,
        transport_allowance: 30000,
        meal_allowance: 30000,
        bonuses: 50000,
        commissions: 0,
        prevision_salud: 'Nueva Masvida',
        fondo_pension: 'AFP Uno',
        is_active: true
      }
    ])
    .onConflict('id')
    .merge([
      'company_id',
      'position_id',
      'work_schedule_id',
      'full_name',
      'email',
      'rut_body',
      'rut_dv',
      'nationality',
      'sex',
      'marital_status',
      'address',
      'commune',
      'city',
      'date_of_birth',
      'hire_date',
      'base_salary',
      'gratification',
      'transport_allowance',
      'meal_allowance',
      'bonuses',
      'commissions',
      'prevision_salud',
      'fondo_pension',
      'is_active'
    ])
}

