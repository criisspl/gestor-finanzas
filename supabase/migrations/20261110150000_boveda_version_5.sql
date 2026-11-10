-- La versión 5 del sobre cifrado añade deudas, pagos de deudas y cobros pendientes. Se siguen aceptando las versiones 1, 2, 3 y 4.
alter table public.bovedas drop constraint bovedas_version_check;
alter table public.bovedas add constraint bovedas_version_check check (version in (1, 2, 3, 4, 5));
