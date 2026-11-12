import { proveedorDemo } from './demo.ts'
import { proveedorLocal } from './local.ts'
import { proveedorSupabase } from './supabase.ts'
import type { ConfigProveedor, Proveedor } from './tipos.ts'

export type { CampoConfig, ConfigProveedor, ContextoAlmacen, Proveedor, ProveedorAlmacen, ProveedorSinBoveda } from './tipos.ts'
export { usaBoveda } from './tipos.ts'
export { clienteSupabase } from './supabase.ts'

export const PROVEEDORES: readonly Proveedor[] = [proveedorSupabase, proveedorLocal, proveedorDemo]

export function buscarProveedor(id: string): Proveedor | undefined {
  return PROVEEDORES.find((p) => p.id === id)
}

/** Lo que la app usa: el proveedor y sus parámetros ya validados. */
export interface Seleccion {
  proveedor: Proveedor
  config: ConfigProveedor
}
