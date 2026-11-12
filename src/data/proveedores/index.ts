import { proveedorLocal } from './local.ts'
import { proveedorSupabase } from './supabase.ts'
import type { ConfigProveedor, ProveedorAlmacen } from './tipos.ts'

export type { CampoConfig, ConfigProveedor, ContextoAlmacen, ProveedorAlmacen } from './tipos.ts'
export { clienteSupabase } from './supabase.ts'

export const PROVEEDORES: readonly ProveedorAlmacen[] = [proveedorSupabase, proveedorLocal]

export interface Seleccion {
  proveedor: ProveedorAlmacen
  config: ConfigProveedor
}

/**
 * Elección actual: con las dos variables de Supabase, Supabase; sin ellas, el modo demo.
 * Es solo el valor por defecto; la elección por persona llegará en otro paso.
 */
export function seleccionDesdeEntorno(env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }): Seleccion {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: clave } = env
  if (url && clave) return { proveedor: proveedorSupabase, config: { url, clave } }
  return { proveedor: proveedorLocal, config: {} }
}
