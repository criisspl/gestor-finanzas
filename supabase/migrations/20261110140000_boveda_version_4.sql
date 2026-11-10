-- La versión 4 del sobre cifrado añade ajustes (cuentas y día de inicio de la nómina) y los datos de cada mes. Se siguen aceptando las versiones 1, 2 y 3.
alter table public.bovedas drop constraint bovedas_version_check;
alter table public.bovedas add constraint bovedas_version_check check (version in (1, 2, 3, 4));
