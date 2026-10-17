-- Gestor de finanzas: esquema inicial.
-- Cada fila pertenece a un usuario y Row Level Security garantiza que nadie ve los datos de otro.

create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'fijo', 'gasto')),
  nombre text,
  importe numeric(12, 2) not null check (importe > 0),
  categoria text check (categoria in ('alquiler', 'esencial', 'ocio', 'inversion', 'otros')),
  fecha date,
  created_at timestamptz not null default now(),
  -- Los ingresos no tienen categoría; los fijos y variables sí. Solo los variables llevan fecha.
  constraint categoria_segun_tipo check ((tipo = 'ingreso') = (categoria is null)),
  constraint fecha_segun_tipo check ((tipo = 'gasto') = (fecha is not null))
);

create index movimientos_user_fecha on public.movimientos (user_id, fecha);

create table public.patrimonio (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  fondo_emergencia numeric(14, 2) not null default 0 check (fondo_emergencia >= 0),
  total_invertido numeric(14, 2) not null default 0 check (total_invertido >= 0),
  updated_at timestamptz not null default now()
);

alter table public.movimientos enable row level security;
alter table public.patrimonio enable row level security;

create policy "Cada usuario gestiona sus movimientos" on public.movimientos
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Cada usuario gestiona su patrimonio" on public.patrimonio
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
