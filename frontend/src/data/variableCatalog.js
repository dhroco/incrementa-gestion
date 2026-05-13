// Catálogo fijo de variables embebibles para cláusulas
// Agrupadas por origen de datos: Trabajador, Empresa, Contrato

export const VARIABLE_GROUPS = {
  trabajador: {
    id: 'trabajador',
    label: 'Trabajador',
    description: 'Datos personales del trabajador',
    variables: [
      {
        id: 'worker_name',
        label: 'Nombre Trabajador',
        description: 'Nombre completo del trabajador'
      },
      {
        id: 'worker_lastname',
        label: 'Apellido Trabajador',
        description: 'Apellido del trabajador'
      },
      {
        id: 'worker_rut',
        label: 'RUT Trabajador',
        description: 'RUT del trabajador'
      },
      {
        id: 'worker_position',
        label: 'Cargo',
        description: 'Cargo o puesto del trabajador'
      }
    ]
  },
  empresa: {
    id: 'empresa',
    label: 'Empresa',
    description: 'Datos de la empresa contratante',
    variables: [
      {
        id: 'company_legal_name',
        label: 'Razón Social',
        description: 'Nombre legal de la empresa'
      },
      {
        id: 'company_rut',
        label: 'RUT Empresa',
        description: 'RUT de la empresa'
      },
      {
        id: 'company_email',
        label: 'Correo empresa',
        description: 'Correo electrónico de la casa matriz'
      },
      {
        id: 'company_address',
        label: 'Dirección',
        description: 'Dirección de la casa matriz'
      },
      {
        id: 'company_commune',
        label: 'Comuna',
        description: 'Comuna de la casa matriz'
      },
      {
        id: 'company_city',
        label: 'Ciudad',
        description: 'Ciudad de la casa matriz'
      },
      {
        id: 'company_region',
        label: 'Región',
        description: 'Región de la casa matriz'
      },
      {
        id: 'company_legal_rep1_name',
        label: 'Nombre Representante Legal 1',
        description: 'Nombre del representante legal principal'
      },
      {
        id: 'company_legal_rep1_rut',
        label: 'RUT Representante Legal 1',
        description: 'RUT del representante legal principal'
      },
      {
        id: 'company_legal_rep2_name',
        label: 'Nombre Representante Legal 2',
        description: 'Nombre del segundo representante legal'
      },
      {
        id: 'company_legal_rep2_rut',
        label: 'RUT Representante Legal 2',
        description: 'RUT del segundo representante legal'
      },
      {
        id: 'company_branches',
        label: 'Sucursal empresa',
        description: 'Resumen de sucursales u oficinas (nombre, domicilio y contacto)'
      }
    ]
  },
  contrato: {
    id: 'contrato',
    label: 'Contrato',
    description: 'Datos de la relación laboral',
    variables: [
      {
        id: 'contract_type',
        label: 'Tipo de Contrato',
        description: 'Tipo de contrato laboral'
      },
      {
        id: 'work_schedule',
        label: 'Jornada',
        description: 'Jornada laboral (completa, parcial, etc.)'
      }
    ]
  }
};

// Catálogo plano para fácil acceso y búsqueda
export const VARIABLE_CATALOG = Object.values(VARIABLE_GROUPS).flatMap(group =>
  group.variables.map(variable => ({
    ...variable,
    group: group.id,
    groupLabel: group.label
  }))
);

// Obtener variable por ID
export const getVariableById = (id) => {
  return VARIABLE_CATALOG.find(variable => variable.id === id);
};

// Obtener variables por grupo
export const getVariablesByGroup = (groupId) => {
  const group = VARIABLE_GROUPS[groupId];
  return group ? group.variables.map(variable => ({
    ...variable,
    group: group.id,
    groupLabel: group.label
  })) : [];
};

// Buscar variables por texto
export const searchVariables = (searchText) => {
  const text = searchText.toLowerCase();
  return VARIABLE_CATALOG.filter(variable =>
    variable.label.toLowerCase().includes(text) ||
    variable.description.toLowerCase().includes(text)
  );
};
