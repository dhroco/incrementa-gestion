// Catálogo fijo de variables embebibles para templates
// Agrupadas por origen de datos: Proveedor, Empresa, Contrato

export const VARIABLE_GROUPS = {
  proveedor: {
    id: 'proveedor',
    label: 'Proveedor',
    description: 'Datos del proveedor (persona natural o empresa)',
    variables: [
      {
        id: 'proveedor_nombre',
        label: 'Nombre / Razón Social',
        description: 'Nombre completo (persona) o razón social (empresa)'
      },
      {
        id: 'proveedor_rut',
        label: 'RUT Proveedor',
        description: 'RUT del proveedor (persona o empresa)'
      },
      {
        id: 'proveedor_direccion',
        label: 'Dirección',
        description: 'Dirección del proveedor'
      },
      {
        id: 'proveedor_giro',
        label: 'Giro',
        description: 'Giro comercial (solo empresas)'
      },
      {
        id: 'proveedor_rep_legal',
        label: 'Representante Legal',
        description: 'Nombre del representante legal (solo empresas)'
      },
      {
        id: 'proveedor_rep_legal_rut',
        label: 'RUT Representante Legal',
        description: 'RUT del representante legal (solo empresas)'
      },
      {
        id: 'proveedor_red_social',
        label: 'Red Social',
        description: 'Red social del proveedor para el contrato'
      },
      {
        id: 'proveedor_cuenta_social',
        label: 'Cuenta Red Social',
        description: 'Handle o cuenta asociada a la red social del proveedor'
      }
    ]
  },
  client: {
    id: 'client',
    label: 'Cliente',
    description: 'Marca o empresa para la que se ejecuta la campaña',
    variables: [
      {
        id: 'client_name',
        label: 'Nombre cliente',
        description: 'Nombre del cliente'
      },
      {
        id: 'client_brand',
        label: 'Marca',
        description: 'Marca asociada al cliente'
      },
      {
        id: 'client_brand_account',
        label: 'Cuenta marca',
        description: 'Cuenta de red social o handle de la marca'
      },
      {
        id: 'client_product_campaign',
        label: 'Producto/Campaña',
        description: 'Producto o campaña del cliente para este contrato'
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
        id: 'company_nombre_comercial',
        label: 'Nombre Comercial',
        description: 'Nombre abreviado o comercial bajo el cual se identifica la empresa en el contrato'
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
      }
    ]
  },
  contrato: {
    id: 'contrato',
    label: 'Contrato',
    description: 'Datos específicos del contrato comercial',
    variables: [
      {
        id: 'fecha_contrato',
        label: 'Fecha del contrato',
        description: 'Fecha de firma o celebración del contrato'
      },
      {
        id: 'lugar_contrato',
        label: 'Lugar del contrato',
        description: 'Ciudad o lugar donde se firma el contrato'
      },
      {
        id: 'mes_ejecucion',
        label: 'Mes de ejecución',
        description: 'Mes en que se ejecuta la campaña o servicio'
      },
      {
        id: 'cantidad_reels',
        label: 'Cantidad de reels',
        description: 'Número de reels acordados en el contrato'
      },
      {
        id: 'precio_numero',
        label: 'Precio',
        description: 'Monto del contrato en cifras'
      },
      {
        id: 'precio_texto',
        label: 'Precio en texto',
        description: 'Monto del contrato escrito en palabras'
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
