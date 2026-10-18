---
name: react
description: Use when writing or reviewing React components, hooks, forms or effects in a project that uses React 19.
---

# React 19

## Errores típicos de LLM (APIs antiguas)

- `forwardRef`: en React 19 `ref` es una prop más. Usa `function Input({ ref, ...props })`.
- `<Ctx.Provider value>`: ahora `<Ctx value>`.
- `useFormState` (renombrado): es `useActionState` de `react`. `useFormStatus` sigue en `react-dom`.
- `useEffect` + `fetch` + `useState` para todo, `useMemo`/`useCallback` en todas partes, índice como `key`.
- Ref callbacks con retorno implícito: `ref={el => (x = el)}` rompe en TS; usa `{ x = el }`. Pueden devolver una función de cleanup.
- Librerías `react-helmet` para un simple `<title>`: React 19 hoista `<title>`, `<meta>` y `<link>` desde cualquier componente.

## Formularios y Actions

```tsx
import { useActionState } from 'react';

async function guardar(prev: { error: string | null }, formData: FormData) {
  const nombre = String(formData.get('nombre') ?? '');
  if (!nombre) return { error: 'El nombre es obligatorio' };
  await api.guardar(nombre);
  return { error: null };
}

function Formulario() {
  const [estado, accion, pendiente] = useActionState(guardar, { error: null });
  return (
    <form action={accion}>
      <input name="nombre" />
      <button disabled={pendiente}>Guardar</button>
      {estado.error && <p role="alert">{estado.error}</p>}
    </form>
  );
}
```

- La acción recibe `(prevState, formData)`. Los errores esperados se devuelven; si lanza, salta el Error Boundary.
- Si llamas a `accion` a mano (fuera de `<form action>`), envuélvela en `startTransition`.
- `useFormStatus()` (de `react-dom`) lee `pending` del `<form>` padre desde un hijo, sin prop drilling.
- `useOptimistic(valor)` muestra el resultado esperado mientras la acción está en curso y vuelve al real al terminar:

```tsx
const [optimistas, anadirOptimista] = useOptimistic(items);
// dentro de la acción: anadirOptimista(nuevo); await api.crear(nuevo);
```

## `use`

- `use(promesa)` suspende hasta resolverse; `use(Contexto)` lee contexto y, a diferencia de un hook, puede ir tras un `if`/return temprano.
- No crees la promesa en el render del mismo componente: pásala desde un padre/framework/caché compatible con Suspense. Envuelve en `<Suspense>` y Error Boundary.

## Effects: "You Might Not Need an Effect"

Pregunta: ¿esto corre porque el usuario hizo algo (→ event handler) o porque el componente se mostró (→ effect)?

- Dato derivado: se calcula en el render, no `useEffect(() => setX(...))`.
- Resetear estado al cambiar una prop: `<Perfil key={userId} />`.
- Lógica compartida entre handlers: una función, no un effect.
- Stores externos (`navigator.onLine`): `useSyncExternalStore`.
- Si haces fetch en un effect, ignora respuestas obsoletas:

```tsx
useEffect(() => {
  let ignorar = false;
  buscar(q).then(r => { if (!ignorar) setResultados(r); });
  return () => { ignorar = true; };
}, [q]);
```

## Memoización y React Compiler

- El compilador (`babel-plugin-react-compiler`, vía `@vitejs/plugin-react` en `babel.plugins`) memoiza solo. Con él activo, no escribas `useMemo`/`useCallback`/`React.memo` en código nuevo; el existente puede quedarse.
- Sin compilador, memoiza solo tras medir. Mantén `useMemo` si necesitas una identidad estable concreta (dependencia de un effect, por ejemplo).
- El compilador exige respetar las Rules of React: render puro, sin mutar props/estado.

## Keys y listas

- `key` = id estable del dato. Índice solo en listas estáticas que nunca se reordenan ni filtran.
- Nunca `Math.random()` ni `crypto.randomUUID()` en el render como key.

## Accesibilidad

- Elementos nativos (`<button>`, `<a>`, `<label htmlFor>`) antes que `div` con `onClick`.
- Errores de formulario con `role="alert"` o `aria-live`; asocia mensajes con `aria-describedby`.
- Gestiona el foco al abrir/cerrar diálogos (`<dialog>` nativo cuando se pueda).

## Verificar

```bash
npm run lint        # con eslint-plugin-react-hooks
npx tsc --noEmit
npm test
npm run build
```

Si usas el compilador, revisa en lint los avisos de componentes que no puede optimizar.

## Fuentes

- https://react.dev/blog/2024/12/05/react-19
- https://react.dev/reference/react/useActionState
- https://react.dev/learn/you-might-not-need-an-effect
- https://react.dev/learn/react-compiler
