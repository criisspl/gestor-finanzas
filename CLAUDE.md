# CLAUDE.md

Solo lo propio de este repo; las reglas generales y las skills vienen de [claude-config](https://github.com/criisspl/claude-config). Cada línea está aquí porque sin ella Claude se equivocaría; si una deja de hacer falta, bórrala.

## Stack y comandos

- React 19 + TypeScript + Vite. Node 22.
- Supabase: acceso por enlace mágico y Postgres con Row Level Security.
- Cifrado en el navegador con Web Crypto (PBKDF2 + AES-GCM): el servidor solo guarda un sobre cifrado por persona (tabla `bovedas`).
- Sin variables de entorno arranca en modo demo, con datos de ejemplo en `localStorage`.
- Tests: Vitest, junto al código (`*.test.ts` en `src/domain/` y `src/data/`).

| Qué      | Comando                                 |
| -------- | --------------------------------------- |
| Instalar | `npm ci`                                |
| Dev      | `npm run dev`                           |
| Tests    | `npm test` (`npm run test:watch`)       |
| Lint     | `npm run lint`                          |
| Build    | `npm run build` (`tsc -b` + `vite build`) |

CI ejecuta lint, tests y build: todo tiene que pasar antes de dar algo por hecho.

## Estructura

- `src/domain/`: lógica pura sin React ni red (tipos, las 6 reglas, formato). Aquí va lo testeable.
- `src/data/`: patrón repositorio (`repositorio.ts`); implementaciones en memoria, demo y Supabase; cifrado en `cifrado.ts` y `boveda.ts`.
- `src/hooks/useFinanzas.ts`: carga los datos y expone las operaciones. `src/components/`: pantallas y formularios.
- `supabase/migrations/`: esquema SQL y políticas de seguridad.

## Reglas del proyecto

- **Privacidad:** los datos se cifran en el navegador y la clave nunca sale de él. Nada en claro hacia Supabase.
- Las reglas y sus porcentajes viven solo en `src/domain/reglas.ts`, como funciones puras.
- Importes en formato español con `parsearImporte`, redondeados a céntimos.
- El sobre cifrado está versionado (`version` e `iteraciones` dentro del sobre): si cambia su formato, sube la versión y sigue sabiendo abrir los anteriores.
- Cambios de esquema: migración nueva en `supabase/migrations/`, nunca editar una existente. Toda tabla nueva con RLS (`auth.uid() = user_id`).
- En el cliente solo va la clave pública (`VITE_SUPABASE_ANON_KEY`); nunca la `service_role`.
- La interfaz no sabe dónde se guardan los datos: todo pasa por el `Repositorio`.
- Textos de la interfaz y comentarios en español.
- No añadas dependencias sin preguntar.
