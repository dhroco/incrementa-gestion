-- Opcional: ejecutar en Supabase SQL Editor si no usas Knex migrate en ese entorno.
-- Orden: 1) reconciliar 2) eliminar columna
-- Requisito previo: columna user_profile.is_active (migración 202604180001 o equivalente).

-- 1) Alinear user_profile desde accountant (última vez antes del DROP)
update user_profile up
set is_active = a.is_active
from accountant a
where a.id = up.id
  and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accountant' and column_name = 'is_active'
  );

-- 2) Quitar columna redundante
alter table public.accountant drop column if exists is_active;
