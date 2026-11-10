-- La versión 3 del sobre cifrado añade partidas y recibos. Se siguen aceptando las versiones 1 y 2.
alter table public.bovedas drop constraint bovedas_version_check;
alter table public.bovedas add constraint bovedas_version_check check (version in (1, 2, 3));
