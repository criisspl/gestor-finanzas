-- La versión 6 del sobre cifrado autentica la versión y el usuario como datos adicionales (AAD) de AES-GCM. Se siguen aceptando las versiones 1 a 5.
alter table public.bovedas drop constraint bovedas_version_check;
alter table public.bovedas add constraint bovedas_version_check check (version in (1, 2, 3, 4, 5, 6));
