# Decisiones del cambio revision-redaccion

Registro automático de la mesa de consultas.

## C-0P8JHYZ · El veredicto rojo pide cambiar draft_document.review_id de ON DELETE RESTRICT a ON DELETE NO ACTION, porque RESTRICT se evalúa de inmediato y choca con el CASCADE de company_id y supplier_id en contract_review. Eso cambia la decisión 5 del diseño y el veredicto dice que un humano debe aprobarlo antes de que se corra la migración. ¿Lo cambio a NO ACTION, o lo dejo en RESTRICT?

- **Preguntó:** Cursor
- **Decidió:** Humano
- **Respuesta:** Apruebo NO ACTION
- **Motivo del Arquitecto:** Cambiar el ON DELETE de una FK es un cambio al modelo de datos. Según el punto 3 de mis atribuciones (contratos y modelo de datos), eso lo decide solo David. Además, cambia la decisión 5 escrita en `openspec/changes/revision-redaccion/design.md` (líneas 117 y 119), y el propio veredicto (`veredicto-revision-final.json`) pide que un humano lo apruebe. No hay precedente en main ni una decisión previa en esta corrida que lo cubra. El análisis técnico del veredicto está bien: en Postgres, RESTRICT se revisa de inmediato y NO ACTION al final de la sentencia. Por eso, borrar un proveedor o una empresa, que se propaga en cascada a `contract_review` y a `draft_document`, puede fallar con RESTRICT y funcionar con NO ACTION. Hoy el problema está latente porque ningún servicio borra proveedores ni empresas.
- **Fecha:** 2026-09-29T18:38:29.481Z
