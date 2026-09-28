# Hallazgos de cierre del cambio moneda-plantilla-usd

Devoluciones desde «confirmar cierre». El último es el que corrige la fase devolver.

## 2026-09-28T17:37:57.418Z · dvd

Faltan pruebas de la migración 202609280001, en un archivo de pruebas nuevo: (1) si el párrafo de precio de una plantilla mexicana no calza, up() no marca currency_code='USD' en esa plantilla (se marca solo después de reescribir con éxito); (2) down() quita la columna currency_code y su restricción (verificar las operaciones de esquema, no solo updates y deletes). Además, anota en el Migration Plan de design.md: primero se despliega el backend nuevo y después se corre la migración.
