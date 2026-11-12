# Gestor de finanzas

Aplicación web para llevar tus finanzas personales y ver, cada mes, cómo vas frente a **6 reglas de dinero**: gastos esenciales, ocio, alquiler, inversión, fondo de emergencia y objetivo de independencia financiera.

Cada persona entra con su correo y sus datos se **cifran en su navegador** con una contraseña que solo ella conoce: el servidor guarda un bloque cifrado que nadie más puede leer.

![Captura del gestor de finanzas](docs/captura.png)

## Qué hace

- **Ingresos y gastos fijos** que se repiten cada mes (nómina, alquiler, recibos, suscripciones).
- **Gastos variables y aportaciones a inversión** apuntados día a día, agrupados por mes.
- **Resumen del mes**: ingresos, gastado, invertido y lo que queda para ahorrar, con una barra de reparto por categoría.
- **Reparto de la nómina por partidas** con presupuesto, lo gastado en cada una y los recibos fijos marcados mes a mes.
- **Ciclo de nómina y cuentas**: el mes empieza el día que elijas, el sobrante pasa al siguiente, cada partida va a su cuenta y se apuntan saldos y traspasos.
- **Notas** de colores (verde, ámbar, rojo) para recordatorios y avisos.
- **Deudas** con pagos parciales: lo pagado, lo que queda, lo vencido y, si quieres, el pago se resta de una partida.
- **Pendiente de cobrar**: dinero que te deben por mes; al llegar suma a tu cuenta de nómina y se ve cuánto te sobrará cuando llegue.
- **Las 6 reglas** calculadas sobre tu ingreso, con lo que deberías gastar, lo que llevas y un estado (bien, al límite, te pasas):

| # | Regla | Cálculo |
|---|-------|---------|
| 1 | Objetivo de independencia financiera | Ingreso mensual × 300 (retirada anual del 4 %) |
| 2 | Gastos esenciales | 50 % del ingreso (alquiler + esenciales) |
| 3 | Ocio | 5 % del ingreso |
| 4 | Fondo de emergencia | 3 meses de gastos esenciales |
| 5 | Alquiler | 35 % del ingreso |
| 6 | Inversión mensual | 20 % del ingreso |

Las reglas son una referencia, no un objetivo que haya que cumplir entero: sirven para ver dónde estás y elegir el siguiente paso.

## Stack

- **React 19 + TypeScript** con **Vite**
- **Supabase**: autenticación sin contraseña (enlace mágico) y base de datos Postgres
- **Cifrado de extremo a extremo** con Web Crypto: clave derivada de la contraseña con PBKDF2 (SHA-256, 600 000 iteraciones) y datos cifrados con AES-GCM de 256 bits
- **Row Level Security** en Postgres: cada fila pertenece a un usuario y la propia base de datos impide leer o escribir datos ajenos
- **Vitest** para la lógica de negocio
- **GitHub Actions**: lint, tests y build en cada push

## Arquitectura

```
src/
├── domain/        Lógica pura, sin React ni red: tipos, cálculo de las reglas y formato
├── data/          Repositorio en memoria que se guarda cifrado en un almacén
│   ├── configuracion.ts   Dónde guarda cada persona sus datos (proveedor + parámetros públicos, en localStorage)
│   └── proveedores/   Dónde vive el sobre cifrado: Supabase, este navegador (cifrado) o datos de ejemplo
├── hooks/         useFinanzas: carga los datos y expone las operaciones
└── components/    Pantallas y formularios
supabase/
└── migrations/    Esquema SQL con las políticas de seguridad
```

Algunas decisiones:

- **Las reglas viven en `src/domain/reglas.ts` como funciones puras.** Así se testean sin navegador ni base de datos, y los porcentajes están en un único sitio.
- **Patrón repositorio.** La interfaz no sabe dónde se guardan los datos. Al primer arranque la pantalla de instalación deja elegir dónde guardar los datos (Supabase propio, solo este navegador o datos de ejemplo), lo que permite probarla sin crear cuenta.
- **La seguridad está en la base de datos, no en el cliente.** Las políticas RLS comprueban `auth.uid() = user_id`, y las restricciones `check` validan importes, categorías y que cada tipo de movimiento tenga los campos que le corresponden.
- **Proveedores de almacén.** Cada sitio donde puede vivir el sobre cifrado es un `ProveedorAlmacen` (`src/data/proveedores/`: `id`, `nombre`, `campos` de configuración y `crearAlmacen`). Cada persona elige el suyo en la pantalla de instalación (`Instalacion.tsx`, también desde Ajustes) y `src/data/configuracion.ts` guarda `{proveedor, parámetros públicos}` en `localStorage`: nunca la contraseña de la bóveda, y la URL de Supabase tiene que ser https. Las variables `VITE_SUPABASE_*` solo sugieren el valor preseleccionado. Quien ya usaba la app conserva su configuración y sus datos sin hacer nada (sesión de Supabase o datos de ejemplo). Cambiar de proveedor no mueve los datos ya guardados. El cifrado no depende del proveedor.
- **Cifrado en el cliente.** Al entrar por primera vez la persona elige una contraseña; de ella se deriva una clave AES-GCM que nunca sale del navegador (ni siquiera es exportable). Todos sus datos se cifran juntos y se guardan como una sola fila en `bovedas`, con un IV nuevo en cada guardado. Quien administra Supabase solo ve texto cifrado, y si la persona borra los datos del navegador los recupera entrando con su correo y su contraseña. Si la olvida, no hay recuperación posible: es el precio de que nadie más pueda leerlos. El código está en `src/data/cifrado.ts` y `src/data/boveda.ts`.
- **Importes en formato español.** `parsearImporte` entiende `1.250`, `12,50` y `1.250,75 €`, y todo se redondea a céntimos para evitar errores de coma flotante.

## Ponerlo en marcha

Requisitos: Node 22.

```bash
npm install
npm run dev
```

Sin más configuración, la primera pantalla pregunta dónde guardar los datos (por defecto, los datos de ejemplo).

### Con Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En el editor SQL, ejecuta en orden los ficheros de `supabase/migrations/`.
3. En **Authentication → URL Configuration**, añade la URL de tu app (por ejemplo `http://localhost:5173`) a las URLs de redirección.
4. `npm run dev` y, en la pantalla de instalación, elige Supabase y pega la URL (https) y la clave pública `anon` del proyecto (Project Settings → API). Opcional: copia `.env.example` a `.env.local` para que vengan preseleccionadas.
5. Entra con tu correo.

### Desplegar

Funciona en cualquier hosting estático (Vercel, Netlify, Cloudflare Pages). Las dos variables `VITE_SUPABASE_*` en el hosting son opcionales: solo sugieren Supabase en la instalación. Cada persona usa su propio proyecto, así que la política de contenido del build permite conexiones `https:`. Añade la URL de producción a las redirecciones de Supabase.

## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests con Vitest |
| `npm run lint` | ESLint |
| `npm run build` | Comprobación de tipos y build de producción |

## Licencia

MIT
