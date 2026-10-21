using 'main.bicep'

// Prod · tenant de Incrementa "Dynamics Corp. SPA" (9127c9cd-62bb-4118-8374-87e9b7fc8acc)
// Suscripción "Azure subscription 1" (2fdd7c0a-664d-46ea-863d-73f96627f217)
// Resource group: rg-incrementa-gestion-prod · región: brazilsouth
param entorno = 'prod'
param environmentApp = 'prod'

// Login de prod: app registration incrementa-gestion en el tenant de Incrementa.
param tenantLogin = '9127c9cd-62bb-4118-8374-87e9b7fc8acc'
param clientIdLogin = '9976f99a-975a-4f33-8dd8-746a2411adad'

// David (david.roco@incrementa.cl) en el tenant de Incrementa.
param objectIdAdministrador = '899f3854-d9fb-41ba-8749-66743f7270d8'

// La clave de PostgreSQL de prod no va aquí: se pasa al aplicar, desde una variable de entorno
// distinta de la de pre-prod, para no mezclarlas.
param postgresAdminClave = readEnvironmentVariable('INCREMENTA_PG_CLAVE_PROD')

param postgresSku = 'Standard_B1ms'
param postgresTier = 'Burstable'

// Sin WORM al nacer: se prueba, se borran los datos de prueba y recién entonces se pasa a true.
param wormFirmados = false

// Prod sale sin Resend: no hay correo saliente.
param usarResend = false

// Primera aplicación: false (imagen de ejemplo, sin secretos). Después de cargar DATABASE-URL
// en Key Vault y publicar la imagen, se vuelve a aplicar con true y la imagen que corresponda.
param secretosCargados = false
param imagenBackend = ''
