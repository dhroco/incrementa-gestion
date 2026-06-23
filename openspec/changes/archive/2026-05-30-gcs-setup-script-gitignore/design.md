## Context

Incrementa-gestion despliega en GCP (`dev`/`prod`) con IaC parcial en `infra/cloudformation/` y Keycloak en `infra/keycloak/`. No existe aún carpeta `infra/gcp/` ni automatización para GCS. El backend eventualmente consumirá un bucket de contratos mediante credenciales de service account; hoy no hay script ni convención de ruta para la clave JSON local.

El `.gitignore` ya excluye `backend/SET_VARS_AMBIENTE_LOCAL.cmd` pero no el directorio donde vivirán las credenciales GCS.

## Goals / Non-Goals

**Goals:**

- Script PowerShell idempotente-en-intención para un desarrollador con `gcloud` autenticado: proyecto, bucket, SA, binding IAM, clave JSON en ruta fija relativa al repo.
- Tres variables de entorno GCP al tope del script para cambiar proyecto/bucket/región sin tocar el resto.
- Ignorar `backend/secrets/` en git con comentario claro junto a otras exclusiones de secretos locales.

**Non-Goals:**

- Integrar GCS en el código Node del backend (cliente `@google-cloud/storage`, variables en `config.js`).
- Terraform/Pulumi o pipelines CI para GCS.
- Scripts bash equivalentes o soporte multi-OS fuera de PowerShell.
- Manejo automático de re-ejecución si bucket/SA ya existen (el script asume primera ejecución; errores de `gcloud` se muestran al operador).

## Decisions

### Ubicación: `infra/gcp/setup-gcs.ps1`

**Decisión:** Colocar el script bajo `infra/gcp/`, alineado con `infra/keycloak/` y `infra/scripts/`.

**Alternativa:** Raíz del repo o `backend/scripts/` — descartada porque el aprovisionamiento es infra GCP, no lógica de aplicación.

### Rutas relativas desde `infra/gcp/`

**Decisión:** `$KEY_PATH = "..\..\backend\secrets\gcs-service-account.json"` y `New-Item` sobre `..\..\backend\secrets`.

**Rationale:** El operador ejecuta el script desde `infra/gcp/`; la clave queda donde el backend la esperará sin rutas absolutas en el script.

### Valores por defecto (dev)

| Variable | Valor |
|----------|--------|
| `$PROJECT` | `incrementa-gestion-dev` |
| `$BUCKET` | `incrementa-contratos-dev` |
| `$REGION` | `us-central1` |
| `$SA_NAME` | `incrementa-gcs-sa` |

**Alternativa:** Parametrizar vía argumentos `-Project` — no solicitado; variables al inicio del archivo son suficientes.

### IAM: `roles/storage.objectAdmin` a nivel bucket

**Decisión:** Binding con `gcloud storage buckets add-iam-policy-binding` y uniform bucket-level access al crear el bucket.

**Rationale:** Principio de mínimo privilegio respecto a `storage.admin` del proyecto; la SA solo opera sobre el bucket de contratos.

### Flujo del script (sin duplicación)

**Decisión:** Una sola secuencia: set project → create bucket → create SA → IAM binding → mkdir secrets → create key.

**Nota:** El borrador del usuario repetía bloques de configuración/creación de bucket; la implementación debe entregar un único flujo lineal equivalente al intent funcional.

### `.gitignore`

**Decisión:** Insertar después de `backend/SET_VARS_AMBIENTE_LOCAL.cmd`:

```
# GCP credentials (never commit)
backend/secrets/
```

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Re-ejecutar falla si bucket o SA ya existen | Documentar en README futuro o mensajes de `gcloud`; fuera de alcance de este cambio |
| Clave JSON en disco local comprometida | `.gitignore` + no subir a repo; rotar clave en GCP |
| Límite de claves por SA en GCP | Usar una clave por entorno de desarrollador; revocar las no usadas |
| Script solo PowerShell | Aceptado: entorno Windows del equipo y comando del usuario |

## Migration Plan

1. Merge del script y `.gitignore`.
2. Desarrollador con permisos en `incrementa-gestion-dev` ejecuta desde `infra/gcp/`: `.\setup-gcs.ps1`.
3. Configurar backend local para leer `backend/secrets/gcs-service-account.json` (cambio futuro, no en este propose).
4. Rollback: eliminar bucket/SA/clave en consola GCP manualmente si el aprovisionamiento fue erróneo.

## Open Questions

- ¿Documentar pasos en `infra/README.md` en un cambio posterior?
- ¿Nombre del bucket y proyecto para `prod` cuando se aprovisione producción?
