-- Bóveda cifrada: una fila por usuario con todos sus datos cifrados en el navegador (AES-GCM).
-- El servidor solo guarda el resultado cifrado y los parámetros públicos para derivar la clave;
-- sin la contraseña de la persona no se puede leer nada.
-- Las tablas movimientos y patrimonio se mantienen para migrar los datos antiguos: la app los
-- cifra, los sube aquí y borra las filas en claro la primera vez que la persona elige contraseña.

create table public.bovedas (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  version smallint not null check (version = 1),
  sal text not null,
  iteraciones integer not null check (iteraciones >= 100000),
  iv text not null,
  cifrado text not null,
  updated_at timestamptz not null default now()
);

alter table public.bovedas enable row level security;

create policy "Cada usuario gestiona su bóveda" on public.bovedas
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
