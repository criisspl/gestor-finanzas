---
name: supabase
description: Use when writing or reviewing database, auth or client code in a project that uses Supabase (supabase-js v2).
---

# Supabase (supabase-js v2)

## Claves
- `sb_publishable_...` (antes `anon`, JWT): pública, va en el cliente.
- `sb_secret_...` (antes `service_role`, JWT): se salta RLS. Solo servidor (Edge Function, Worker, backend). Nunca en el bundle, `VITE_*`/`NEXT_PUBLIC_*`, ni en el repo.
- Si el proyecto aún usa `anon`/`service_role`, mismas reglas; no migres las claves sin que lo pidan.
- Un cliente con la secret key ignora RLS: si una petición lleva el token de un usuario, RLS sí se aplica.

## RLS
- Actívalo en toda tabla de un esquema expuesto. Sin RLS, cualquier rol con grant lee y escribe.
- Las políticas no quitan grants: revoca a `anon`/`authenticated` lo que no haga falta.
- Una política por operación, siempre con `to authenticated` (o el rol que toque). Un `update` necesita también política de `select`.
- `auth.uid()` es `null` sin sesión: comprueba también `is not null`.
- Indexa las columnas que filtran las políticas.
- Vistas: `with (security_invoker = true)` (Postgres 15+), o se saltan RLS.

```sql
alter table public.prendas enable row level security;

create policy "prendas_select_propias" on public.prendas
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "prendas_insert_propias" on public.prendas
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
```

## Migraciones y tipos
- `supabase migration new <nombre>` crea `supabase/migrations/<timestamp>_<nombre>.sql`. Cada cambio, un fichero nuevo.
- Nunca edites una migración aplicada: crea otra que corrija.
- Local: `supabase db reset` reconstruye desde las migraciones y `seed.sql`. Remoto: `supabase db push`.
- Tipos: `supabase gen types typescript --local > database.types.ts` (o `--project-id <ref>`). No los escribas a mano.

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
const supabase = createClient<Database>(url, publishableKey)
```

## Auth con enlace mágico
```ts
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: 'https://miapp.com/', shouldCreateUser: false },
})
```
- `signInWithOtp` manda enlace mágico por defecto. Caduca en 1 h y se pide como mucho 1 vez por minuto.
- `emailRedirectTo` debe estar en la lista de redirect URLs del proyecto (Site URL + adicionales).
- Con PKCE, la plantilla del email apunta a un endpoint que llama a `verifyOtp` con `token_hash` y `type: 'email'`.

## Errores típicos de LLM
- Usar `data` sin mirar `error`: supabase-js no lanza, devuelve `{ data, error }`.
- Crear tabla sin RLS "para probar" y dejarla así.
- Usar la secret key en el cliente porque "así funciona".
- Escribir políticas con `auth.uid()` sin `select` (más lento: se evalúa por fila).
- Editar una migración vieja en vez de crear una nueva.
- Inventar tipos a mano en vez de regenerarlos.

## Verificar
- `supabase db lint --local` (usa `--fail-on error` en CI).
- Advisors de seguridad del panel, si el proyecto está enlazado.
- Tests pgTAP con `supabase test db`: caso permitido y denegado por operación y rol.
- Comprueba con un usuario normal que no ve filas de otro.

## Fuentes
- https://supabase.com/docs/guides/api/api-keys
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/local-development/overview
- https://supabase.com/docs/guides/api/rest/generating-types
- https://supabase.com/docs/reference/cli/supabase-db-lint
- https://supabase.com/docs/guides/auth/auth-email-passwordless
