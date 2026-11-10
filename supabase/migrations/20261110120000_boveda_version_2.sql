-- La versión 2 del sobre cifrado añade las notas. Se siguen aceptando los sobres de la versión 1.
alter table public.bovedas drop constraint bovedas_version_check;
alter table public.bovedas add constraint bovedas_version_check check (version in (1, 2));
