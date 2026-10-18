using 'main.bicep'

// Pre-prod · suscripción incrementa-preprod (8460e93a-bbda-4707-8b6c-a5fb5d1c2d80)
// Resource group: rg-incrementa-preprod · región: brazilsouth
param entorno = 'preprod'
param environmentApp = 'dev'

// Login de pre-prod: tenant de David y app registration incrementa-gestion-dev.
param tenantLogin = '60322b4a-13bf-4f19-89ae-efe4a54ffed6'
param clientIdLogin = 'dc734f4a-5f25-4e88-b728-aab4715f2122'

// David: recibe permisos para cargar secretos en Key Vault y copiar archivos a Storage.
// (az ad signed-in-user show --query id -o tsv)
param objectIdAdministrador = '19ccb17e-f1cc-4244-8e56-dace256001df'

// La IP de David no va aquí: cambia. La abre scripts/firewall-mi-ip.sh.

// La clave de PostgreSQL no va aquí: se pasa al aplicar, desde una variable de entorno.
param postgresAdminClave = readEnvironmentVariable('INCREMENTA_PG_CLAVE')

param postgresSku = 'Standard_B1ms'
param postgresTier = 'Burstable'

// Secretos cargados en Key Vault e imagen propia en el ACR (desde 2026-10-18): true.
// imagenBackend se pasa al aplicar con la imagen que esté corriendo (infra.yml lo hace solo);
// si se aplica a mano, pasar: --parameters imagenBackend=<imagen actual>.
param secretosCargados = true
param imagenBackend = ''
