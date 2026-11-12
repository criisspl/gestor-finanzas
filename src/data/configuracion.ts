import { buscarProveedor, type ConfigProveedor, type Proveedor, type Seleccion } from './proveedores/index.ts'

/** Dónde guarda cada persona sus datos. Solo parámetros públicos: ni contraseña ni clave de cifrado. */
export interface Configuracion {
  proveedor: string
  parametros: ConfigProveedor
}

/** Variables de entorno que solo sugieren un valor por defecto. */
export interface EntornoSugerido {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

/** Lo mínimo de `localStorage` que se usa (los tests pasan uno falso). */
export type Almacenamiento = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

export const CLAVE_CONFIGURACION = 'gestor-finanzas:configuracion'
/** Clave donde la versión anterior guardaba los datos de ejemplo (`demo.ts`). */
const CLAVE_DEMO = 'gestor-finanzas:demo'
const VERSION = 1

/** Errores por campo (`{}` si todo vale). Vacío o ausente también es error: todos los campos son obligatorios. */
export function validarParametros(proveedor: Proveedor, parametros: ConfigProveedor): Record<string, string> {
  const errores: Record<string, string> = {}
  for (const campo of proveedor.campos) {
    const valor = (parametros[campo.clave] ?? '').trim()
    if (!valor) errores[campo.clave] = `Falta ${campo.etiqueta.toLowerCase()}.`
    else {
      const motivo = campo.validar?.(valor)
      if (motivo) errores[campo.clave] = motivo
    }
  }
  return errores
}

/** Se queda solo con los campos del proveedor que no son secretos, sin espacios sobrantes. */
function publicos(proveedor: Proveedor, parametros: ConfigProveedor): ConfigProveedor {
  const salida: Record<string, string> = {}
  for (const campo of proveedor.campos) {
    const valor = parametros[campo.clave]
    if (!campo.secreto && typeof valor === 'string') salida[campo.clave] = valor.trim()
  }
  return salida
}

/** Configuración limpia y válida, o null si el proveedor no existe o algún campo no vale. */
export function normalizarConfiguracion(c: { proveedor?: unknown; parametros?: unknown }): Configuracion | null {
  if (typeof c.proveedor !== 'string') return null
  const proveedor = buscarProveedor(c.proveedor)
  if (!proveedor) return null
  const crudos = c.parametros && typeof c.parametros === 'object' ? (c.parametros as ConfigProveedor) : {}
  const parametros = publicos(proveedor, crudos)
  return Object.keys(validarParametros(proveedor, parametros)).length ? null : { proveedor: proveedor.id, parametros }
}

export function seleccionar(c: Configuracion): Seleccion {
  const proveedor = buscarProveedor(c.proveedor)
  if (!proveedor) throw new Error(`Proveedor desconocido: ${c.proveedor}`)
  return { proveedor, config: c.parametros }
}

/** Lanza si la configuración no es válida: nada raro llega a `localStorage`. */
export function guardarConfiguracion(c: Configuracion, almacenamiento: Almacenamiento = localStorage): Configuracion {
  const limpia = normalizarConfiguracion(c)
  if (!limpia) throw new Error('Configuración no válida')
  almacenamiento.setItem(CLAVE_CONFIGURACION, JSON.stringify({ version: VERSION, ...limpia }))
  return limpia
}

export function leerConfiguracion(almacenamiento: Almacenamiento = localStorage): Configuracion | null {
  try {
    const guardado = almacenamiento.getItem(CLAVE_CONFIGURACION)
    return guardado ? normalizarConfiguracion(JSON.parse(guardado) as object) : null
  } catch {
    return null
  }
}

/** El valor que el instalador sugiere: Supabase si el despliegue trae sus variables; si no, el modo de ejemplo de siempre. */
export function sugerirDesdeEntorno(env: EntornoSugerido): Configuracion {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: clave } = env
  if (url && clave) return { proveedor: 'supabase', parametros: { url, clave } }
  return { proveedor: 'demo', parametros: {} }
}

/** supabase-js guarda la sesión en `sb-<proyecto>-auth-token`: indica que esta persona ya usaba Supabase aquí. */
function teniaSesionSupabase(a: Almacenamiento): boolean {
  for (let i = 0; i < a.length; i++) {
    const k = a.key(i)
    if (k?.startsWith('sb-') && k.endsWith('-auth-token')) return true
  }
  return false
}

/**
 * Configuración con la que arranca la app. Si ya hay una guardada, esa.
 * Si no, quien venía usando la app la conserva sin hacer nada: sesión de Supabase (con las variables del despliegue) o datos de ejemplo.
 * Una persona nueva obtiene null y verá la instalación.
 */
export function cargarConfiguracion(env: EntornoSugerido, almacenamiento: Almacenamiento = localStorage): Configuracion | null {
  const guardada = leerConfiguracion(almacenamiento)
  if (guardada) return guardada
  try {
    const sugerida = sugerirDesdeEntorno(env)
    let heredada: Configuracion | null = null
    if (sugerida.proveedor === 'supabase' && teniaSesionSupabase(almacenamiento)) heredada = sugerida
    else if (almacenamiento.getItem(CLAVE_DEMO) !== null) heredada = { proveedor: 'demo', parametros: {} }
    return heredada ? guardarConfiguracion(heredada, almacenamiento) : null
  } catch {
    // Sin almacenamiento o variables inválidas: se muestra la instalación
    return null
  }
}
