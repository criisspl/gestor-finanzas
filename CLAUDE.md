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

<!-- claude-config:inicio · no edites este bloque: lo gestiona claude-config -->

## Reglas de los paquetes (claude-config v1.0.1)

### react

- React 19: `ref` es una prop normal en componentes de función; no uses `forwardRef` en código nuevo. Usa `<Context value={...}>` en vez de `<Context.Provider>`.
- Formularios: `<form action={fn}>` con `useActionState` (`[state, formAction, isPending]`; la acción recibe `(prevState, formData)`). Errores esperados se devuelven como estado, no se lanzan. `useFormStatus` se importa de `react-dom`.
- No uses `useEffect` para derivar estado ni para reaccionar a clics: calcula en el render o usa el event handler. Effects solo para sincronizar con sistemas externos (red, DOM no-React, suscripciones), siempre con cleanup.
- No añadas `useMemo`/`useCallback`/`React.memo` por defecto; solo si el proyecto no usa React Compiler y hay un problema de rendimiento medido, o necesitas una referencia estable concreta.
- `key` estable y única por dato (id); nunca el índice en listas que se reordenan o editan. Para resetear el estado de un subárbol, cambia su `key`.

### supabase

- Toda tabla de un esquema expuesto (`public`) lleva RLS activado (`alter table ... enable row level security`) y políticas por operación con `to authenticated`; en ellas usa `(select auth.uid())`, nunca `auth.uid()` a pelo. Las vistas llevan `security_invoker = true`.
- La clave publishable (`sb_publishable_...`, antes `anon`) es pública. La secret (`sb_secret_...`, antes `service_role`) se salta RLS y nunca va al cliente, al bundle ni al repo.
- Cambios de esquema: `supabase migration new <nombre>` y SQL nuevo; nunca edites una migración ya aplicada.
- Tipos con `supabase gen types typescript` (no a mano) y `createClient<Database>(...)`; regenéralos tras cada migración.
- Comprueba `error` en cada llamada: `const { data, error } = await ...`; no uses `data` sin mirarlo.
- Tras tocar esquema o políticas, pasa `supabase db lint` y los advisors de seguridad si el proyecto los tiene.

### typescript

- Prohibido `any` (y `as any`, `@ts-ignore`): usa `unknown` y acota con comprobaciones, o un tipo del dominio. Si de verdad hace falta suprimir, `@ts-expect-error` con motivo.
- Con `verbatimModuleSyntax`, lo que solo es tipo se importa con `import type { X }` o `import { type X }`; si no, el typecheck falla.
- Con `allowImportingTsExtensions`, los imports relativos llevan la extensión `.ts` explícita (`./foo.ts`, no `./foo`).
- Para objetos de configuración o tablas usa `satisfies Tipo` en vez de anotar, para no perder los literales. Evita `as` para "arreglar" errores de tipos.
- No des un cambio por bueno sin pasar el typecheck del repo (`tsc --noEmit` o su script).

### vite

- Solo las variables `VITE_*` llegan al cliente y quedan incrustadas en el bundle: son públicas. Nunca pongas claves, tokens ni secretos en ellas; van en un backend/función serverless.
- Se leen con `import.meta.env.VITE_X` (no `process.env`) y son siempre strings; convierte booleanos y números a mano. Tipa las nuevas en `src/vite-env.d.ts` extendiendo `ImportMetaEnv`, sin `import` en ese fichero.
- La config vive en `vite.config.ts` con `defineConfig`. En Vite 8 `build.rollupOptions` pasó a `build.rolldownOptions` y `esbuild` a `oxc`; mira la versión instalada antes de tocarlas.
- `vite preview` solo sirve el build local para comprobarlo (ejecuta antes `vite build`); no es un servidor de producción.
- Los ficheros `.env*.local` van en `.gitignore`; tras cambiar un `.env` hay que reiniciar el dev server.

### vitest

- Es Vitest, no Jest: `vi.fn`, `vi.spyOn`, `vi.mock`, nunca `jest.*`. Importa `describe/it/expect/vi` de `vitest` salvo que `globals` esté activo.
- `vi.mock` se hoistea encima de los imports: si la factory necesita variables externas, créalas con `vi.hoisted`.
- Restaura lo que toques: `vi.useRealTimers()` tras `vi.useFakeTimers()`, `vi.unstubAllGlobals()`/`vi.unstubAllEnvs()` tras stubs, y `vi.restoreAllMocks()` de los spies.
- Prefiere aserciones precisas (`toEqual`, `toMatchObject`, `toThrow(...)`) a `toBeTruthy`; si el repo usa `node:assert/strict`, sigue ese estilo.

<!-- claude-config:fin -->
